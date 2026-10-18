"""Mother <-> partner: each side hears about the other's changes, and updates arrive without opening the app."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.modules.notifications.models import NotificationLog
from app.modules.users import partner_sync
from app.modules.users.models import EmergencyContact, EmergencyContactStatus, StatusEnum, User, UserTypeEnum

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def live(monkeypatch):
    """(user_id, event) for every live WebSocket event sent."""
    out = []

    async def _ws(user_id, event, data):
        out.append((user_id, event))
        return True

    monkeypatch.setattr(partner_sync.ws_manager, "send_to_user", _ws)
    return out


@pytest.fixture
async def pair(make_user, session_factory):
    mum = await make_user("Amara Ogunleye")
    partner = await make_user("David")
    async with session_factory() as s:
        m = await s.get(User, mum.id)
        m.status = StatusEnum.pregnant
        m.pregnancy_start_date = datetime.now(timezone.utc) - timedelta(weeks=12, days=1)
        (await s.get(User, partner.id)).user_type = UserTypeEnum.partner
        c = EmergencyContact(user_id=mum.id, contact_user_id=partner.id, relationship="Husband",
                             status=EmergencyContactStatus.connected)
        s.add(c)
        await s.commit()
        return mum, partner, c.id


async def logs(session_factory, user_id, type_=None):
    async with session_factory() as s:
        q = select(NotificationLog).where(NotificationLog.user_id == user_id)
        if type_:
            q = q.where(NotificationLog.type == type_)
        return (await s.execute(q)).scalars().all()


async def test_sweep_delivers_each_milestone_once_without_the_partner_opening_the_app(pair, session_factory, live, _no_push):
    mum, partner, _ = pair
    async with session_factory() as s:
        assert await partner_sync.sweep(s) == 1
        assert await partner_sync.sweep(s) == 0          # once per milestone
    (log,) = await logs(session_factory, partner.id, "pregnancy_update")
    assert log.data["week"] == 12 and log.data["stage"] == "pregnant"
    assert (partner.id, "pregnancy_update") in live
    assert any(u == partner.id for u, *_ in _no_push)


async def test_sharing_changes_reach_the_partner(pair, as_user, session_factory, live):
    mum, partner, cid = pair
    r = await (await as_user(mum)).patch(f"/api/v1/users/emergency-contacts/{cid}/permissions", json={"location": False})
    assert r.status_code == 200
    (log,) = await logs(session_factory, partner.id, "partner_sharing_changed")
    assert "stopped sharing her location" in log.body and log.data["sharing"]["location"] is False
    assert (partner.id, "partner_sharing_changed") in live
    # no change, no noise
    await (await as_user(mum)).patch(f"/api/v1/users/emergency-contacts/{cid}/permissions", json={"location": False})
    assert len(await logs(session_factory, partner.id, "partner_sharing_changed")) == 1


async def test_turning_updates_back_on_sends_the_current_milestone(pair, as_user, session_factory):
    mum, partner, cid = pair
    c = await as_user(mum)
    await c.patch(f"/api/v1/users/emergency-contacts/{cid}/permissions", json={"updates": False})
    assert await logs(session_factory, partner.id, "pregnancy_update") == []
    await c.patch(f"/api/v1/users/emergency-contacts/{cid}/permissions", json={"updates": True})
    assert len(await logs(session_factory, partner.id, "pregnancy_update")) == 1


async def test_stage_change_tells_partners_and_restarts_milestones(pair, as_user, session_factory):
    mum, partner, _ = pair
    async with session_factory() as s:
        await partner_sync.sweep(s)
    r = await (await as_user(mum)).patch("/api/v1/users/stage", json={"status": "newMom"})
    assert r.status_code == 200
    (changed,) = await logs(session_factory, partner.id, "partner_stage_changed")
    assert "recovery" in changed.body
    stages = {l.data.get("stage") for l in await logs(session_factory, partner.id, "pregnancy_update")}
    assert stages == {"pregnant", "newMom"}           # a recovery update, not swallowed by the old week


async def test_removed_partner_is_told_live_before_the_account_goes(pair, as_user, live, monkeypatch):
    from app.modules.users import router as users_router
    monkeypatch.setattr(users_router, "send_partner_removal_user_email", lambda *a, **k: None)
    monkeypatch.setattr(users_router, "send_partner_removal_partner_email", lambda *a, **k: None)
    mum, partner, cid = pair
    assert (await (await as_user(mum)).delete(f"/api/v1/users/emergency-contacts/{cid}")).status_code == 200
    assert (partner.id, "partner_removed") in live


async def test_partner_leaving_reaches_her_live(pair, as_user, session_factory, live, monkeypatch):
    from app.modules.users import router as users_router
    monkeypatch.setattr(users_router, "send_partner_removal_user_email", lambda *a, **k: None)
    mum, partner, _ = pair
    await (await as_user(partner)).delete("/api/v1/users/partner-connection")
    assert (mum.id, "partner_left") in live
    assert len(await logs(session_factory, mum.id, "partner_left")) == 1
