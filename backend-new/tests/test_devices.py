"""A phone's push token belongs to the account signed in on it, and stops working for it on sign-out."""
import pytest

from app.core import mongo_db
from app.modules.notifications.service import NotificationService
from tests.fakes import FakeDb

pytestmark = pytest.mark.anyio


@pytest.fixture
def devices(monkeypatch):
    db = FakeDb()
    monkeypatch.setattr(mongo_db, "db", db)
    return db["devices"]


async def test_token_moves_to_whoever_signs_in_and_is_removed_on_sign_out(make_user, as_user, devices):
    nurse, mum = await make_user("Joy"), await make_user("Amara")
    devices.docs.append({"user_id": "old-account", "device_id": "x", "token": "tok-phone-1"})   # legacy duplicate
    body = {"device_id": "TP1A.220624", "device_type": "android", "token": "tok-phone-1"}
    await (await as_user(nurse)).post("/api/v1/notifications/devices", json=body)
    await (await as_user(nurse)).post("/api/v1/notifications/devices", json=body)          # re-register: no duplicate
    assert [(d["user_id"], d["token"]) for d in devices.docs] == [(nurse.id, "tok-phone-1")]

    await (await as_user(mum)).post("/api/v1/notifications/devices", json=body)            # same phone, next account
    assert [d["user_id"] for d in devices.docs] == [mum.id]                                 # nurse no longer rung here

    other_phone = {**body, "token": "tok-phone-2"}                                          # same OS build id, other phone
    await (await as_user(nurse)).post("/api/v1/notifications/devices", json=other_phone)
    assert sorted((d["user_id"], d["token"]) for d in devices.docs) == sorted([(mum.id, "tok-phone-1"), (nurse.id, "tok-phone-2")])

    r = await (await as_user(mum)).post("/api/v1/notifications/devices/unregister", json={"tokens": ["tok-phone-1", "tok-phone-2"]})
    assert r.status_code == 200                                                             # only her own token goes
    assert [(d["user_id"], d["token"]) for d in devices.docs] == [(nurse.id, "tok-phone-2")]
