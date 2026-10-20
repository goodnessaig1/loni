"""Saved settings and contacting support, for every role."""
import pytest
from sqlalchemy import select

from app.modules.account import router as account_router
from app.modules.account.models import SupportMessage

pytestmark = pytest.mark.anyio

API = "/api/v1/account"


async def test_settings_default_then_persist_only_known_keys(make_user, as_user):
    c = await as_user(await make_user("Sarah Chen"))
    prefs = (await c.get(f"{API}/settings")).json()["data"]["prefs"]
    assert prefs["push"] is True and prefs["incoming_calls"] is True and prefs["sms_alerts"] is False

    saved = (await c.put(f"{API}/settings", json={"prefs": {"incoming_calls": False, "made_up": True}})).json()["data"]["prefs"]
    assert saved["incoming_calls"] is False and "made_up" not in saved
    assert (await c.get(f"{API}/settings")).json()["data"]["prefs"]["incoming_calls"] is False


async def test_support_message_is_stored_and_forwarded(make_user, as_user, session_factory, monkeypatch):
    forwarded = []

    async def fake_forward(msg):
        forwarded.append(msg.id)

    monkeypatch.setattr(account_router, "_forward", fake_forward)
    u = await make_user("Sarah Chen")
    c = await as_user(u)
    info = (await c.get(f"{API}/support")).json()["data"]
    assert info["email"] and "Calls" in info["subjects"]

    r = await c.post(f"{API}/support", json={"subject": "Calls", "message": "  The ringtone does not play.  "})
    assert r.status_code == 201
    async with session_factory() as s:
        (m,) = (await s.execute(select(SupportMessage))).scalars().all()
    assert m.user_id == u.id and m.email == u.email and m.message == "The ringtone does not play."
    assert (await c.post(f"{API}/support", json={"subject": "x", "message": "   "})).status_code == 400
