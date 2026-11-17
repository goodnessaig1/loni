"""Call safety: who may do what to a call, what a LiveKit token allows, the LiveKit webhook
(signature, exactly-once, ordering), state transitions that must not be undone by a race, the
stale-call sweep, the WebSocket ticket, and the production secrets guard.

All of these are UNIT/INTEGRATION tests against an in-memory SQLite database with LiveKit, push
and WebSocket delivery mocked. They do not exercise a real LiveKit server, a phone, or a real
network, and SQLite ignores SELECT ... FOR UPDATE, so true concurrent-request races are NOT
covered here (they need a Postgres run).
"""
import base64
import hashlib
import json
from datetime import datetime, timedelta, timezone

import pytest
from google.protobuf.json_format import MessageToJson
from jose import jwt
from livekit.api import AccessToken
from livekit.protocol import models as lk_models
from livekit.protocol import webhook as lk_webhook
from sqlalchemy import select

from app.core import timeouts
from app.core.config import settings
from app.core.security import ALGORITHM, create_access_token, create_ws_ticket
from app.modules.calls import webhook_router, ws_router
from app.modules.calls.models import Call, CallEvent, CallParticipant, CallStatusEnum, ParticipantRoleEnum
from app.modules.calls.services import call_service
from app.modules.calls.services.call_service import CallService
from app.modules.calls.services.livekit_service import LiveKitService, TOKEN_TTL_SECONDS
from app.modules.users.models import AccountStatusEnum, User, UserTypeEnum

pytestmark = pytest.mark.anyio

API = "/api/v1/calls"
WEBHOOK = "/api/v1/livekit/webhook"
LK_KEY, LK_SECRET = "test-key", "test-secret-that-is-long-enough-123456"
_REAL_DELETE_ROOM = LiveKitService.delete_room


@pytest.fixture(autouse=True)
def env(monkeypatch, session_factory):
    """LiveKit, push and WebSocket delivery replaced by recorders."""
    sent, ws = [], []

    async def _noop(*a, **k):
        return None

    async def _emit(user_id, event_type, title, body, data):
        sent.append((user_id, event_type, data))

    async def _ws(user_id, event_type, data):
        ws.append((user_id, event_type, data))
        return True

    monkeypatch.setattr(settings, "LIVEKIT_API_KEY", LK_KEY)
    monkeypatch.setattr(settings, "LIVEKIT_API_SECRET", LK_SECRET)
    monkeypatch.setattr(LiveKitService, "create_room", staticmethod(_noop))
    monkeypatch.setattr(LiveKitService, "delete_room", staticmethod(_noop))
    monkeypatch.setattr(CallService, "_ring_timeout_watchdog", staticmethod(_noop))
    monkeypatch.setattr(CallService, "_reconnect_watchdog", staticmethod(_noop))
    monkeypatch.setattr(call_service, "_emit", _emit)
    monkeypatch.setattr(webhook_router.ws_manager, "send_to_user", _ws)
    monkeypatch.setattr(timeouts.ws_manager, "send_to_user", _ws)
    return {"sent": sent, "ws": ws}


@pytest.fixture
def person(make_user, session_factory):
    async def _make(name, user_type=UserTypeEnum.user, online=False, status=AccountStatusEnum.active):
        u = await make_user(name)
        async with session_factory() as s:
            row = await s.get(User, u.id)
            row.user_type = user_type
            row.is_online = online
            row.account_status = status
            await s.commit()
            return row
    return _make


async def _status(session_factory, call_id):
    async with session_factory() as s:
        return (await s.get(Call, call_id)).status


async def _answered_call(person, as_user):
    """Mother calls a named nurse who answers. Returns (mum, nurse, call_id)."""
    mum = await person("Amara")
    nurse = await person("Joy Okafor", UserTypeEnum.nurse, online=True)
    call = (await (await as_user(mum)).post(f"{API}/request", json={"nurse_id": nurse.id})).json()
    r = await (await as_user(nurse)).post(f"{API}/{call['id']}/accept")
    assert r.status_code == 200, r.text
    return mum, nurse, call["id"]


