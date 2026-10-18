"""
Live look-up of a hospital's or clinic's opening hours, address and phone number.

Why this exists: a mother asking "what time does X hospital open?" should get a real answer with a source, not a guess.
A language model that answers from memory will confidently invent hours and phone numbers, which is dangerous when
she is deciding where to go. So the model never answers this from memory:

  1. we detect the question and ask Google Places (and, if configured, a web search) for facts,
  2. the facts are handed to the model in a LOOKUP RESULTS block it is told to use as its only source,
  3. a phone number or a "24 hours" claim that did not come from those results is caught afterwards (safety.py),
  4. a source line is added to the reply by us (not the model) so she can see where it came from.

If nothing is configured or nothing is found, the model is told to say so and to suggest calling the facility.
"""
import logging
import re
from dataclasses import dataclass, field
from typing import List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger("ai.lookup")

_TEXT_SEARCH = "https://maps.googleapis.com/maps/api/place/textsearch/json"
_DETAILS = "https://maps.googleapis.com/maps/api/place/details/json"
_TAVILY = "https://api.tavily.com/search"
TIMEOUT = 6.0


@dataclass
class Place:
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    hours: List[str] = field(default_factory=list)      # "Monday: 8:00 AM – 5:00 PM"
    open_now: Optional[bool] = None
    always_open: bool = False                            # Google lists it as open 24 hours, every day
    maps_url: Optional[str] = None
    website: Optional[str] = None
    status: Optional[str] = None                         # OPERATIONAL / CLOSED_TEMPORARILY / CLOSED_PERMANENTLY


@dataclass
class WebSnippet:
    title: str
    url: str
    text: str


@dataclass
class LookupResult:
    provider: str = ""
    places: List[Place] = field(default_factory=list)
    snippets: List[WebSnippet] = field(default_factory=list)
    note: Optional[str] = None                           # e.g. "needs_place"

    @property
    def found(self) -> bool:
        return bool(self.places or self.snippets)

    def sources(self) -> List[dict]:
        out = [{"title": p.name, "url": p.maps_url, "provider": "Google Maps"} for p in self.places if p.maps_url]
        out += [{"title": s.title, "url": s.url, "provider": "Web"} for s in self.snippets]
        return out

    def allowed_numbers(self) -> set:
        """Phone numbers (digits only, last 9 digits) the model may repeat."""
        nums = set()
        texts = [p.phone or "" for p in self.places] + [s.text for s in self.snippets]
        for t in texts:
            for m in _PHONE.finditer(t):
                nums.add(digits_tail(m.group(0)))
        return nums


# ── detecting the question ───────────────────────────────────────────────────────────────────────────

_FACILITY = re.compile(
    r"\b(?:hospital|hospitals|clinic|clinics|maternity|medical (?:centre|center)|health (?:centre|center)|phc\b|teaching hospital|"
    r"federal medical|fmc\b|general hospital|specialist hospital|pharmacy|chemist|laborator\w+|diagnostic|imaging|scan centre|"
    r"antenatal clinic|birth centre|birthing centre|midwife clinic|womens? (?:centre|center|clinic)|marie stopes|reproductive health|"
    r"gynae\w*|gyn(?:a)?ecolog\w+|obstetric\w*|paediatric\w*|pediatric\w*)\b|\b[A-Z][\w'’\-]+(?: [A-Z][\w'’\-]+){0,3} (?:Hospital|Clinic|Medical Cent(?:re|er)|Maternity)\b", re.I)
_INTENT = re.compile(
    r"\b(?:is there|are there|any good|a good|good (?:clinic|hospital)|best (?:clinic|hospital)|what time|when (?:does|do|is|will|can)|opening (?:hours|times|time)|open(?:s|ing)?\b|clos(?:e|es|ing)|hours?\b|available|availability|"
    r"is (?:it |.{0,40})open|phone|number|contact|call|reach|address|location|located|where (?:is|are|can i find)|directions?|how (?:do i|can i) (?:get|reach)|"
    r"near me|nearby|closest|nearest|find (?:a|me|the)|look(?:ing)? for|recommend)\b", re.I)
_NEAR_ME = re.compile(r"\b(?:near me|nearby|closest|nearest|around me|close to me|around here)\b", re.I)
_PLACE_WORDS = re.compile(
    r"\b(?:in|at|around|within|near|inside)\s+(?!the\b|my\b|me\b|a\b|an\b|this\b|that\b|your\b|our\b|here\b|there\b|general\b|case\b|time\b|morning\b|evening\b|night\b|day\b)[A-Za-z][\w'’\-]{2,}"
    r"|\b(?:lagos|abuja|ibadan|kano|port harcourt|enugu|kaduna|benin|jos|abeokuta|ilorin|owerri|warri|uyo|calabar|akure|osogbo|maiduguri|sokoto|yola|asaba|lekki|ikeja|surulere|yaba|ikoyi|victoria island|gwarinpa|wuse|garki|maitama|asokoro|jabi|kubwa|bodija|mokola|ajah|ikorodu|festac|nigeria)\b", re.I)


def is_facility_lookup(text: str) -> bool:
    """A question about a facility's hours / contact / location (not a symptom question that merely says 'hospital')."""
    t = text or ""
    return bool(_FACILITY.search(t) and _INTENT.search(t))


def needs_place(text: str) -> bool:
    """A facility question with no facility name and no area ('hospitals near me', 'find me a clinic'): we cannot search
    meaningfully, so the AI should ask where she is rather than guess."""
    t = text or ""
    if not is_facility_lookup(t):
        return False
    named = bool(re.search(r"\b[A-Z][\w'’\-]+(?: [A-Z][\w'’\-]+){0,3} (?:Hospital|Clinic|Medical Cent(?:re|er)|Maternity)\b", t))
    return not named and not _PLACE_WORDS.search(re.sub(r"(?i)\bnear me\b", "", t))


