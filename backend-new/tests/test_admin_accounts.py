"""Admin portal: account lists, details, decisions with reasons, CSV export and the notification feed."""
import pytest

from app.modules.admin.models import AccountReview
from app.modules.calls.models import Call, CallStatusEnum
from app.modules.users.models import AccountStatusEnum, EmergencyContact, EmergencyContactStatus, NurseProfile, StatusEnum, User, UserTypeEnum
from tests.test_admin_staff import API, api, bearer, mail, make_staff, sign_in  # noqa: F401  (fixtures)

pytestmark = pytest.mark.anyio

DOCS = {"photo": "https://res.cloudinary.com/x/photo.jpg", "license": "https://res.cloudinary.com/x/license.pdf",
        "id": "https://res.cloudinary.com/x/id.pdf", "licenseNumber": "RN-2024-08742"}


@pytest.fixture
def seed(session_factory, make_user):
    async def _seed():
        ada = await make_user("Ada Eze")
        chi = await make_user("Chidera Eze")
        aisha = await make_user("Aisha Mohammed")
        bare = await make_user("Bola NoDocs")
        async with session_factory() as s:
            a = await s.get(User, ada.id)
            a.status = StatusEnum.pregnant
            a.account_status = AccountStatusEnum.active
            c = await s.get(User, chi.id)
            c.user_type = UserTypeEnum.partner
            c.account_status = AccountStatusEnum.active
            s.add(EmergencyContact(user_id=ada.id, contact_user_id=chi.id, relationship="Husband",
                                   status=EmergencyContactStatus.connected))
            n = await s.get(User, aisha.id)
            n.user_type = UserTypeEnum.nurse
            s.add(NurseProfile(user_id=aisha.id, years_of_experience=6, hospital_affiliation="National Hospital Abuja",
                               verification_documents=DOCS))
            (await s.get(User, bare.id)).user_type = UserTypeEnum.nurse
            s.add(Call(caller_id=ada.id, receiver_id=aisha.id, status=CallStatusEnum.ENDED, room_name="r1",
                       rating=5, feedback="Very kind", kind="nurse"))
            await s.commit()
        return ada, chi, aisha, bare
    return _seed


async def test_users_list_paginates_searches_and_describes_rows(api, mail, make_staff, seed):
    ada, chi, *_ = await seed()
    await make_staff("ops@lonimum.com", ["users.view"])
    h = bearer(await sign_in(api, mail, "ops@lonimum.com"))
    r = (await api.get(f"{API}/accounts?segment=users&sort=name_asc&page_size=1", headers=h)).json()["data"]
    assert r["total"] == 2 and r["pages"] == 2 and r["counts"] == {"all": 2, "mothers": 1, "partners": 1, "suspended": 0}
    assert r["items"][0]["name"] == "Ada Eze" and r["items"][0]["detail"] == "Pregnant"
    partners = (await api.get(f"{API}/accounts?segment=users&tab=partners", headers=h)).json()["data"]["items"]
    assert partners[0]["detail"] == "Connected to Ada Eze"
    found = (await api.get(f"{API}/accounts?segment=users&q=chidera", headers=h)).json()["data"]
    assert [i["name"] for i in found["items"]] == ["Chidera Eze"]
    assert (await api.get(f"{API}/accounts?segment=nurses", headers=h)).status_code == 403
    assert (await api.get(f"{API}/accounts?segment=users&tab=bogus", headers=h)).status_code == 400


async def test_documents_only_for_kyc_reviewers(api, mail, make_staff, seed):
    _, _, aisha, _ = await seed()
    await make_staff("look@lonimum.com", ["nurses.view"], role_name="Lookers")
    await make_staff("kyc@lonimum.com", ["nurses.view", "kyc.review"], role_name="KYC")
    look = (await api.get(f"{API}/accounts/{aisha.id}", headers=bearer(await sign_in(api, mail, "look@lonimum.com")))).json()["data"]
    assert look["documents"] == [] and look["credentials"]["license_number"] == "RN-2024-08742"
    kyc = (await api.get(f"{API}/accounts/{aisha.id}", headers=bearer(await sign_in(api, mail, "kyc@lonimum.com")))).json()["data"]
    assert {d["key"] for d in kyc["documents"]} == {"photo", "license", "id"}
    reviews = (await api.get(f"{API}/accounts/{aisha.id}/reviews", headers=bearer(await sign_in(api, mail, "kyc@lonimum.com")))).json()["data"]
    assert reviews["items"][0]["author"] == "Ada Eze" and reviews["items"][0]["rating"] == 5