# --------------------------------------------------------------------------- authorisation

async def test_join_is_only_for_participants_of_an_answered_live_call(person, as_user, session_factory):
    mum = await person("Amara")
    nurse = await person("Joy", UserTypeEnum.nurse, online=True)
    stranger = await person("Eve")
    call = (await (await as_user(mum)).post(f"{API}/request", json={"nurse_id": nurse.id})).json()

    # Still ringing: nobody to talk to yet, so no token - not even for the caller.
    assert (await (await as_user(mum)).post(f"{API}/{call['id']}/join")).status_code == 409

    await (await as_user(nurse)).post(f"{API}/{call['id']}/accept")
    assert (await (await as_user(stranger)).post(f"{API}/{call['id']}/join")).status_code == 403
    ok = await (await as_user(mum)).post(f"{API}/{call['id']}/join")
    assert ok.status_code == 200 and ok.json()["token"]

    await (await as_user(mum)).post(f"{API}/{call['id']}/end")
    assert (await (await as_user(mum)).post(f"{API}/{call['id']}/join")).status_code == 400


async def test_only_the_named_nurse_can_answer_and_never_twice(person, as_user):
    mum = await person("Amara")
    nurse = await person("Joy", UserTypeEnum.nurse, online=True)
    other = await person("Ada", UserTypeEnum.nurse, online=True)
    call = (await (await as_user(mum)).post(f"{API}/request", json={"nurse_id": nurse.id})).json()

    assert (await (await as_user(other)).post(f"{API}/{call['id']}/accept")).status_code == 403
    assert (await (await as_user(mum)).post(f"{API}/{call['id']}/accept")).status_code == 403
    assert (await (await as_user(nurse)).post(f"{API}/{call['id']}/accept")).status_code == 200
    assert (await (await as_user(nurse)).post(f"{API}/{call['id']}/accept")).status_code == 400


async def test_a_busy_person_is_not_rung_and_cannot_answer_another_call(person, as_user):
    mum, nurse, _ = await _answered_call(person, as_user)
    mum2 = await person("Bisi")
    # Ringing someone by name who is already talking: refused up front (BUSY) instead of ringing over the call.
    r = await (await as_user(mum2)).post(f"{API}/request", json={"nurse_id": nurse.id})
    assert r.status_code == 409 and "another call" in r.json()["message"]
    # An open call (another nurse is free) is not offered to the busy one, so she cannot answer it.
    await person("Ada", UserTypeEnum.nurse, online=True)
    open_call = (await (await as_user(mum2)).post(f"{API}/request", json={})).json()
    assert (await (await as_user(nurse)).post(f"{API}/{open_call['id']}/accept")).status_code == 403


async def test_open_calls_are_answered_only_by_approved_nurses_they_were_offered_to(person, as_user, session_factory):
    mum = await person("Amara")
    rung = await person("Joy", UserTypeEnum.nurse, online=True)
    offline = await person("Ada", UserTypeEnum.nurse, online=False)   # not rung
    call = (await (await as_user(mum)).post(f"{API}/request", json={})).json()
    assert (await (await as_user(offline)).post(f"{API}/{call['id']}/accept")).status_code == 403

    # Pending review: even if she was rung (approved at the time), she cannot answer now.
    async with session_factory() as s:
        (await s.get(User, rung.id)).account_status = AccountStatusEnum.pending
        await s.commit()
    assert (await (await as_user(rung)).post(f"{API}/{call['id']}/accept")).status_code == 403
    assert await _status(session_factory, call["id"]) == CallStatusEnum.RINGING


async def test_only_mothers_can_start_a_nurse_call(person, as_user):
    nurse = await person("Joy", UserTypeEnum.nurse, online=True)
    await person("Ada", UserTypeEnum.nurse, online=True)
    driver = await person("Tunde", UserTypeEnum.driver)
    for who in (driver, nurse):
        assert (await (await as_user(who)).post(f"{API}/request", json={})).status_code == 403
        assert (await (await as_user(who)).post(f"{API}/request", json={"nurse_id": nurse.id})).status_code == 403


