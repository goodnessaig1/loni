"""Admin portal: staff sign-in with a second factor, sessions, and role-based access control."""
import time

import httpx
import pytest

from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app as fastapi_app
from app.modules.staff import security as sec
from app.modules.staff import service
from app.modules.staff.models import Staff, StaffAuditLog, StaffRole, StaffStatusEnum
from app.modules.users.models import AccountStatusEnum, User, UserTypeEnum

pytestmark = pytest.mark.anyio

PASSWORD = "Correct-Horse-42"
API = "/api/v1/admin"


@pytest.fixture
async def api(session_factory):
    async def _db():
        async with session_factory() as s:
            yield s
    fastapi_app.dependency_overrides[get_db] = _db
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=fastapi_app), base_url="http://test") as c:
        yield c
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def mail(monkeypatch):
    """Captures what would be emailed: sign-in codes, invite and reset links."""
    box = {"codes": [], "invites": [], "resets": []}
    monkeypatch.setattr(service, "send_login_code", lambda staff, code: box["codes"].append(code))
    monkeypatch.setattr(service, "send_invite", lambda staff, inviter, token: box["invites"].append(token))
    monkeypatch.setattr(service, "send_reset", lambda staff, token: box["resets"].append(token))
    return box


@pytest.fixture
def make_staff(session_factory):
    async def _make(email, permissions=None, super_admin=False, status=StaffStatusEnum.active, role_name=None):
        async with session_factory() as s:
            role = None
            if permissions is not None:
                role = StaffRole(name=role_name or f"role-{email}", permissions=permissions)
                s.add(role)
                await s.flush()
            staff = Staff(id=email[:12].replace("@", "_"), email=email, name="Test Person",
                          password_hash=get_password_hash(PASSWORD), status=status,
                          is_super_admin=super_admin, role_id=role.id if role else None)
            s.add(staff)
            await s.commit()
            return staff
    return _make


async def sign_in(api, mail, email, password=PASSWORD):
    r = await api.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    challenge = r.json()
    r = await api.post(f"{API}/auth/mfa/verify", json={"challenge_token": challenge["challenge_token"], "code": mail["codes"][-1]})
    assert r.status_code == 200, r.text
    return r.json()


