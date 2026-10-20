import pytest

from app.modules.users.models import StatusEnum, User

pytestmark = pytest.mark.anyio


async def _set(session_factory, user, **fields):
    async with session_factory() as s:
        u = await s.get(User, user.id)
        for k, v in fields.items():
            setattr(u, k, v)
        await s.commit()


async def test_pick_trimester_moves_the_week_and_survives_a_reload(make_user, as_user, session_factory):
    user = await make_user("Ada One")
    await _set(session_factory, user, status=StatusEnum.pregnant, pregnancy_week="18 weeks")
    c = await as_user(user)

    r = await c.patch("/api/v1/users/stage", json={"trimester": 3})
    assert r.status_code == 200
    u = r.json()["data"]["user"]
    assert u["trimester"] == "3rd Trimester" and u["pregnancyWeek"] == "28 weeks"

    me = (await c.get("/api/v1/users/me")).json()["data"]["user"]  # the live recompute must agree
    assert me["trimester"] == "3rd Trimester" and me["pregnancyWeek"] == "28 weeks"


async def test_trimester_keeps_week_when_already_inside_it(make_user, as_user, session_factory):
    user = await make_user("Ada One")
    await _set(session_factory, user, status=StatusEnum.pregnant, pregnancy_week="20 weeks")
    c = await as_user(user)
    u = (await c.patch("/api/v1/users/stage", json={"trimester": 2})).json()["data"]["user"]
    assert u["pregnancyWeek"] == "20 weeks"


async def test_switch_to_postpartum_and_pick_recovery_stage(make_user, as_user, session_factory):
    user = await make_user("Ada One")
    await _set(session_factory, user, status=StatusEnum.pregnant, pregnancy_week="30 weeks")
    c = await as_user(user)

    u = (await c.patch("/api/v1/users/stage", json={"status": "newMom"})).json()["data"]["user"]
    assert u["status"] == "newMom" and u["babyAge"] == "1"

    u = (await c.patch("/api/v1/users/stage", json={"recovery_stage": "extended"})).json()["data"]["user"]
    assert u["babyAge"] == "13" and u["trimester"] == "Ongoing"

    back = (await c.patch("/api/v1/users/stage", json={"status": "pregnant"})).json()["data"]["user"]
    assert back["status"] == "pregnant" and back["pregnancyWeek"] == "1 weeks"  # old snapshot was cleared


async def test_validation(make_user, as_user):
    c = await as_user(await make_user("Ada One"))
    assert (await c.patch("/api/v1/users/stage", json={})).status_code == 400
    assert (await c.patch("/api/v1/users/stage", json={"trimester": 4})).status_code == 400
    assert (await c.patch("/api/v1/users/stage", json={"recovery_stage": "late"})).status_code == 400