async def test_the_answering_nurses_other_devices_are_told_to_stop_ringing(person, as_user, env):
    mum, nurse, call_id = await _answered_call(person, as_user)
    mine = [d for u, e, d in env["sent"] if u == nurse.id and e == "call_accepted"]
    assert mine and mine[0]["answered_here"] is True and mine[0]["call_id"] == str(call_id)


async def test_strangers_cannot_end_or_reject_someone_elses_call(person, as_user, session_factory):
    mum, nurse, call_id = await _answered_call(person, as_user)
    stranger = await person("Eve")
    assert (await (await as_user(stranger)).post(f"{API}/{call_id}/end")).status_code == 403
    assert await _status(session_factory, call_id) == CallStatusEnum.CONNECTING

    mum2 = await person("Bisi")
    nurse2 = await person("Ngozi", UserTypeEnum.nurse, online=True)
    ringing = (await (await as_user(mum2)).post(f"{API}/request", json={"nurse_id": nurse2.id})).json()
    assert (await (await as_user(stranger)).post(f"{API}/{ringing['id']}/reject")).status_code == 403
    assert await _status(session_factory, ringing["id"]) == CallStatusEnum.RINGING


async def test_ending_twice_and_rejecting_after_answer_are_harmless(person, as_user, session_factory, env):
    mum, nurse, call_id = await _answered_call(person, as_user)
    assert (await (await as_user(nurse)).post(f"{API}/{call_id}/reject")).status_code == 200
    assert await _status(session_factory, call_id) == CallStatusEnum.CONNECTING  # reject after answer is a no-op
    env["sent"].clear()
    assert (await (await as_user(mum)).post(f"{API}/{call_id}/end")).status_code == 200
    assert (await (await as_user(nurse)).post(f"{API}/{call_id}/end")).status_code == 200
    assert await _status(session_factory, call_id) == CallStatusEnum.ENDED
    assert [e for _, e, _ in env["sent"]].count("call_ended") == 1  # the second hang-up told nobody


async def test_only_the_caller_rates_a_finished_answered_call_from_1_to_5(person, as_user, session_factory):
    mum, nurse, call_id = await _answered_call(person, as_user)
    assert (await (await as_user(mum)).post(f"{API}/{call_id}/rate", json={"rating": 5})).status_code == 400  # not over
    await (await as_user(mum)).post(f"{API}/{call_id}/end")
    assert (await (await as_user(nurse)).post(f"{API}/{call_id}/rate", json={"rating": 5})).status_code == 403
    assert (await (await as_user(mum)).post(f"{API}/{call_id}/rate", json={"rating": 999})).status_code == 400
    assert (await (await as_user(mum)).post(f"{API}/{call_id}/rate", json={"rating": 0})).status_code == 400
    assert (await (await as_user(mum)).post(f"{API}/{call_id}/rate", json={"rating": 4})).status_code == 200
    async with session_factory() as s:
        assert (await s.get(Call, call_id)).rating == 4


async def test_an_unanswered_call_cannot_be_rated(person, as_user):
    mum = await person("Amara")
    nurse = await person("Joy", UserTypeEnum.nurse, online=True)
    call = (await (await as_user(mum)).post(f"{API}/request", json={"nurse_id": nurse.id})).json()
    await (await as_user(mum)).post(f"{API}/{call['id']}/end")  # cancelled while ringing
    assert (await (await as_user(mum)).post(f"{API}/{call['id']}/rate", json={"rating": 5})).status_code == 400


# --------------------------------------------------------------------------- LiveKit token