def bearer(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def test_password_alone_is_not_enough_a_code_is_required(api, mail, make_staff):
    await make_staff("ops@lonimum.com", ["dashboard.view"])
    r = await api.post(f"{API}/auth/login", json={"email": "OPS@lonimum.com", "password": PASSWORD})
    assert r.status_code == 200
    body = r.json()
    assert body["method"] == "email" and "access_token" not in body
    assert body["email_hint"].startswith("op") and "@lonimum.com" in body["email_hint"]

    # The challenge token is not a session.
    assert (await api.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {body['challenge_token']}"})).status_code == 401

    bad = await api.post(f"{API}/auth/mfa/verify", json={"challenge_token": body["challenge_token"], "code": "000000" if mail["codes"][-1] != "000000" else "111111"})
    assert bad.status_code == 400

    ok = await api.post(f"{API}/auth/mfa/verify", json={"challenge_token": body["challenge_token"], "code": mail["codes"][-1]})
    assert ok.status_code == 200
    me = await api.get(f"{API}/auth/me", headers=bearer(ok.json()))
    assert me.status_code == 200 and me.json()["permissions"] == ["dashboard.view"]

    # A challenge works once.
    again = await api.post(f"{API}/auth/mfa/verify", json={"challenge_token": body["challenge_token"], "code": mail["codes"][-1]})
    assert again.status_code == 401


async def test_wrong_codes_end_the_challenge(api, mail, make_staff):
    await make_staff("ada@lonimum.com", [])
    token = (await api.post(f"{API}/auth/login", json={"email": "ada@lonimum.com", "password": PASSWORD})).json()["challenge_token"]
    wrong = "123456" if mail["codes"][-1] != "123456" else "654321"
    for _ in range(4):
        assert (await api.post(f"{API}/auth/mfa/verify", json={"challenge_token": token, "code": wrong})).status_code == 400
    assert (await api.post(f"{API}/auth/mfa/verify", json={"challenge_token": token, "code": wrong})).status_code == 401
    # Even the right code is refused now.
    assert (await api.post(f"{API}/auth/mfa/verify", json={"challenge_token": token, "code": mail["codes"][-1]})).status_code == 401


async def test_unknown_email_and_wrong_password_look_the_same_and_lock_out(api, mail, make_staff, session_factory):
    await make_staff("bola@lonimum.com", [])
    unknown = await api.post(f"{API}/auth/login", json={"email": "nobody@lonimum.com", "password": PASSWORD})
    wrong = await api.post(f"{API}/auth/login", json={"email": "bola@lonimum.com", "password": "Wrong-pass-123"})
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["message"] == wrong.json()["message"]

    for _ in range(4):
        await api.post(f"{API}/auth/login", json={"email": "bola@lonimum.com", "password": "Wrong-pass-123"})
    locked = await api.post(f"{API}/auth/login", json={"email": "bola@lonimum.com", "password": PASSWORD})
    assert locked.status_code == 429
    async with session_factory() as s:
        actions = [a.action for a in (await s.execute(StaffAuditLog.__table__.select())).all()]
    assert actions.count("login.failed") == 6


async def test_suspended_and_invited_staff_cannot_sign_in(api, mail, make_staff):
    await make_staff("sus@lonimum.com", [], status=StaffStatusEnum.suspended)
    assert (await api.post(f"{API}/auth/login", json={"email": "sus@lonimum.com", "password": PASSWORD})).status_code == 403
    await make_staff("inv@lonimum.com", [], status=StaffStatusEnum.invited)
    assert (await api.post(f"{API}/auth/login", json={"email": "inv@lonimum.com", "password": PASSWORD})).status_code == 401


async def test_app_user_tokens_never_work_on_the_admin_api(api, make_user, session_factory):
    mum = await make_user("Ada Mum")
    async with session_factory() as s:
        u = await s.get(User, mum.id)
        u.user_type = UserTypeEnum.admin  # even a legacy "admin" app account
        await s.commit()
    headers = {"Authorization": f"Bearer {create_access_token(mum.id)}"}
    assert (await api.get(f"{API}/auth/me", headers=headers)).status_code == 401
    assert (await api.get(f"{API}/users", headers=headers)).status_code == 401
    assert (await api.get(f"{API}/overview", headers=headers)).status_code == 401


async def test_permissions_are_enforced_per_endpoint(api, mail, make_staff, make_user, session_factory):
    await make_staff("view@lonimum.com", ["dashboard.view", "users.view", "nurses.manage"])
    tokens = await sign_in(api, mail, "view@lonimum.com")
    h = bearer(tokens)
    assert (await api.get(f"{API}/overview", headers=h)).status_code == 200
    assert (await api.get(f"{API}/users", headers=h)).status_code == 200
    assert (await api.get(f"{API}/users?user_type=driver", headers=h)).status_code == 403
    assert (await api.get(f"{API}/staff", headers=h)).status_code == 403
    assert (await api.get(f"{API}/audit-logs", headers=h)).status_code == 403

    nurse = await make_user("Nurse Joy")
    driver = await make_user("Driver Dan")
    async with session_factory() as s:
        (await s.get(User, nurse.id)).user_type = UserTypeEnum.nurse
        (await s.get(User, driver.id)).user_type = UserTypeEnum.driver
        await s.commit()
    assert (await api.patch(f"{API}/users/{nurse.id}/status", headers=h, json={"status": "active"})).status_code == 200
    assert (await api.patch(f"{API}/users/{driver.id}/status", headers=h, json={"status": "active"})).status_code == 403
    async with session_factory() as s:
        assert (await s.get(User, nurse.id)).account_status == AccountStatusEnum.active
        assert (await s.get(User, driver.id)).account_status != AccountStatusEnum.active


async def test_removing_a_permission_takes_effect_on_the_next_request(api, mail, make_staff, session_factory):
    await make_staff("rm@lonimum.com", ["dashboard.view"], role_name="Shrinking")
    h = bearer(await sign_in(api, mail, "rm@lonimum.com"))
    assert (await api.get(f"{API}/overview", headers=h)).status_code == 200
    async with session_factory() as s:
        role = (await s.execute(StaffRole.__table__.select().where(StaffRole.name == "Shrinking"))).first()
        r = await s.get(StaffRole, role.id)
        r.permissions = []
        await s.commit()
    assert (await api.get(f"{API}/overview", headers=h)).status_code == 403


async def test_super_admin_invites_staff_who_sets_a_password_and_signs_in(api, mail, make_staff):
    await make_staff("root@lonimum.com", super_admin=True)
    h = bearer(await sign_in(api, mail, "root@lonimum.com"))
    role = (await api.post(f"{API}/roles", headers=h, json={"name": "Support", "permissions": ["dashboard.view", "support.manage"]})).json()
    r = await api.post(f"{API}/staff", headers=h, json={"email": "New.Person@lonimum.com", "name": "New  Person", "role_id": role["id"]})
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "invited" and r.json()["email"] == "new.person@lonimum.com"
    assert (await api.post(f"{API}/staff", headers=h, json={"email": "new.person@lonimum.com", "name": "Dup", "role_id": role["id"]})).status_code == 409

    token = mail["invites"][-1]
    info = await api.post(f"{API}/auth/invite/inspect", json={"token": token})
    assert info.json()["data"]["role"] == "Support"
    weak = await api.post(f"{API}/auth/invite/accept", json={"token": token, "password": "short"})
    assert weak.status_code == 400
    assert (await api.post(f"{API}/auth/invite/accept", json={"token": token, "password": PASSWORD})).status_code == 200
    assert (await api.post(f"{API}/auth/invite/accept", json={"token": token, "password": PASSWORD})).status_code == 400

    me = await api.get(f"{API}/auth/me", headers=bearer(await sign_in(api, mail, "new.person@lonimum.com")))
    assert me.json()["permissions"] == ["dashboard.view", "support.manage"] and not me.json()["is_super_admin"]


async def test_limited_admins_cannot_escalate(api, mail, make_staff, session_factory):
    await make_staff("lead@lonimum.com", ["staff.view", "staff.manage", "roles.manage", "dashboard.view"], role_name="Lead")
    root = await make_staff("root2@lonimum.com", super_admin=True)
    h = bearer(await sign_in(api, mail, "lead@lonimum.com"))

    # Can't create a role with permissions they don't have.
    assert (await api.post(f"{API}/roles", headers=h, json={"name": "Money", "permissions": ["payments.manage"]})).status_code == 403
    assert (await api.post(f"{API}/roles", headers=h, json={"name": "Typo", "permissions": ["everything"]})).status_code == 400
    ok = await api.post(f"{API}/roles", headers=h, json={"name": "Viewer", "permissions": ["dashboard.view"]})
    assert ok.status_code == 201
    # Can't edit their own role, nor change a super admin, nor change themselves.
    async with session_factory() as s:
        lead_role_id = (await s.get(Staff, "lead_lonimum")).role_id
    assert (await api.patch(f"{API}/roles/{lead_role_id}", headers=h, json={"permissions": list(sec_all())})).status_code == 403
    assert (await api.patch(f"{API}/staff/{root.id}", headers=h, json={"status": "suspended"})).status_code == 403
    assert (await api.patch(f"{API}/staff/lead_lonimum", headers=h, json={"role_id": ok.json()["id"]})).status_code == 403
    # Can't hand out a role more powerful than their own.
    async with session_factory() as s:
        big = StaffRole(name="Big", permissions=["payments.manage"])
        s.add(big)
        await s.commit()
        big_id = big.id
    assert (await api.post(f"{API}/staff", headers=h, json={"email": "x@lonimum.com", "name": "X Person", "role_id": big_id})).status_code == 403


def sec_all():
    from app.modules.staff.permissions import ALL
    return ALL


async def test_refresh_rotates_and_a_reused_token_ends_the_session(api, mail, make_staff, monkeypatch):
    await make_staff("rot@lonimum.com", ["dashboard.view"])
    first = await sign_in(api, mail, "rot@lonimum.com")
    second = await api.post(f"{API}/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert second.status_code == 200
    assert second.json()["refresh_token"] != first["refresh_token"]
    # Parallel requests refreshing together: the old token still works for a few seconds, without rotating again.
    racing = await api.post(f"{API}/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert racing.status_code == 200 and racing.json()["refresh_token"] is None
    # After the grace window, replaying the old token ends the whole session, including the new token.
    monkeypatch.setattr(service, "REFRESH_GRACE_SECONDS", -1)
    assert (await api.post(f"{API}/auth/refresh", json={"refresh_token": first["refresh_token"]})).status_code == 401
    assert (await api.post(f"{API}/auth/refresh", json={"refresh_token": second.json()["refresh_token"]})).status_code == 401
    assert (await api.get(f"{API}/auth/me", headers=bearer(second.json()))).status_code == 401


async def test_logout_and_suspension_end_sessions_immediately(api, mail, make_staff):
    await make_staff("boss@lonimum.com", super_admin=True)
    await make_staff("temp@lonimum.com", ["dashboard.view"])
    boss = bearer(await sign_in(api, mail, "boss@lonimum.com"))
    temp_tokens = await sign_in(api, mail, "temp@lonimum.com")
    assert (await api.get(f"{API}/auth/me", headers=bearer(temp_tokens))).status_code == 200
    assert (await api.patch(f"{API}/staff/temp_lonimum", headers=boss, json={"status": "suspended"})).status_code == 200
    assert (await api.get(f"{API}/auth/me", headers=bearer(temp_tokens))).status_code == 401
    assert (await api.post(f"{API}/auth/refresh", json={"refresh_token": temp_tokens["refresh_token"]})).status_code == 401

    assert (await api.post(f"{API}/auth/logout", headers=boss)).status_code == 200
    assert (await api.get(f"{API}/auth/me", headers=boss)).status_code == 401


async def test_authenticator_app_replaces_email_codes(api, mail, make_staff):
    await make_staff("totp@lonimum.com", ["dashboard.view"])
    h = bearer(await sign_in(api, mail, "totp@lonimum.com"))
    setup = (await api.post(f"{API}/auth/totp/setup", headers=h)).json()
    assert setup["otpauth_uri"].startswith("otpauth://totp/")
    code = sec._hotp(setup["secret"], int(time.time() // 30))
    assert (await api.post(f"{API}/auth/totp/enable", headers=h, json={"code": code})).status_code == 200

    sent_before = len(mail["codes"])
    challenge = (await api.post(f"{API}/auth/login", json={"email": "totp@lonimum.com", "password": PASSWORD})).json()
    assert challenge["method"] == "totp" and len(mail["codes"]) == sent_before
    # The code used to turn it on can't be replayed.
    assert (await api.post(f"{API}/auth/mfa/verify", json={"challenge_token": challenge["challenge_token"], "code": code})).status_code == 400
    nxt = sec._hotp(setup["secret"], int(time.time() // 30) + 1)
    assert (await api.post(f"{API}/auth/mfa/verify", json={"challenge_token": challenge["challenge_token"], "code": nxt})).status_code == 200


@pytest.mark.filterwarnings("ignore")
def test_totp_matches_rfc_6238_vectors():
    secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"  # base32("12345678901234567890")
    assert sec.verify_totp(secret, "287082", at=59) is not None
    assert sec.verify_totp(secret, "081804", at=1111111109) is not None
    assert sec.verify_totp(secret, "081804", last_counter=1111111109 // 30, at=1111111109) is None


async def test_forgot_password_does_not_reveal_accounts_and_reset_signs_out(api, mail, make_staff):
    await make_staff("fp@lonimum.com", [])
    a = await api.post(f"{API}/auth/password/forgot", json={"email": "fp@lonimum.com"})
    b = await api.post(f"{API}/auth/password/forgot", json={"email": "ghost@lonimum.com"})
    assert a.json() == b.json() and len(mail["resets"]) == 1
    new = "Another-Strong-77"
    assert (await api.post(f"{API}/auth/password/reset", json={"token": mail["resets"][0], "password": new})).status_code == 200
    assert (await api.post(f"{API}/auth/login", json={"email": "fp@lonimum.com", "password": PASSWORD})).status_code == 401
    assert (await api.post(f"{API}/auth/login", json={"email": "fp@lonimum.com", "password": new})).status_code == 200


async def test_overview_numbers(api, mail, make_staff, make_user, session_factory):
    await make_staff("dash@lonimum.com", ["dashboard.view"])
    await make_user("Mum One")
    nurse = await make_user("Nurse Pending")
    async with session_factory() as s:
        n = await s.get(User, nurse.id)
        n.user_type = UserTypeEnum.nurse
        n.account_status = AccountStatusEnum.pending
        await s.commit()
    r = await api.get(f"{API}/overview?days=7", headers=bearer(await sign_in(api, mail, "dash@lonimum.com")))
    data = r.json()["data"]
    assert data["cards"]["total_users"]["value"] == 1
    assert data["cards"]["approved_nurses"]["pending"] == 1
    assert len(data["series"]) == 7 and data["series"][-1]["registrations"] >= 1


def test_every_admin_route_requires_a_staff_permission():
    """No /admin route may be reachable without staff auth, except the sign-in steps themselves."""
    from fastapi.routing import APIRoute
    public = {"/api/v1/admin/auth/login", "/api/v1/admin/auth/mfa/verify", "/api/v1/admin/auth/mfa/resend",
              "/api/v1/admin/auth/refresh", "/api/v1/admin/auth/invite/inspect", "/api/v1/admin/auth/invite/accept",
              "/api/v1/admin/auth/password/forgot", "/api/v1/admin/auth/password/reset"}

    def deps(dependant):
        for d in dependant.dependencies:
            yield d.call
            yield from deps(d)

    from app.modules.staff.deps import get_current_staff
    for route in fastapi_app.routes:
        if isinstance(route, APIRoute) and "/admin" in route.path and route.path not in public:
            assert get_current_staff in set(deps(route.dependant)), route.path
