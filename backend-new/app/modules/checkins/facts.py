"""
Structured memory: what Loni knows about her, where it came from, and how old it is.

Sits beside `memory.py` (day-level mood/symptom tags). Facts are things worth carrying across days: an open symptom or
worry, medicines, allergies, conditions, an appointment, how she likes to be spoken to.

Rules this module keeps:
* Deterministic extraction from fixed lists. The only free text kept is a sanitised 1-3 word allergy name or preferred
  first name; never her sentence.
* Every fact has a provenance (she said it / a clinician confirmed it / Loni inferred it). Chat-extracted facts are
  `user_reported` because they are her own words; nothing here is ever marked clinician-confirmed automatically.
* Staleness is computed at read time. An old symptom is shown to the model as an older note to ask about, never as current.
* She can list, correct, resolve and delete each fact; "forget everything" removes them all; memory-off stops learning.
"""
import calendar
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy import delete, select

from app.modules.checkins import memory
from app.modules.checkins.models import MemoryFact

KINDS = ("symptom", "concern", "medication", "allergy", "appointment", "condition", "preference")
PROVENANCE = ("user_reported", "clinician_confirmed", "ai_inferred")
PROVENANCE_WORDS = {"user_reported": "she said", "clinician_confirmed": "confirmed by a clinician", "ai_inferred": "Loni's guess, unconfirmed"}

# How long a note is "current" before it becomes an older note to ask about (days).
STALE_AFTER = {"symptom": 3, "concern": 14, "medication": 120, "preference": 3650, "allergy": 3650, "condition": 3650}

CONCERNS: Dict[str, Sequence[str]] = {
    "fear_of_childbirth": (r"(?:scared|afraid|fear(?:ful)?|frightened|terrified|worried|anxious|nervous) (?:of|about) (?:the )?(?:labou?r|delivery|giving birth|childbirth|birth|c-?section|pushing)",
                           r"(?:labou?r|delivery|childbirth|giving birth) (?:scares|frightens|terrifies|worries) me"),
    "not_good_mother": (r"not a good (?:mother|mum|mom)", r"(?:bad|terrible|useless|horrible|worst) (?:mother|mum|mom)", r"fail(?:ing|ed)? as a (?:mother|mum|mom)"),
    "overwhelmed": (r"overwhelm", r"(?:pregnancy|baby|this thing|everything) (?:is |dey )?(?:dealing with|finishing|wearing) me", r"can'?t cope", r"too much for me"),
    "lonely": (r"\blonely\b", r"(?:feel|feeling|i'?m|i am) (?:so |very )?alone\b", r"no one (?:to talk to|understands)"),
    "low_mood": (r"\b(?:depressed|hopeless|empty inside)\b", r"(?:feel|feeling) (?:so |very |really )?(?:low|down|sad) (?:all the time|every day|lately)"),
}
CONCERN_WORDS = {"fear_of_childbirth": "fear of childbirth", "not_good_mother": "worried she isn't a good mother",
                 "overwhelmed": "feeling overwhelmed", "lonely": "feeling lonely", "low_mood": "low mood"}

MEDICATIONS: Dict[str, str] = {
    "folic acid": r"folic",
    "iron supplement": r"\biron\b|fersolate|ferrous|haematinic|hematinic|ranferon|chemiron",
    "prenatal vitamins": r"prenatal vitamin|pregnacare|multivitamin|vitamins?\b",
    "calcium": r"calcium",
    "paracetamol": r"paracetamol|panadol|acetaminophen",
    "low-dose aspirin": r"aspirin",
    "methyldopa": r"methyldopa|aldomet",
    "nifedipine": r"nifedipine",
    "labetalol": r"labetalol",
    "insulin": r"insulin",
    "metformin": r"metformin",
    "antimalarial (IPTp/SP)": r"\bsp\b|fansidar|iptp|sulfadoxine",
    "antimalarial": r"coartem|artemether|lonart|antimalarial|malaria (?:drug|medicine|tablets?)",
    "antibiotics": r"antibiotic|amoxicillin|augmentin|amoxiclav|cefuroxime|metronidazole|flagyl|azithromycin",
    "contraceptive pill": r"(?:contraceptive|birth control) pill|postinor|microgynon",
    "antiretrovirals": r"\barvs?\b|antiretroviral",
}
_MED_CUE = re.compile(r"(?:i'?m|i am|i'?ve been|i have been|been) (?:taking|on|using)|\bi (?:take|use|started)\b|prescribed|(?:doctor|nurse|clinic|hospital|midwife) (?:gave|put|placed|started) me", re.I)