async def test_livekit_token_is_one_room_one_identity_microphone_only_and_short_lived():
    settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET = LK_KEY, LK_SECRET
    raw = LiveKitService.create_token("room-abc", "user123", "Joy")
    claims = jwt.decode(raw, LK_SECRET, algorithms=["HS256"], options={"verify_aud": False})
    assert claims["sub"] == "user123" and claims["iss"] == LK_KEY
    video = claims["video"]
    assert video["room"] == "room-abc" and video["roomJoin"] is True
    assert video.get("canPublishSources") == ["microphone"]
    assert video.get("canPublishData") is False
    assert not video.get("roomAdmin") and not video.get("roomCreate") and not video.get("roomList")
    assert claims["exp"] - claims["nbf"] <= TOKEN_TTL_SECONDS <= 15 * 60


async def test_accept_mints_a_token_for_the_answering_nurse_only(person, as_user, monkeypatch):
    calls = []
    monkeypatch.setattr(LiveKitService, "create_token",
                        staticmethod(lambda room_name, participant_identity, participant_name, **k:
                                     calls.append((room_name, participant_identity)) or "tok"))
    mum, nurse, call_id = await _answered_call(person, as_user)
    assert calls and calls[-1][1] == nurse.id and calls[-1][0].startswith("room-")


# --------------------------------------------------------------------------- races in accept

async def _ring(person, as_user):
    mum = await person("Amara")
    nurse = await person("Joy", UserTypeEnum.nurse, online=True)
    call = (await (await as_user(mum)).post(f"{API}/request", json={"nurse_id": nurse.id})).json()
    return mum, nurse, call["id"]


async def test_hanging_up_while_the_room_is_created_is_not_undone(person, as_user, session_factory, monkeypatch):
    mum, nurse, call_id = await _ring(person, as_user)

    async def _create_room_while_she_hangs_up(room_name, **k):
        async with session_factory() as s:
            await CallService.end_call(s, call_id, mum.id)

    monkeypatch.setattr(LiveKitService, "create_room", staticmethod(_create_room_while_she_hangs_up))
    r = await (await as_user(nurse)).post(f"{API}/{call_id}/accept")
    assert r.status_code == 409 and "token" not in r.json()
    assert await _status(session_factory, call_id) == CallStatusEnum.ENDED  # not resurrected to CONNECTING


async def test_connected_before_accept_returns_is_not_downgraded(person, as_user, session_factory, monkeypatch):
    mum, nurse, call_id = await _ring(person, as_user)

    async def _both_join_first(room_name, **k):
        async with session_factory() as s:
            c = await s.get(Call, call_id)
            c.status = CallStatusEnum.CONNECTED
            await s.commit()

    monkeypatch.setattr(LiveKitService, "create_room", staticmethod(_both_join_first))
    assert (await (await as_user(nurse)).post(f"{API}/{call_id}/accept")).status_code == 200
    assert await _status(session_factory, call_id) == CallStatusEnum.CONNECTED


async def test_room_creation_failure_fails_the_call_for_both(person, as_user, session_factory, monkeypatch, env):
    mum, nurse, call_id = await _ring(person, as_user)

    async def _boom(room_name, **k):
        raise RuntimeError("livekit down")

    monkeypatch.setattr(LiveKitService, "create_room", staticmethod(_boom))
    assert (await (await as_user(nurse)).post(f"{API}/{call_id}/accept")).status_code == 502
    assert await _status(session_factory, call_id) == CallStatusEnum.FAILED
    failed = {u for u, e, _ in env["sent"] if e == "call_failed"}
    assert failed == {mum.id, nurse.id}


# --------------------------------------------------------------------------- webhook

def _signed(event_name, room, identity=None, event_id="EV_1", created_at=None, secret=LK_SECRET, key=LK_KEY, sid=""):
    ev = lk_webhook.WebhookEvent(event=event_name, room=lk_models.Room(name=room), id=event_id,
                                 created_at=int(created_at or datetime.now(timezone.utc).timestamp()))
    if identity:
        ev.participant.CopyFrom(lk_models.ParticipantInfo(identity=identity, sid=sid))
    body = MessageToJson(ev)
    digest = base64.b64encode(hashlib.sha256(body.encode()).digest()).decode()
    token = AccessToken(key, secret).with_sha256(digest).to_jwt()
    return body, {"Authorization": token, "Content-Type": "application/webhook+json"}


