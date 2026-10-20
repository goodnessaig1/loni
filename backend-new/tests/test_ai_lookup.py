"""Hospital hours / phone look-up: parsing, the "never from memory" guarantees, and the chat flow around it."""
import json
from types import SimpleNamespace

import httpx
import pytest

from app.modules.ai_chat import lookup, safety, service as ai_service
from app.modules.ai_chat.triage import Urgency
from app.modules.users.models import StatusEnum
from tests.fakes import FakeDb
from tests.test_ai_chat_flow import FakeLLM

pytestmark = pytest.mark.anyio


# ── the question ─────────────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("text,is_lookup,needs_place", [
    ("What time does kings hospital Abuja become available", True, False),
    ("What time does King's Care Hospital open", True, False),
    ("what is the phone number of Lagos University Teaching Hospital", True, False),
    ("Is there a good clinic in Wuse?", True, False),
    ("what time does Garki Hospital close", True, False),
    ("hospitals near me", True, True),
    ("find me a clinic", True, True),
    ("what time does clinic close", True, True),
    ("I have a headache and pain", False, False),
    ("Which hospital should I choose for delivery?", False, False),
    ("I need to go to hospital because of the bleeding", False, False),
])
def test_detecting_facility_questions(text, is_lookup, needs_place):
    assert lookup.is_facility_lookup(text) is is_lookup
    assert lookup.needs_place(text) is needs_place


def test_query_is_cleaned_and_biased_to_nigeria():
    assert lookup.build_query("hello, What time does Garki Hospital close") == "What time does Garki Hospital close Nigeria"
    assert lookup.build_query("hours of Lagos clinic in Nigeria").endswith("in Nigeria") and "Nigeria Nigeria" not in lookup.build_query("hours of Lagos clinic in Nigeria")
    assert len(lookup.build_query("x" * 500)) <= 210


# ── Google Places + web fallback ─────────────────────────────────────────────────────────────────────

def places_transport(search, details):
    def handler(request: httpx.Request):
        if "textsearch" in request.url.path:
            return httpx.Response(200, json=search)
        if "details" in request.url.path:
            return httpx.Response(200, json=details)
        if "tavily" in request.url.host:
            return httpx.Response(200, json={"results": [{"title": "King's Care Hospital", "url": "https://kings.example/contact", "content": "Call 0916 574 0000. Open daily."}]})
        return httpx.Response(404)
    return httpx.MockTransport(handler)


SEARCH = {"status": "OK", "results": [{"place_id": "p1", "name": "King's Care Hospital", "formatted_address": "Wuse Zone 4, Abuja", "opening_hours": {"open_now": True}}]}
DETAILS = {"status": "OK", "result": {
    "name": "King's Care Hospital", "formatted_address": "Plot 2181, Ibrahim Babangida Way, Wuse Zone 4, Abuja",
    "formatted_phone_number": "0916 574 0000", "url": "https://maps.google.com/?cid=1", "business_status": "OPERATIONAL",
    "opening_hours": {"open_now": True, "periods": [{"open": {"day": 0, "time": "0000"}}], "weekday_text": ["Monday: Open 24 hours"]}}}


async def test_places_result_is_parsed_with_hours_phone_and_24_hour_detection(monkeypatch):
    monkeypatch.setattr(lookup.settings, "GOOGLE_MAPS_API_KEY", "key")
    r = await lookup.lookup("What time does King's Care Hospital Abuja open", transport=places_transport(SEARCH, DETAILS))
    (p,) = r.places
    assert r.found and r.provider == "Google Maps" and p.name == "King's Care Hospital"
    assert p.phone == "0916 574 0000" and p.always_open and p.open_now is True and "Wuse Zone 4" in p.address
    assert r.sources() == [{"title": "King's Care Hospital", "url": "https://maps.google.com/?cid=1", "provider": "Google Maps"}]
    assert r.allowed_numbers() == {"165740000"}
    text = lookup.format_for_model(r)
    assert "open 24 hours" in text and "0916 574 0000" in text
    assert "Google Maps" in lookup.source_footer(r) and "call to confirm" in lookup.source_footer(r)