CONDITIONS: Dict[str, str] = {
    "high blood pressure": r"(?:i have|i'?ve got|diagnosed with|i was told i have|history of) (?:high blood pressure|hypertension|\bhbp\b)",
    "pre-eclampsia (before)": r"(?:had|history of) (?:pre-?eclampsia|eclampsia)",
    "diabetes": r"(?:i have|i'?ve got|diagnosed with|history of) (?:gestational )?diabetes",
    "sickle cell": r"(?:i have|i'?m|i am|i'?ve got|my genotype is) (?:sickle cell|ss\b|sc\b)",
    "asthma": r"(?:i have|i'?ve got|diagnosed with) asthma",
    "fibroids": r"(?:i have|i'?ve got|diagnosed with) fibroids?",
    "pcos": r"(?:i have|i'?ve got|diagnosed with) (?:pcos|polycystic)",
    "previous c-section": r"(?:had|have had) (?:a |an )?(?:c-?section|caesarean|cesarean|cs) (?:before|last time|previously|in my last)|previous (?:c-?section|caesarean|cesarean)",
    "previous miscarriage": r"(?:had|have had) (?:a |\d )?miscarriages?|lost (?:a|my) (?:previous )?pregnancy",
    "hiv": r"(?:i'?m|i am|i have|i'?ve got) (?:hiv|living with hiv)|hiv positive",
}

APPOINTMENT_KINDS = (
    ("scan", r"\b(?:scan|ultrasound|sonograph\w*)\b"),
    ("antenatal visit", r"\b(?:antenatal|ante-?natal|anc|booking visit|prenatal (?:visit|appointment|check))\b"),
    ("postnatal check", r"\b(?:postnatal|post-?natal|six[- ]week check|6[- ]week check)\b"),
    ("doctor's appointment", r"\b(?:appointment|check-?up|clinic (?:visit|day|date))\b"),
)
_WEEKDAYS = {d.lower(): i for i, d in enumerate(calendar.day_name)}
_MONTHS = {m.lower(): i for i, m in enumerate(calendar.month_name) if m} | {m.lower(): i for i, m in enumerate(calendar.month_abbr) if m}

_RESOLVED_AFTER = re.compile(r"^\W{0,3}(?:\w+\W+){0,3}?(?:is |has |have |are )?(?:gone|better|stopped|over|cleared|finished|much better|resolved|no more|went away)\b", re.I)
_RESOLVED_BEFORE = re.compile(r"(?:no more|no longer (?:have|having|get|feel)|don'?t have (?:the |any )?|not having (?:the |any )?|got rid of (?:the )?)\s*(?:\w+\s+){0,1}$", re.I)

_ALLERGY = re.compile(r"(?:i'?m|i am) allergic to ([a-z][a-z \-]{1,40})|(?:my )?allerg(?:y|ies) (?:is|are|to) ([a-z][a-z \-]{1,40})", re.I)
_CALL_ME = re.compile(r"(?:please )?call me ([A-Za-z][A-Za-z'\-]{1,20})\b|my name is ([A-Za-z][A-Za-z'\-]{1,20})\b", re.I)
_SHORT = re.compile(r"(?:keep (?:it|your answers|replies) (?:short|brief)|short(?:er)? (?:answers|replies)|too long|be brief)", re.I)
_ASKING = re.compile(r"\b(?:remember|recall|do you know|did i (?:tell|say)|when (?:is|was)|what (?:is|was|did))\b|\?\s*$", re.I)
_STOP = {"and", "but", "so", "the", "a", "an", "my", "it", "is", "please", "too", "also", "since"}
_NOT_A_NAME = {"back", "later", "tomorrow", "today", "tonight", "now", "when", "if", "again", "asap", "sometime", "anytime",
               "please", "soon", "first", "quickly", "maybe", "the", "a", "an", "me", "you", "admin", "system", "loni"}