async def _post(as_user, user, body, headers):
    return await (await as_user(user)).post(WEBHOOK, content=body, headers=headers)


async def test_webhook_rejects_missing_wrong_and_tampered_signatures(person, as_user, session_factory):
    mum, nurse, call_id = await _answered_call(person, as_user)
    room = (await (await as_user(mum)).get(f"{API}/history")).json()[0]["room_name"]
    body, headers = _signed("room_finished", room)

    assert (await (await as_user(mum)).post(WEBHOOK, content=body)).status_code == 401
    _, wrong = _signed("room_finished", room, secret="not-the-secret-not-the-secret-123")
    assert (await _post(as_user, mum, body, wrong)).status_code == 401
    tampered = body.replace("room_finished", "participant_left")
    assert (await _post(as_user, mum, tampered, headers)).status_code == 401
    assert await _status(session_factory, call_id) == CallStatusEnum.CONNECTING  # nothing applied


async def test_webhook_connects_on_both_joins_and_applies_each_event_once(person, as_user, session_factory, env):
    mum, nurse, call_id = await _answered_call(person, as_user)
    room = (await (await as_user(mum)).get(f"{API}/history")).json()[0]["room_name"]

    b1, h1 = _signed("participant_joined", room, mum.id, "EV_A")
    assert (await _post(as_user, mum, b1, h1)).json()["status"] == "ok"
    assert await _status(session_factory, call_id) == CallStatusEnum.CONNECTING  # only one is in
    b2, h2 = _signed("participant_joined", room, nurse.id, "EV_B")
    assert (await _post(as_user, mum, b2, h2)).json()["status"] == "ok"
    assert await _status(session_factory, call_id) == CallStatusEnum.CONNECTED
    assert {u for u, e, d in env["ws"] if d.get("status") == "CONNECTED"} == {mum.id, nurse.id}

    # LiveKit retries a delivery: same id, nothing applied twice.
    assert (await _post(as_user, mum, b2, h2)).json()["status"] == "duplicate"
    async with session_factory() as s:
        rows = (await s.execute(select(CallEvent).where(
            CallEvent.call_id == call_id, CallEvent.event_type == "participant_joined"))).scalars().all()
        assert len(rows) == 2


async def test_webhook_drop_rejoin_and_room_finished(person, as_user, session_factory, env):
    mum, nurse, call_id = await _answered_call(person, as_user)
    room = (await (await as_user(mum)).get(f"{API}/history")).json()[0]["room_name"]
    t0 = datetime.now(timezone.utc).timestamp()
    for i, who in enumerate((mum.id, nurse.id)):
        b, h = _signed("participant_joined", room, who, f"J{i}", t0)
        await _post(as_user, mum, b, h)

    b, h = _signed("participant_left", room, nurse.id, "L1", t0 + 10)
    await _post(as_user, mum, b, h)
    assert await _status(session_factory, call_id) == CallStatusEnum.RECONNECTING
    assert (mum.id, "call_state", {"call_id": str(call_id), "status": "RECONNECTING"}) in env["ws"]

    b, h = _signed("participant_joined", room, nurse.id, "J2", t0 + 20)
    await _post(as_user, mum, b, h)
    assert await _status(session_factory, call_id) == CallStatusEnum.CONNECTED

    b, h = _signed("room_finished", room, None, "F1", t0 + 60)
    await _post(as_user, mum, b, h)
    async with session_factory() as s:
        c = await s.get(Call, call_id)
        assert c.status == CallStatusEnum.ENDED and c.ended_at is not None


async def test_a_late_join_delivered_after_a_newer_leave_does_not_reconnect(person, as_user, session_factory):
    mum, nurse, call_id = await _answered_call(person, as_user)
    room = (await (await as_user(mum)).get(f"{API}/history")).json()[0]["room_name"]
    t0 = datetime.now(timezone.utc).timestamp()
    b, h = _signed("participant_joined", room, mum.id, "J0", t0)
    await _post(as_user, mum, b, h)
    # The nurse joined at t0+1 and left at t0+5, but LiveKit delivered the leave first.
    b, h = _signed("participant_left", room, nurse.id, "L0", t0 + 5)
    await _post(as_user, mum, b, h)
    b, h = _signed("participant_joined", room, nurse.id, "J1", t0 + 1)
    await _post(as_user, mum, b, h)
    assert await _status(session_factory, call_id) != CallStatusEnum.CONNECTED


