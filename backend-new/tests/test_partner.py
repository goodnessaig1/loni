"""A support partner's timeline of her updates, and leaving the connection."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.modules.notifications.models import NotificationLog
from app.modules.users.models import (
    EmergencyContact, EmergencyContactStatus, StatusEnum, User, UserTypeEnum,
)

pytestmark = pytest.mark.anyio


@pytest.fixture
async def pair(make_user, session_factory):
    mum = await make_user("Amara Ogunleye")
    partner = await make_user("David")
    async with session_factory() as s:
        m = await s.get(User, mum.id)
        m.status = StatusEnum.pregnant
        m.pregnancy_start_date = datetime.now(timezone.utc) - timedelta(weeks=12, days=2)
        p = await s.get(User, partner.id)
        p.user_type = UserTypeEnum.partner
        s.add(EmergencyContact(user_id=mum.id, contact_user_id=partner.id, relationship="Husband",
                               status=EmergencyContactStatus.connected))
        s.add(NotificationLog(user_id=partner.id, type="pregnancy_update", title="t", body="b", data={}))
        await s.commit()
    return mum, partner


async def test_timeline_marks_done_current_and_upcoming(pair, as_user):
    _, partner = pair
    data = (await (await as_user(partner)).get("/api/v1/users/partner-updates")).json()["data"]
    assert data["week"] == 12 and data["shared"] is True
    states = {m["week"]: m["state"] for m in data["milestones"]}
    assert states[4] == "done" and states[max(w for w in states if w <= 12)] == "current"
    assert any(s == "upcoming" for s in states.values())


async def test_timeline_is_empty_when_she_stops_sharing_updates(pair, as_user, session_factory):
    mum, partner = pair
    async with session_factory() as s:
        c = (await s.execute(select(EmergencyContact))).scalars().one()
        c.updates = False
        await s.commit()
    data = (await (await as_user(partner)).get("/api/v1/users/partner-updates")).json()["data"]
    assert data["shared"] is False and data["milestones"] == []


async def test_partner_can_leave_and_she_is_told(pair, as_user, session_factory, monkeypatch):
    from app.modules.users import router as users_router
    monkeypatch.setattr(users_router, "send_partner_removal_user_email", lambda *a, **k: None)
    mum, partner = pair
    r = await (await as_user(partner)).delete("/api/v1/users/partner-connection")
    assert r.status_code == 200
    async with session_factory() as s:
        assert (await s.execute(select(EmergencyContact))).scalars().all() == []
        assert await s.get(User, partner.id) is None
        logs = (await s.execute(select(NotificationLog))).scalars().all()
    assert [(l.user_id, l.type) for l in logs] == [(mum.id, "partner_left")]
    assert (await (await as_user(mum)).delete("/api/v1/users/partner-connection")).status_code == 403