async def test_ordinary_opening_hours_are_listed_by_day(monkeypatch):
    monkeypatch.setattr(lookup.settings, "GOOGLE_MAPS_API_KEY", "key")
    details = {"status": "OK", "result": {"name": "Garki Hospital", "opening_hours": {
        "open_now": False, "periods": [{"open": {"day": 1, "time": "0800"}, "close": {"day": 1, "time": "1700"}}],
        "weekday_text": ["Monday: 8:00 AM – 5:00 PM", "Tuesday: 8:00 AM – 5:00 PM"]}}}
    r = await lookup.lookup("hours of Garki Hospital", transport=places_transport(SEARCH, details))
    p = r.places[0]
    assert not p.always_open and p.open_now is False and p.phone is None
    txt = lookup.format_for_model(r)
    assert "Monday: 8:00 AM – 5:00 PM" in txt and "Phone: not listed" in txt and "Open right now: no" in txt


async def test_falls_back_to_web_search_when_places_finds_nothing(monkeypatch):
    monkeypatch.setattr(lookup.settings, "GOOGLE_MAPS_API_KEY", "key")
    monkeypatch.setattr(lookup.settings, "WEB_SEARCH_API_KEY", "tkey")
    r = await lookup.lookup("King's Care Hospital phone", transport=places_transport({"status": "ZERO_RESULTS", "results": []}, DETAILS))
    assert r.provider == "web search" and r.snippets[0].url == "https://kings.example/contact" and "165740000" in r.allowed_numbers()
    assert "web search" in lookup.source_footer(r)


async def test_nothing_configured_or_a_failing_provider_returns_an_empty_result_never_raises(monkeypatch):
    monkeypatch.setattr(lookup.settings, "GOOGLE_MAPS_API_KEY", None)
    monkeypatch.setattr(lookup.settings, "WEB_SEARCH_API_KEY", None)
    assert not lookup.configured() and not (await lookup.lookup("hours of Garki Hospital")).found
    monkeypatch.setattr(lookup.settings, "GOOGLE_MAPS_API_KEY", "key")
    broken = httpx.MockTransport(lambda req: (_ for _ in ()).throw(httpx.ConnectError("down")))
    r = await lookup.lookup("hours of Garki Hospital", transport=broken)
    assert not r.found and lookup.source_footer(r) == ""
    denied = httpx.MockTransport(lambda req: httpx.Response(200, json={"status": "REQUEST_DENIED", "error_message": "bad key"}))
    assert not (await lookup.lookup("hours of Garki Hospital", transport=denied)).found


# ── never from memory ────────────────────────────────────────────────────────────────────────────────

def test_a_phone_number_or_hours_claim_that_was_not_looked_up_is_caught():
    invented = "King's Care is open 24/7. Call 0916 574 0000 or 0705 921 0410."
    assert len(safety.validate(Urgency.educational, invented, "other", None)) == 2           # no lookup at all: both flagged
    assert not [n for n in safety.validate(Urgency.educational, "Call 0916 574 0000.", "other", {"165740000"}) if "phone" in n]
    wrong = safety.validate(Urgency.educational, "Call 0705 921 0410.", "other", {"165740000"})
    assert any("double-check any phone number" in n for n in wrong)
    assert not safety.validate(Urgency.educational, "Please call 112 in an emergency.", "other", None)   # the emergency number is not a hospital number
    assert not safety.validate(Urgency.educational, "Pap is a good source of energy.", "other", None)


# ── in the chat ──────────────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def chat(monkeypatch, session_factory):
    db = FakeDb()
    monkeypatch.setattr(ai_service, "get_mongo_db", lambda: db)
    monkeypatch.setattr(ai_service, "AsyncSessionLocal", session_factory)
    holder = SimpleNamespace(llm=FakeLLM(answer=("King's Care Hospital is open 24 hours. ", "Call 0916 574 0000.")), db=db)
    monkeypatch.setattr(ai_service, "_client_and_model", lambda: (holder.llm, "fake"))
    return holder