async def test_a_reconnect_whose_old_session_leaves_late_keeps_the_call_connected(person, as_user, session_factory):
    """LiveKit reconnect = new session (sid) for the same person; the old session's leave can be
    delivered after the new session's join. That must not start the 'they left' countdown."""
    mum, nurse, call_id = await _answered_call(person, as_user)
    room = (await (await as_user(mum)).get(f"{API}/history")).json()[0]["room_name"]
    for i, (who, sid) in enumerate(((mum.id, "PA_mum1"), (nurse.id, "PA_nurse1"))):
        b, h = _signed("participant_joined", room, who, f"J{i}", sid=sid)
        await _post(as_user, mum, b, h)
    assert await _status(session_factory, call_id) == CallStatusEnum.CONNECTED

    b, h = _signed("participant_joined", room, nurse.id, "J2", sid="PA_nurse2")  # new session first
    await _post(as_user, mum, b, h)
    b, h = _signed("participant_left", room, nurse.id, "L1", sid="PA_nurse1")    # old session, late
    await _post(as_user, mum, b, h)
    assert await _status(session_factory, call_id) == CallStatusEnum.CONNECTED

    b, h = _signed("participant_left", room, nurse.id, "L2", sid="PA_nurse2")    # now she really left
    await _post(as_user, mum, b, h)
    assert await _status(session_factory, call_id) == CallStatusEnum.RECONNECTING


async def test_a_session_whose_leave_arrived_first_is_not_counted_as_present(person, as_user, session_factory):
    mum, nurse, call_id = await _answered_call(person, as_user)
    room = (await (await as_user(mum)).get(f"{API}/history")).json()[0]["room_name"]
    b, h = _signed("participant_joined", room, mum.id, "J0", sid="PA_mum1")
    await _post(as_user, mum, b, h)
    b, h = _signed("participant_left", room, nurse.id, "L0", sid="PA_nurse1")
    await _post(as_user, mum, b, h)
    b, h = _signed("participant_joined", room, nurse.id, "J1", sid="PA_nurse1")
    await _post(as_user, mum, b, h)
    assert await _status(session_factory, call_id) != CallStatusEnum.CONNECTED


async def test_webhook_for_an_unknown_room_is_ignored(person, as_user):
    mum = await person("Amara")
    b, h = _signed("room_finished", "room-not-ours", None, "X1")
    assert (await _post(as_user, mum, b, h)).json()["status"] == "ignored"


# --------------------------------------------------------------------------- stale-call sweep

def _ago(seconds):
    return datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=seconds)  # SQLite: naive UTC


async def _connected(session_factory, mum, nurse, room, started=600, touched=600):
    async with session_factory() as s:
        c = Call(caller_id=mum.id, receiver_id=nurse.id, room_name=room, status=CallStatusEnum.CONNECTED,
                 answered_at=_ago(started + 5), started_at=_ago(started), updated_at=_ago(touched))
        s.add(c)
        await s.commit()
        return c.id


@pytest.mark.parametrize("occupancy,expected", [
    (0, CallStatusEnum.ENDED),          # room is gone: the call is over
    (1, CallStatusEnum.RECONNECTING),   # one left: normal reconnect grace applies
    (2, CallStatusEnum.CONNECTED),      # both still talking
    (None, CallStatusEnum.CONNECTED),   # LiveKit unreachable: never end a call on an outage
])
async def test_sweep_reconciles_a_stale_connected_call_with_livekit(person, session_factory, monkeypatch, env,
                                                                   occupancy, expected):
    mum, nurse = await person("Amara"), await person("Joy", UserTypeEnum.nurse)
    call_id = await _connected(session_factory, mum, nurse, f"r-{occupancy}")

    async def _occ(room):
        return occupancy
    monkeypatch.setattr(LiveKitService, "room_occupancy", staticmethod(_occ))
    await timeouts.sweep_once(session_factory)
    assert await _status(session_factory, call_id) == expected
    if expected == CallStatusEnum.ENDED:
        assert {u for u, e, _ in env["sent"] if e == "call_ended"} == {mum.id, nurse.id}


