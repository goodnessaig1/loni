"""Finishing an invited partner's account needs the code sent to the invited email."""
import pytest
from sqlalchemy import select

from app.core.security import verify_password
from app.modules.auth import service as auth_service
from app.modules.auth.models import Otp
from app.modules.users.models import EmergencyContact, User, UserTypeEnum

pytestmark = pytest.mark.anyio


@pytest.fixture
async def invited(make_user, session_factory, monkeypatch):
    async def _no_email(*a, **k):
        return None
    monkeypatch.setattr(auth_service, "send_otp_email", _no_email)
    from app.modules.auth import router as auth_router
    monkeypatch.setattr(auth_router, "send_inviter_connection_success_email", _no_email)
    monkeypatch.setattr(auth_router, "send_partner_connection_success_email", _no_email)
    mum = await make_user("Amara")
    partner = await make_user("Invited")
    async with session_factory() as s:
        p = await s.get(User, partner.id)
        p.user_type = UserTypeEnum.partner
        s.add(EmergencyContact(user_id=mum.id, contact_user_id=partner.id, relationship="Husband"))
        await s.commit()
    return partner


async def test_password_only_changes_after_the_emailed_code(invited, as_user, session_factory):
    c = await as_user(invited)
    body = {"email": invited.email, "password": "brand-new-pass", "phone": "+2348012345678", "name": "David Okafor"}
    assert (await c.post("/api/v1/auth/setup-partner", json=body)).status_code == 200
    async with session_factory() as s:
        u = await s.get(User, invited.id)
        assert u.password == "x"                       # unchanged until verified
        code = (await s.execute(select(Otp.otp).where(Otp.email == invited.email))).scalar_one()

    assert (await c.post("/api/v1/auth/verify-partner-setup", json={"email": invited.email, "otp": "0000" if code != "0000" else "1111"})).status_code == 400
    assert (await c.post("/api/v1/auth/verify-partner-setup", json={"email": invited.email, "otp": code})).status_code == 200
    async with session_factory() as s:
        u = await s.get(User, invited.id)
        assert verify_password("brand-new-pass", u.password) and u.phone == "+2348012345678" and u.name == "David Okafor"
        assert (await s.execute(select(EmergencyContact.status))).scalar_one().value == "connected"
        from app.modules.notifications.models import NotificationLog
        mum_id = (await s.execute(select(EmergencyContact.user_id))).scalar_one()
        assert [l.type for l in (await s.execute(select(NotificationLog).where(NotificationLog.user_id == mum_id))).scalars()] == ["partner_connected"]

    # one-time: nobody can use setup again to change the password
    again = await c.post("/api/v1/auth/setup-partner", json={**body, "password": "attacker-pass"})
    assert again.status_code == 409