@dataclass
class Found:
    kind: str
    key: str
    detail: Optional[str] = None
    event_date: Optional[date] = None


def _clean_phrase(raw: str, max_words: int = 3) -> Optional[str]:
    words = [w for w in re.findall(r"[a-z][a-z\-]*", (raw or "").lower())]
    out = []
    for w in words:
        if w in _STOP:
            break
        out.append(w)
        if len(out) == max_words:
            break
    phrase = " ".join(out)[:40]
    return phrase or None


def _parse_when(text: str, today: date) -> Optional[date]:
    t = text.lower()
    if re.search(r"\btoday\b|this morning|this afternoon", t):
        return today
    if re.search(r"\btomorrow\b|\btmrw\b|\btomoro+w\b", t):
        return today + timedelta(days=1)
    if re.search(r"\byesterday\b", t):
        return today - timedelta(days=1)
    m = re.search(r"in (\d{1,2}|two|three|four|five) days", t)
    if m:
        n = {"two": 2, "three": 3, "four": 4, "five": 5}.get(m.group(1)) or int(m.group(1))
        return today + timedelta(days=n)
    m = re.search(r"\b(last|next|this|on)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b", t)
    if m:
        wd = _WEEKDAYS[m.group(2)]
        if m.group(1) == "last":
            back = (today.weekday() - wd) % 7 or 7
            return today - timedelta(days=back)
        ahead = (wd - today.weekday()) % 7 or 7
        return today + timedelta(days=ahead)
    m = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?(?: of)? (jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\b", t) or \
        re.search(r"\b(jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*) (\d{1,2})(?:st|nd|rd|th)?\b", t)
    if m:
        a, b = m.group(1), m.group(2)
        day_s, mon_s = (a, b) if a.isdigit() else (b, a)
        mon = _MONTHS.get(mon_s[:3]) or _MONTHS.get(mon_s)
        try:
            d = date(today.year, mon, int(day_s))
        except (TypeError, ValueError):
            return None
        if (today - d).days > 180:      # "3rd of January" said in December means next year
            d = date(today.year + 1, mon, int(day_s))
        return d
    if re.search(r"next week", t):
        return None  # too vague to store a date; the kind is still noted
    return None


def extract(text: str, today: date) -> Tuple[List[Found], List[str]]:
    """(facts found, symptom keys she says are resolved)."""
    t = (text or "").lower().replace("’", "'")
    found: List[Found] = []

    for s in memory.extract(t).symptoms:
        found.append(Found("symptom", s))

    for key, pats in CONCERNS.items():
        if any(re.search(p, t) for p in pats):
            found.append(Found("concern", key))

    if _MED_CUE.search(t):
        for key, pat in MEDICATIONS.items():
            if re.search(pat, t) and not (key == "antimalarial" and any(f.key == "antimalarial (IPTp/SP)" for f in found)):
                found.append(Found("medication", key))

    for key, pat in CONDITIONS.items():
        if re.search(pat, t):
            found.append(Found("condition", key))

    for m in _ALLERGY.finditer(t):
        name = _clean_phrase(m.group(1) or m.group(2))
        if name:
            found.append(Found("allergy", name))

    asking = _ASKING.search(t)   # "do you remember my appointment?" is a question, not news of an appointment
    for kind, pat in APPOINTMENT_KINDS:
        if not asking and re.search(pat, t) and re.search(r"\b(?:have|had|got|is|was|go(?:ing)? for|went for|booked|next|my)\b", t):
            found.append(Found("appointment", kind, event_date=_parse_when(t, today)))
            break

    m = _CALL_ME.search(text or "")
    if m:
        name = (m.group(1) or m.group(2) or "").strip()
        if name and name.lower() not in _STOP | _NOT_A_NAME:
            found.append(Found("preference", "preferred_name", detail=name[:20].capitalize()))
    if _SHORT.search(t):
        found.append(Found("preference", "short_answers"))

    resolved = []
    for name, patterns in memory._SYMPTOM_RX.items():
        for p in patterns:
            m = p.search(t)
            if m and (_RESOLVED_AFTER.search(t[m.end():m.end() + 30]) or _RESOLVED_BEFORE.search(t[max(0, m.start() - 30):m.start()])):
                resolved.append(name)
                break
    found = [f for f in found if not (f.kind == "symptom" and f.key in resolved)]
    return found, resolved


# ── storage ──────────────────────────────────────────────────────────────────────────────────────────

async def _get(db, user_id: str, kind: str, key: str) -> Optional[MemoryFact]:
    return (await db.execute(select(MemoryFact).where(MemoryFact.user_id == user_id, MemoryFact.kind == kind,
                                                      MemoryFact.key == key))).scalar_one_or_none()


async def learn(db, user_id: str, text: str, today: date) -> List[MemoryFact]:
    """Upsert what this message says. Caller has already checked that she allows memory."""
    found, resolved = extract(text, today)
    changed: List[MemoryFact] = []
    for f in found:
        row = await _get(db, user_id, f.kind, f.key)
        if row is None:
            row = MemoryFact(user_id=user_id, kind=f.kind, key=f.key, detail=f.detail, event_date=f.event_date,
                             provenance="user_reported", status="active", source="chat", first_noted=today, last_noted=today)
            db.add(row)
        else:
            row.last_noted = today
            row.status = "active"
            if f.detail:
                row.detail = f.detail
            if f.event_date:
                row.event_date = f.event_date
            if row.provenance == "ai_inferred":
                row.provenance = "user_reported"   # she has now said it herself
        changed.append(row)
    for key in resolved:
        row = await _get(db, user_id, "symptom", key)
        if row is not None and row.status != "resolved":
            row.status, row.last_noted = "resolved", today
            changed.append(row)
    if changed:
        await db.commit()
    return changed


async def list_facts(db, user_id: str) -> List[MemoryFact]:
    return list((await db.execute(select(MemoryFact).where(MemoryFact.user_id == user_id)
                                  .order_by(MemoryFact.last_noted.desc(), MemoryFact.id.desc()))).scalars().all())


async def add_fact(db, user_id: str, kind: str, key: str, today: date, detail: Optional[str] = None,
                   event_date: Optional[date] = None) -> MemoryFact:
    """She adds something herself in the app: user_reported, source=user."""
    clean = _clean_phrase(key, 4) if kind != "preference" else key.strip().lower()[:60]
    if kind not in KINDS or not clean:
        raise ValueError("Unknown kind or empty value")
    row = await _get(db, user_id, kind, clean)
    if row is None:
        row = MemoryFact(user_id=user_id, kind=kind, key=clean, first_noted=today)
        db.add(row)
    row.detail, row.event_date = (detail or None) and detail[:80], event_date
    row.provenance, row.source, row.status, row.last_noted = "user_reported", "user", "active", today
    await db.commit()
    return row


async def correct_fact(db, user_id: str, fact_id: int, today: date, *, key: Optional[str] = None, detail: Optional[str] = None,
                       event_date: Optional[date] = None, status: Optional[str] = None) -> Optional[MemoryFact]:
    """She fixes what Loni noted. Her correction is her own report, so provenance becomes user_reported."""
    row = await db.get(MemoryFact, fact_id)
    if row is None or row.user_id != user_id:
        return None
    if key is not None:
        clean = _clean_phrase(key, 4)
        if not clean:
            raise ValueError("Empty value")
        clash = await _get(db, user_id, row.kind, clean)
        if clash is not None and clash.id != row.id:
            await db.delete(clash)
        row.key = clean
    if detail is not None:
        row.detail = detail.strip()[:80] or None
    if event_date is not None:
        row.event_date = event_date
    if status is not None:
        if status not in ("active", "resolved"):
            raise ValueError("Unknown status")
        row.status = status
    row.provenance, row.source, row.last_noted = "user_reported", "user", today
    await db.commit()
    return row


async def delete_fact(db, user_id: str, fact_id: int) -> bool:
    row = await db.get(MemoryFact, fact_id)
    if row is None or row.user_id != user_id:
        return False
    await db.delete(row)
    await db.commit()
    return True


async def forget_all(db, user_id: str) -> int:
    res = await db.execute(delete(MemoryFact).where(MemoryFact.user_id == user_id))
    await db.commit()
    return res.rowcount or 0


async def mark_followed_up(db, fact_id: int, now: datetime) -> None:
    row = await db.get(MemoryFact, fact_id)
    if row is not None:
        row.followed_up_at = now
        await db.commit()


# ── reading ──────────────────────────────────────────────────────────────────────────────────────────

def is_stale(f: MemoryFact, today: date) -> bool:
    if f.kind == "appointment":
        return f.event_date is None and (today - f.last_noted).days > 14
    return (today - f.last_noted).days > STALE_AFTER.get(f.kind, 30)


def _age(d: date, today: date) -> str:
    n = (today - d).days
    return "today" if n <= 0 else "yesterday" if n == 1 else f"{n} days ago"


def label(f: MemoryFact) -> str:
    if f.kind == "concern":
        return CONCERN_WORDS.get(f.key, f.key.replace("_", " "))
    if f.kind == "preference":
        return {"preferred_name": f"likes to be called {f.detail}", "short_answers": "prefers short answers"}.get(f.key, f.key.replace("_", " "))
    return f.key


def describe(f: MemoryFact, today: date) -> str:
    """One line for the model (or the nurse summary): what, source, age, and whether it may be out of date."""
    src = PROVENANCE_WORDS.get(f.provenance, f.provenance)
    if f.kind == "appointment":
        if f.event_date is None:
            when = "date not given"
        elif f.event_date < today:
            when = f"was on {f.event_date:%a %d %b} (past: ask how it went, don't assume)"
        elif f.event_date == today:
            when = "is today"
        else:
            when = f"on {f.event_date:%a %d %b}"
        return f"- Appointment: {f.key}, {when} ({src}, noted {_age(f.last_noted, today)})"
    status = ""
    if f.status == "resolved":
        status = f"; she said it got better {_age(f.last_noted, today)}"
    elif is_stale(f, today):
        status = "; OLDER NOTE: may be out of date, ask rather than assume"
    return f"- {f.kind.capitalize()}: {label(f)} ({src}, last mentioned {_age(f.last_noted, today)}{status})"


def context_lines(facts: Sequence[MemoryFact], today: date, limit: int = 10) -> List[str]:
    """For the model. Resolved items older than a week and stale appointments are dropped; current items first."""
    keep = []
    for f in facts:
        if f.status == "resolved" and (today - f.last_noted).days > 7:
            continue
        if f.kind == "appointment" and f.event_date is not None and (today - f.event_date).days > 30:
            continue
        keep.append(f)
    order = {"allergy": 0, "condition": 1, "medication": 2, "appointment": 3, "symptom": 4, "concern": 5, "preference": 6}
    keep.sort(key=lambda f: (is_stale(f, today), order.get(f.kind, 9)))
    return [describe(f, today) for f in keep[:limit]]


FOLLOWUP_KINDS = ("symptom", "concern")


def follow_up_fact(facts: Sequence[MemoryFact], today: date) -> Optional[MemoryFact]:
    """The open concern the next check-in should ask about: active, mentioned 1-3 days ago, not yet followed up since.
    Worries come before symptoms (a fear of childbirth matters more than a backache), newest first."""
    best = None
    for f in facts:
        if f.kind not in FOLLOWUP_KINDS or f.status != "active":
            continue
        age = (today - f.last_noted).days
        if age < 1 or age > 3:
            continue
        if f.followed_up_at is not None and f.followed_up_at.date() >= f.last_noted:
            continue
        rank = (0 if f.kind == "concern" else 1, age)
        if best is None or rank < best[0]:
            best = (rank, f)
    return best[1] if best else None