async def test_sweep_ends_a_call_past_the_hard_limit_and_leaves_recent_ones(person, session_factory, monkeypatch):
    mum, nurse = await person("Amara"), await person("Joy", UserTypeEnum.nurse)
    too_long = await _connected(session_factory, mum, nurse, "r-long", started=settings.CALL_MAX_SECONDS + 60)
    recent = await _connected(session_factory, mum, nurse, "r-recent", started=30, touched=30)
    asked = []

    async def _occ(room):
        asked.append(room)
        return 2
    monkeypatch.setattr(LiveKitService, "room_occupancy", staticmethod(_occ))
    await timeouts.sweep_once(session_factory)
    assert await _status(session_factory, too_long) == CallStatusEnum.ENDED
    assert await _status(session_factory, recent) == CallStatusEnum.CONNECTED
    assert asked == []  # neither needed a LiveKit round trip


async def test_sweep_survives_livekit_not_being_configured(person, session_factory, monkeypatch):
    """A missing LiveKit setting must not crash the sweep (which also times out rings and rides)."""
    mum, nurse = await person("Amara"), await person("Joy", UserTypeEnum.nurse)
    call_id = await _connected(session_factory, mum, nurse, "r-noconf")
    async with session_factory() as s:
        ringing = Call(caller_id=mum.id, room_name="r-ring", status=CallStatusEnum.RINGING,
                       created_at=_ago(600), updated_at=_ago(600))
        s.add(ringing)
        await s.commit()
        ringing_id = ringing.id
    monkeypatch.setattr(settings, "LIVEKIT_URL", "")
    done = await timeouts.sweep_once(session_factory)
    assert await _status(session_factory, call_id) == CallStatusEnum.CONNECTED  # unknown: left alone
    assert await _status(session_factory, ringing_id) == CallStatusEnum.TIMEOUT
    assert done["calls_timed_out"] == 1


async def test_sweep_prunes_old_webhook_ledger_rows(session_factory):
    from app.modules.calls.models import LiveKitWebhookEvent
    async with session_factory() as s:
        s.add_all([LiveKitWebhookEvent(id="old", event_type="room_finished", received_at=_ago(8 * 24 * 3600)),
                   LiveKitWebhookEvent(id="new", event_type="room_finished")])
        await s.commit()
    await timeouts.sweep_once(session_factory)
    async with session_factory() as s:
        assert await s.get(LiveKitWebhookEvent, "old") is None
        assert await s.get(LiveKitWebhookEvent, "new") is not None


async def test_hanging_up_tells_the_other_side_even_if_livekit_is_unreachable(person, as_user, session_factory,
                                                                               monkeypatch, env):
    mum, nurse, call_id = await _answered_call(person, as_user)
    monkeypatch.setattr(LiveKitService, "delete_room", _REAL_DELETE_ROOM)
    monkeypatch.setattr(settings, "LIVEKIT_URL", "")  # delete_room cannot even be attempted
    env["sent"].clear()
    assert (await (await as_user(mum)).post(f"{API}/{call_id}/end")).status_code == 200
    assert await _status(session_factory, call_id) == CallStatusEnum.ENDED
    assert {u for u, e, _ in env["sent"] if e == "call_ended"} == {nurse.id}


# --------------------------------------------------------------------------- WebSocket ticket