def build_query(text: str) -> str:
    q = re.sub(r"\s+", " ", (text or "").strip())[:200]
    q = re.sub(r"(?i)^(?:hi|hello|hey)[,!. ]+", "", q)
    return q if re.search(r"(?i)nigeria", q) else f"{q} Nigeria"


# ── phone numbers ────────────────────────────────────────────────────────────────────────────────────

_PHONE = re.compile(r"(?:\+?234|\b0)[\d\s\-().]{8,16}\d")


def digits_tail(s: str) -> str:
    d = re.sub(r"\D", "", s or "")
    return d[-9:]


# ── Google Places ────────────────────────────────────────────────────────────────────────────────────

def _is_always_open(opening: dict) -> bool:
    periods = (opening or {}).get("periods") or []
    return len(periods) == 1 and not periods[0].get("close") and (periods[0].get("open") or {}).get("time") == "0000"


async def _places(client: httpx.AsyncClient, query: str, limit: int) -> List[Place]:
    key = settings.GOOGLE_MAPS_API_KEY
    resp = await client.get(_TEXT_SEARCH, params={"query": query, "region": "ng", "key": key})
    body = resp.json()
    if body.get("status") not in ("OK", "ZERO_RESULTS"):
        logger.warning("Places text search: %s %s", body.get("status"), body.get("error_message"))
        return []
    out: List[Place] = []
    for r in (body.get("results") or [])[:limit]:
        pid = r.get("place_id")
        place = Place(name=r.get("name", ""), address=r.get("formatted_address"), open_now=(r.get("opening_hours") or {}).get("open_now"),
                      maps_url=f"https://www.google.com/maps/place/?q=place_id:{pid}" if pid else None, status=r.get("business_status"))
        if pid:
            try:
                d = await client.get(_DETAILS, params={
                    "place_id": pid, "key": key, "region": "ng",
                    "fields": "name,formatted_address,formatted_phone_number,international_phone_number,opening_hours,website,url,business_status"})
                det = (d.json() or {}).get("result") or {}
                place.name = det.get("name") or place.name
                place.address = det.get("formatted_address") or place.address
                place.phone = det.get("formatted_phone_number") or det.get("international_phone_number")
                oh = det.get("opening_hours") or {}
                place.hours = list(oh.get("weekday_text") or [])
                if "open_now" in oh:
                    place.open_now = oh["open_now"]
                place.always_open = _is_always_open(oh)
                place.website = det.get("website")
                place.maps_url = det.get("url") or place.maps_url
                place.status = det.get("business_status") or place.status
            except Exception as e:  # details are a bonus; the search result still has a name and address
                logger.warning("Places details failed: %s", e)
        if place.name:
            out.append(place)
    return out


async def _tavily(client: httpx.AsyncClient, query: str, limit: int) -> List[WebSnippet]:
    resp = await client.post(_TAVILY, json={"api_key": settings.WEB_SEARCH_API_KEY, "query": query, "max_results": limit,
                                            "search_depth": "basic", "include_answer": False})
    return [WebSnippet(title=r.get("title") or r.get("url", ""), url=r.get("url", ""), text=(r.get("content") or "")[:600])
            for r in (resp.json().get("results") or [])[:limit] if r.get("url")]


def configured() -> bool:
    return bool(settings.FACILITY_LOOKUP_ENABLED and (settings.GOOGLE_MAPS_API_KEY or settings.WEB_SEARCH_API_KEY))


async def lookup(text: str, *, limit: int = 3, transport: Optional[httpx.AsyncBaseTransport] = None) -> LookupResult:
    """Google Places first (structured hours and phone), then web search if Places had nothing. Never raises."""
    query = build_query(text)
    result = LookupResult()
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, transport=transport) as client:
            if settings.GOOGLE_MAPS_API_KEY:
                result.places = await _places(client, query, limit)
                result.provider = "Google Maps"
            if not result.places and settings.WEB_SEARCH_API_KEY:
                result.snippets = await _tavily(client, query, limit + 1)
                result.provider = "web search"
    except Exception as e:
        logger.warning("Facility lookup failed: %s", e)
    return result


def format_for_model(r: LookupResult) -> str:
    lines: List[str] = []
    for i, p in enumerate(r.places, 1):
        bits = [f"{i}. {p.name}"]
        if p.status and p.status != "OPERATIONAL":
            bits.append(f"status: {p.status.replace('_', ' ').lower()}")
        lines.append(" | ".join(bits))
        lines.append(f"   Address: {p.address or 'not listed'}")
        lines.append(f"   Phone: {p.phone or 'not listed'}")
        if p.always_open:
            lines.append("   Hours: listed as open 24 hours, every day")
        elif p.hours:
            lines.append("   Hours: " + "; ".join(p.hours))
        else:
            lines.append("   Hours: not listed")
        if p.open_now is not None:
            lines.append(f"   Open right now: {'yes' if p.open_now else 'no'} (as listed)")
    for i, s in enumerate(r.snippets, 1):
        lines.append(f"{i}. {s.title} ({s.url})\n   {s.text}")
    return "\n".join(lines)


def source_footer(r: LookupResult) -> str:
    """Added by us, not the model, so the source is always shown and always accurate."""
    if not r.found:
        return ""
    who = "Google Maps" if r.places else "web search"
    return f"\n\n_Source: {who}, checked just now. Hours and numbers can change, so please call to confirm before you go._"