async def ask(text, user_id="u1", status=StatusEnum.general):
    woman = SimpleNamespace(name="Ngozi Eze", status=status, pregnancy_week=None, pregnancy_start_date=None, baby_age=None)
    events = [json.loads(e[6:]) for e in [x async for x in ai_service.stream_chat_message("s1", user_id, text, woman)] if not e.endswith("[DONE]\n\n")]
    return "".join(e.get("content", "") for e in events), next(e["meta"] for e in events if "meta" in e)


async def test_the_answer_is_built_from_live_results_with_a_source_line(chat, monkeypatch):
    monkeypatch.setattr(lookup.settings, "GOOGLE_MAPS_API_KEY", "key")

    async def fake_lookup(text, **kw):
        return lookup.LookupResult(provider="Google Maps", places=[lookup.Place(
            name="King's Care Hospital", address="Wuse Zone 4, Abuja", phone="0916 574 0000", always_open=True, maps_url="https://maps.example/1")])
    monkeypatch.setattr(lookup, "lookup", fake_lookup)

    content, meta = await ask("What time does King's Care Hospital Abuja open?")
    block = next(m["content"] for m in chat.llm.stream_calls[0] if m["content"].startswith("LOOKUP RESULTS"))
    assert "King's Care Hospital" in block and "0916 574 0000" in block and "open 24 hours" in block
    assert content.endswith("please call to confirm before you go._") and "Source: Google Maps" in content
    assert "double-check any phone number" not in content                       # the number came from the lookup
    saved = [m for m in chat.db["messages"].docs if m["role"] == "assistant"][0]     # sources are stored with the reply
    assert saved["content"] == content
    assert saved["meta"]["sources"] == [{"title": "King's Care Hospital", "url": "https://maps.example/1", "provider": "Google Maps"}]


async def test_a_number_the_model_invents_is_flagged_even_when_a_lookup_happened(chat, monkeypatch):
    monkeypatch.setattr(lookup.settings, "GOOGLE_MAPS_API_KEY", "key")
    chat.llm.answer = ("You can also call 0803 111 2222.",)

    async def fake_lookup(text, **kw):
        return lookup.LookupResult(provider="Google Maps", places=[lookup.Place(name="Garki Hospital", phone="0916 574 0000")])
    monkeypatch.setattr(lookup, "lookup", fake_lookup)
    content, _ = await ask("What is the phone number for Garki Hospital?")
    assert "double-check any phone number" in content


async def test_with_no_lookup_available_the_model_is_told_not_to_guess_and_invented_details_are_caught(chat, monkeypatch):
    monkeypatch.setattr(lookup.settings, "GOOGLE_MAPS_API_KEY", None)
    monkeypatch.setattr(lookup.settings, "WEB_SEARCH_API_KEY", None)
    content, meta = await ask("What time does King's Care Hospital Abuja open?")
    assert any(m["content"].startswith("She asked for a facility's hours") and "live lookup is not available" in m["content"] for m in chat.llm.stream_calls[0])
    assert "sources" not in meta and "Source:" not in content
    assert "I can't confirm phone numbers" in content and "I can't check opening hours" in content        # the model's invented answer is corrected


async def test_nothing_found_and_no_place_given_are_handled_honestly(chat, monkeypatch):
    monkeypatch.setattr(lookup.settings, "GOOGLE_MAPS_API_KEY", "key")
    async def nothing(text, **kw):
        return lookup.LookupResult()
    monkeypatch.setattr(lookup, "lookup", nothing)
    await ask("What time does Garki Hospital close?")
    assert any("found nothing reliable" in m["content"] for m in chat.llm.stream_calls[0])

    chat.llm.stream_calls.clear()
    await ask("hospitals near me")
    last = chat.llm.stream_calls[0]
    assert any("did not say where" in m["content"] for m in last) and not any(m["content"].startswith("LOOKUP RESULTS") for m in last)


async def test_an_emergency_never_waits_for_a_lookup(chat, monkeypatch):
    called = []
    async def spy(text, **kw):
        called.append(text)
        return lookup.LookupResult()
    monkeypatch.setattr(lookup, "lookup", spy)
    monkeypatch.setattr(lookup.settings, "GOOGLE_MAPS_API_KEY", "key")
    content, meta = await ask("I'm bleeding heavily, what time does the hospital open?")
    assert meta["urgency"] == "emergency" and called == [] and chat.llm.stream_calls == []