async def test_ws_ticket_opens_the_socket_but_is_not_an_api_credential(person, as_user, session_factory, monkeypatch):
    from fastapi import HTTPException
    from fastapi.security import HTTPAuthorizationCredentials
    from app.api.deps import get_current_user

    monkeypatch.setattr(ws_router, "AsyncSessionLocal", session_factory)
    mum = await person("Amara")
    ticket = (await (await as_user(mum)).post(f"{API}/ws-ticket")).json()["ticket"]
    claims = jwt.decode(ticket, settings.SECRET_KEY, algorithms=[ALGORITHM])
    assert claims["typ"] == "ws" and claims["exp"] - datetime.now(timezone.utc).timestamp() <= 61

    assert await ws_router._authenticate(ticket, None) == mum.id
    access = create_access_token(mum.id)
    assert await ws_router._authenticate(None, access) == mum.id     # older app builds keep working
    assert await ws_router._authenticate(access, None) is None       # an access token is not a ticket
    assert await ws_router._authenticate(None, ticket) is None       # a ticket is not a legacy token
    assert await ws_router._authenticate("garbage", None) is None

    async with session_factory() as s:
        with pytest.raises(HTTPException):
            await get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=ticket), s)


async def test_ws_refuses_suspended_and_deleted_accounts(person, session_factory, monkeypatch):
    monkeypatch.setattr(ws_router, "AsyncSessionLocal", session_factory)
    banned = await person("Eve", status=AccountStatusEnum.suspended)
    assert await ws_router._authenticate(create_ws_ticket(banned.id), None) is None
    assert await ws_router._authenticate(create_ws_ticket("nobody"), None) is None
    expired = jwt.encode({"sub": banned.id, "typ": "ws", "exp": datetime.now(timezone.utc) - timedelta(seconds=1)},
                         settings.SECRET_KEY, algorithm=ALGORITHM)
    assert await ws_router._authenticate(expired, None) is None


# --------------------------------------------------------------------------- production secrets

async def test_production_refuses_public_secrets_and_dev_only_warns(monkeypatch):
    from app.core import secrets_check
    monkeypatch.setattr(settings, "SECRET_KEY", "super_secret_key_change_in_production")
    monkeypatch.setattr(settings, "LIVEKIT_API_KEY", "devkey")
    monkeypatch.setattr(settings, "LIVEKIT_API_SECRET", "super_secret_livekit_key_32_chars_long!")
    monkeypatch.setattr(settings, "LIVEKIT_PUBLIC_URL", "ws://192.168.1.2:7880")
    assert len(secrets_check.problems()) == 4

    monkeypatch.setattr(settings, "APP_ENV", "development")
    secrets_check.enforce_production_secrets()  # warns only
    monkeypatch.setattr(settings, "APP_ENV", "production")
    with pytest.raises(secrets_check.InsecureConfigError):
        secrets_check.enforce_production_secrets()

    monkeypatch.setattr(settings, "SECRET_KEY", "x" * 48)
    monkeypatch.setattr(settings, "LIVEKIT_API_KEY", "APIprodKey")
    monkeypatch.setattr(settings, "LIVEKIT_API_SECRET", "y" * 48)
    monkeypatch.setattr(settings, "LIVEKIT_PUBLIC_URL", "wss://livekit.example.org")
    secrets_check.enforce_production_secrets()  # clean config starts


async def test_phones_can_report_call_failures_onto_the_call_trail(person, as_user, session_factory):
    mum, nurse, call_id = await _answered_call(person, as_user)
    stranger = await person("Eve")
    body = {"kind": "connect_timeout", "detail": "no ICE after 20s", "platform": "android"}
    assert (await (await as_user(mum)).post(f"{API}/{call_id}/client-report", json=body)).status_code == 202
    assert (await (await as_user(stranger)).post(f"{API}/{call_id}/client-report", json=body)).status_code == 403
    assert (await (await as_user(mum)).post(f"{API}/{call_id}/client-report", json={"kind": ""})).status_code == 400
    async with session_factory() as s:
        rows = (await s.execute(select(CallEvent).where(
            CallEvent.call_id == call_id, CallEvent.event_type == "ClientReport"))).scalars().all()
        assert len(rows) == 1 and rows[0].payload["kind"] == "connect_timeout" and rows[0].payload["by"] == mum.id
