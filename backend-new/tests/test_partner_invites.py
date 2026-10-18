"""A mother can resend or revoke an invite her partner hasn't accepted yet."""
import pytest
from sqlalchemy import select

from app.modules.users import router as users_router
from app.modules.users.models import EmergencyContact, EmergencyContactStatus, User, UserTypeEnum

pytestmark = pytest.mark.anyio


@pytest.fixture
def emails(monkeypatch):
    sent = []
    monkeypatch.setattr(users_router, "send_partner_invite_email", lambda *a: sent.append(("invite", a[0])))
    monkeypatch.setattr(users_router, "send_partner_removal_user_email", lambda *a: sent.append(("removed_user", a[0])))
    monkeypatch.setattr(users_router, "send_partner_removal_partner_email", lambda *a: sent.append(("removed_partner", a[0])))
    return sent


async def _invite(make_user, session_factory, status=EmergencyContactStatus.pending):
    mum, partner = await make_user("Amara"), await make_user("David")
    async with session_factory() as s:
        (await s.get(User, partner.id)).user_type = UserTypeEnum.partner
        c = EmergencyContact(user_id=mum.id, contact_user_id=partner.id, relationship="Husband", status=status)
        s.add(c)
        await s.commit()
        return mum, partner, c.id


async def test_resend_goes_to_a_pending_partner_once_a_minute(make_user, session_factory, as_user, emails):
    mum, partner, cid = await _invite(make_user, session_factory)
    c = await as_user(mum)
    r = await c.post(f"/api/v1/users/emergency-contacts/{cid}/resend-invite")
    assert r.status_code == 200 and emails == [("invite", partner.email)]
    assert (await c.post(f"/api/v1/users/emergency-contacts/{cid}/resend-invite")).status_code == 429


async def test_no_resend_once_connected_or_for_someone_else(make_user, session_factory, as_user, emails):
    mum, _, cid = await _invite(make_user, session_factory, EmergencyContactStatus.connected)
    assert (await (await as_user(mum)).post(f"/api/v1/users/emergency-contacts/{cid}/resend-invite")).status_code == 409
    stranger = await make_user("Eve")
    assert (await (await as_user(stranger)).post(f"/api/v1/users/emergency-contacts/{cid}/resend-invite")).status_code == 404
    assert emails == []


async def test_revoking_a_pending_invite_sends_no_removal_emails(make_user, session_factory, as_user, emails):
    mum, partner, cid = await _invite(make_user, session_factory)
    r = await (await as_user(mum)).delete(f"/api/v1/users/emergency-contacts/{cid}")
    assert r.status_code == 200 and r.json()["message"] == "Invite revoked"
    assert emails == []
    async with session_factory() as s:
        assert (await s.execute(select(EmergencyContact))).scalars().all() == []
        assert await s.get(User, partner.id) is None        # can be invited again with the same email
