import json

import pytest
from sqlalchemy import select

from app.core.ws_manager import manager
from app.modules.community.models import CommunityPostStats
from app.modules.community.view_buffer import ViewBuffer, flush_once, view_buffer
from app.modules.notifications.models import NotificationLog
from app.modules.users.models import User

pytestmark = pytest.mark.anyio

CLOUD_URL = "https://res.cloudinary.com/{cloud}/image/upload/v1/loni/community/x.jpg"


async def _post(c, body="Hello mamas", **extra):
    r = await c.post("/api/v1/community/posts", json={"body": body, **extra})
    assert r.status_code == 201, r.text
    return r.json()["data"]


async def test_create_and_read_feed_with_first_name_only(make_user, as_user):
    olivia = await make_user("Olivia Okafor")
    c = await as_user(olivia)
    created = await _post(c, "  Question for the mamas  ")
    assert created["body"] == "Question for the mamas"
    assert created["is_mine"] is True and created["liked_by_me"] is False
    assert created["author"]["name"] == "Olivia"  # never the surname

    feed = (await c.get("/api/v1/community/posts")).json()["data"]
    assert [p["id"] for p in feed["items"]] == [created["id"]]
    assert feed["next_cursor"] is None


async def test_validation(make_user, as_user, monkeypatch):
    u = await make_user("Amelia Bello")
    c = await as_user(u)
    assert (await c.post("/api/v1/community/posts", json={"body": "   "})).status_code == 400
    assert (await c.post("/api/v1/community/posts", json={"body": "hi", "image_url": "https://evil.example/x.png"})).status_code == 400
    assert (await c.post("/api/v1/community/posts", json={"body": "x" * 2001})).status_code == 400

    from app.modules.community import router as router_mod
    monkeypatch.setattr(router_mod.settings, "CLOUDINARY_CLOUD_NAME", "demo")
    ok = await c.post("/api/v1/community/posts", json={"body": "", "image_url": CLOUD_URL.format(cloud="demo")})
    assert ok.status_code == 201  # an image alone is a valid post


async def test_like_is_idempotent_and_counts_exactly(make_user, as_user):
    author, fan = await make_user("Grace Eze"), await make_user("Lily Ade")
    ca = await as_user(author)
    post = await _post(ca)
    cf = await as_user(fan)

    for _ in range(3):  # double / triple tap must leave exactly one like
        r = await cf.post(f"/api/v1/community/posts/{post['id']}/like")
        assert r.json()["data"] == {"liked": True, "like_count": 1}
    feed = (await cf.get("/api/v1/community/posts")).json()["data"]["items"][0]
    assert feed["like_count"] == 1 and feed["liked_by_me"] is True

    for _ in range(2):
        r = await cf.delete(f"/api/v1/community/posts/{post['id']}/like")
        assert r.json()["data"] == {"liked": False, "like_count": 0}  # never goes negative
    assert (await cf.get("/api/v1/community/posts")).json()["data"]["items"][0]["liked_by_me"] is False


async def test_comments_count_order_and_notify_author(make_user, as_user, session_factory, _no_push):
    author, other = await make_user("Clara N"), await make_user("Mimi K")
    ca = await as_user(author)
    post = await _post(ca)
    co = await as_user(other)

    await co.post(f"/api/v1/community/posts/{post['id']}/comments", json={"body": "first!"})
    await co.post(f"/api/v1/community/posts/{post['id']}/comments", json={"body": "second"})
    ca = await as_user(author)
    await ca.post(f"/api/v1/community/posts/{post['id']}/comments", json={"body": "thanks"})  # own post: no notification

    listing = (await ca.get(f"/api/v1/community/posts/{post['id']}/comments")).json()["data"]
    assert [c["body"] for c in listing["items"]] == ["first!", "second", "thanks"]
    assert [c["is_mine"] for c in listing["items"]] == [False, False, True]
    assert (await ca.get("/api/v1/community/posts")).json()["data"]["items"][0]["comment_count"] == 3

    async with session_factory() as s:
        logs = (await s.execute(select(NotificationLog).where(NotificationLog.type == "community_comment"))).scalars().all()
    assert len(logs) == 2 and all(l.user_id == author.id for l in logs)
    assert len(_no_push) == 2
    assert (await ca.post(f"/api/v1/community/posts/{post['id']}/comments", json={"body": "  "})).status_code == 400