async def test_nurse_review_flow_with_reasons(api, mail, make_staff, seed, session_factory, _no_push):
    _, _, aisha, bare = await seed()
    await make_staff("vo@lonimum.com", ["nurses.view", "nurses.manage"])
    h = bearer(await sign_in(api, mail, "vo@lonimum.com"))
    decide = lambda uid, action, reason=None: api.post(f"{API}/accounts/{uid}/decision", headers=h, json={"action": action, "reason": reason})

    assert (await decide(aisha.id, "request_changes")).status_code == 400  # a reason is required
    assert (await decide(aisha.id, "request_changes", "Licence image is unclear, please re-upload.")).status_code == 200
    row = (await api.get(f"{API}/accounts?segment=nurses&tab=pending", headers=h)).json()["data"]["items"]
    assert any(i["id"] == aisha.id and i["review_state"] == "changes_requested" for i in row)
    assert any(p[3] and p[3].get("type") == "application_changes_requested" for p in _no_push)

    assert (await decide(bare.id, "approve")).status_code == 400  # no credentials submitted
    assert (await decide(bare.id, "reject", "No valid nursing licence.")).status_code == 200
    counts = (await api.get(f"{API}/accounts?segment=nurses", headers=h)).json()["data"]["counts"]
    assert counts["rejected"] == 1 and counts["suspended"] == 0

    assert (await decide(aisha.id, "approve")).status_code == 200
    assert (await decide(aisha.id, "suspend", "Unsafe advice reported by two mothers.")).status_code == 200
    assert (await decide(aisha.id, "reactivate")).status_code == 200
    async with session_factory() as s:
        assert (await s.get(User, aisha.id)).account_status == AccountStatusEnum.active  # was approved before
        reviews = (await s.execute(AccountReview.__table__.select().where(AccountReview.user_id == aisha.id))).all()
    assert [r.action for r in reviews] == ["changes_requested", "approved", "suspended", "reactivated"]
    detail = (await api.get(f"{API}/accounts/{aisha.id}", headers=h)).json()["data"]
    assert detail["history"][1]["reason"] == "Unsafe advice reported by two mothers." and detail["history"][1]["staff_name"]


async def test_viewers_cannot_decide_and_export_needs_permission(api, mail, make_staff, seed):
    ada, *_ = await seed()
    await make_staff("view@lonimum.com", ["users.view"], role_name="Viewer")
    h = bearer(await sign_in(api, mail, "view@lonimum.com"))
    assert (await api.post(f"{API}/accounts/{ada.id}/decision", headers=h, json={"action": "suspend", "reason": "Spam reports"})).status_code == 403
    assert (await api.get(f"{API}/accounts-export?segment=users", headers=h)).status_code == 403

    await make_staff("exp@lonimum.com", ["users.view", "reports.export"], role_name="Exporter")
    r = await api.get(f"{API}/accounts-export?segment=users&sort=name_asc", headers=bearer(await sign_in(api, mail, "exp@lonimum.com")))
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    lines = r.text.strip().splitlines()
    assert lines[0].startswith("id,name,email") and "Ada Eze" in lines[1] and len(lines) == 3


async def test_notifications_follow_permissions_and_read_state(api, mail, make_staff, seed):
    _, _, aisha, _ = await seed()
    await make_staff("boss@lonimum.com", super_admin=True)
    await make_staff("sup@lonimum.com", ["support.manage"], role_name="Support")
    boss = bearer(await sign_in(api, mail, "boss@lonimum.com"))
    assert (await api.post(f"{API}/accounts/{aisha.id}/decision", headers=boss, json={"action": "approve"})).status_code == 200

    feed = (await api.get(f"{API}/notifications", headers=boss)).json()["data"]
    assert feed["unread"] == 1 and feed["items"][0]["category"] == "system" and "approved" in feed["items"][0]["body"]
    sup = bearer(await sign_in(api, mail, "sup@lonimum.com"))
    assert (await api.get(f"{API}/notifications", headers=sup)).json()["data"]["total"] == 0  # nurses.view needed
    assert (await api.post(f"{API}/notifications/{feed['items'][0]['id']}/read", headers=sup)).status_code == 404

    assert (await api.post(f"{API}/notifications/{feed['items'][0]['id']}/read", headers=boss)).status_code == 200
    assert (await api.get(f"{API}/notifications/unread-count", headers=boss)).json()["data"]["unread"] == 0
    assert (await api.get(f"{API}/notifications?tab=unread", headers=boss)).json()["data"]["total"] == 0