async def test_views_once_per_person_not_own_and_recent_viewers(make_user, as_user, session_factory):
    author = await make_user("Ada One")
    viewers = [await make_user(n) for n in ("V One", "V Two", "V Three", "V Four")]
    ca = await as_user(author)
    post = await _post(ca)
    buf = ViewBuffer()

    async def flush():
        return await flush_once(session_factory, buf)

    # The endpoint only queues (on the shared buffer); nothing is written until a flush.
    r = await ca.post("/api/v1/community/views", json={"post_ids": [post["id"]]})
    assert r.status_code == 200 and r.json()["data"]["queued"] == 1
    view_buffer.drain()
    async with session_factory() as s:
        assert (await s.get(CommunityPostStats, post["id"])).view_count == 0

    buf.add(author.id, [post["id"]])
    assert await flush() == {}  # your own post does not count

    for v in viewers:
        c = await as_user(v)
        buf.add(v.id, [post["id"]])
        buf.add(v.id, [post["id"]])  # duplicates collapse in memory
    assert len(buf) == 4
    assert await flush() == {post["id"]: 4}  # one counter write for four views

    for v in viewers:  # already counted -> the database ignores them
        buf.add(v.id, [post["id"]])
    assert await flush() == {}

    item = (await c.get("/api/v1/community/posts")).json()["data"]["items"][0]
    assert item["view_count"] == 4
    assert len(item["recent_viewers"]) == 3  # avatar stack shows three
    assert (await c.post("/api/v1/community/views", json={"post_ids": []})).status_code == 400


async def test_keyset_pagination_has_no_duplicates_or_gaps(make_user, as_user):
    u = await make_user("Pagey P")
    c = await as_user(u)
    ids = [(await _post(c, f"post {i}"))["id"] for i in range(5)]

    seen, cursor = [], None
    for _ in range(5):
        params = {"limit": 2, **({"cursor": cursor} if cursor else {})}
        page = (await c.get("/api/v1/community/posts", params=params)).json()["data"]
        seen += [p["id"] for p in page["items"]]
        cursor = page["next_cursor"]
        if not cursor:
            break
    assert seen == sorted(ids, reverse=True)


async def test_search_delete_and_permissions(make_user, as_user):
    a, b = await make_user("Owner O"), await make_user("Intruder I")
    ca = await as_user(a)
    keep = await _post(ca, "nursery corner finished")
    gone = await _post(ca, "to be deleted 100%")

    found = (await ca.get("/api/v1/community/posts", params={"q": "nursery"})).json()["data"]["items"]
    assert [p["id"] for p in found] == [keep["id"]]
    pct = (await ca.get("/api/v1/community/posts", params={"q": "100%"})).json()["data"]["items"]
    assert [p["id"] for p in pct] == [gone["id"]]  # % is matched literally, not as a wildcard

    cb = await as_user(b)
    assert (await cb.delete(f"/api/v1/community/posts/{gone['id']}")).status_code == 403
    ca = await as_user(a)
    assert (await ca.delete(f"/api/v1/community/posts/{gone['id']}")).status_code == 200
    assert [p["id"] for p in (await ca.get("/api/v1/community/posts")).json()["data"]["items"]] == [keep["id"]]
    assert (await ca.post(f"/api/v1/community/posts/{gone['id']}/like")).status_code == 404


async def test_post_rate_limit(make_user, as_user):
    u = await make_user("Spammy S")
    c = await as_user(u)
    for i in range(10):
        await _post(c, f"p{i}")
    assert (await c.post("/api/v1/community/posts", json={"body": "one too many"})).status_code == 429


class FakeSocket:
    def __init__(self):
        self.sent = []

    async def accept(self):
        pass

    async def send_text(self, text):
        self.sent.append(json.loads(text))


async def test_realtime_events_reach_only_subscribers(make_user, as_user):
    author, watcher, idle = await make_user("Auth A"), await make_user("Watch W"), await make_user("Idle I")
    ws_a, ws_w, ws_i = FakeSocket(), FakeSocket(), FakeSocket()
    for uid, ws in ((author.id, ws_a), (watcher.id, ws_w), (idle.id, ws_i)):
        await manager.connect(uid, ws)
    manager.subscribe(author.id, "community")
    manager.subscribe(watcher.id, "community")  # `idle` never subscribed
    try:
        ca = await as_user(author)
        post = await _post(ca, "live!")
        types = lambda ws: [m["type"] for m in ws.sent]
        assert "community_post_created" in types(ws_w)
        assert "community_post_created" not in types(ws_a)  # the author already has it from the response
        assert types(ws_i) == []

        cw = await as_user(watcher)
        await cw.post(f"/api/v1/community/posts/{post['id']}/like")
        stats = [m for m in ws_a.sent if m["type"] == "community_post_stats"][-1]["data"]
        assert stats["post_id"] == post["id"] and stats["like_count"] == 1

        manager.unsubscribe(watcher.id, "community")
        before = len(ws_w.sent)
        await cw.delete(f"/api/v1/community/posts/{post['id']}/like")
        assert len(ws_w.sent) == before
    finally:
        for uid, ws in ((author.id, ws_a), (watcher.id, ws_w), (idle.id, ws_i)):
            manager.disconnect(uid, ws)


async def test_counters_live_in_their_own_stats_row(make_user, as_user, session_factory):
    author = await make_user("Ada One")
    fan = await make_user("Fan One")
    post = await _post(await as_user(author))
    async with session_factory() as s:
        stats = await s.get(CommunityPostStats, post["id"])
        assert (stats.like_count, stats.comment_count, stats.view_count) == (0, 0, 0)

    c = await as_user(fan)
    assert (await c.post(f"/api/v1/community/posts/{post['id']}/like")).json()["data"]["like_count"] == 1
    async with session_factory() as s:
        assert (await s.get(CommunityPostStats, post["id"])).like_count == 1
