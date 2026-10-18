"""
Loni's memory of her day.

What is kept: a mood score, a few symptom/topic TAGS from a fixed list, and the date. What is never kept: her words.
Extraction is deliberate keyword matching (fast, predictable, testable, nothing leaves the server); a tag only exists if
it matches the fixed lists below, so nothing she typed can ever be echoed back at her.

How it is used:
* the AI is told, in one short block, what she mentioned recently, so the chat feels continuous;
* the next hello can open with "how's the headache?" instead of a generic greeting;
* a run of low days raises her care level (policy.care_level).
She can read it, delete it, and switch it off.
"""
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional, Sequence

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.modules.checkins.models import CheckinPreference, WellbeingNote

# Canonical symptom -> phrases that mean it.
SYMPTOMS: Dict[str, Sequence[str]] = {
    "headache": (r"head ?ache", r"migraine", r"head (?:is )?(?:pounding|hurting|aching)"),
    "nausea": (r"nause(?:a|ous)", r"queas", r"feel(?:ing)? sick", r"morning sickness"),
    "vomiting": (r"vomit", r"throwing up", r"throw up"),
    "back pain": (r"back ?ache", r"back pain", r"(?:my )?back (?:is )?(?:hurting|aching|paining)", r"lower back"),
    "cramps": (r"cramp", r"period pain", r"menstrual pain"),
    "spotting": (r"spotting",),
    "swelling": (r"swell", r"swollen", r"puffy"),
    "dizziness": (r"dizz", r"light-?headed"),
    "heartburn": (r"heartburn", r"acid reflux", r"indigestion"),
    "trouble sleeping": (r"insomnia", r"can'?t sleep", r"cannot sleep", r"not sleeping", r"trouble sleeping", r"sleepless", r"poor sleep", r"didn'?t sleep", r"(?:haven'?t|have not|hasn'?t) been sleeping", r"not sleeping well", r"sleep(?:ing)? (?:badly|poorly)", r"barely (?:sleep|slept)", r"(?:no|little) sleep"),
    "tiredness": (r"\btired\b", r"fatigue", r"exhausted", r"no energy", r"drained", r"worn out"),
    "cough": (r"\bcough",),
    "fever": (r"fever", r"high temperature"),
    "breast tenderness": (r"(?:breast|boob)s? (?:are |is )?(?:tender|sore|painful|hurt)", r"sore breasts?"),
    "bloating": (r"bloat",),
    "constipation": (r"constipat",),
    "hot flushes": (r"hot (?:flush|flash)", r"night sweats"),
    "pelvic pain": (r"pelvic (?:pain|ache)",),
    "leg pain": (r"leg (?:pain|cramps?|ache)", r"calf pain"),
    "heavy period": (r"heavy (?:period|flow)",),
    "itching": (r"itch",),
    "low appetite": (r"no appetite", r"not eating", r"lost my appetite", r"can'?t eat"),
    "anxiety": (r"anxi(?:ous|ety)", r"panic"),
}
_SYMPTOM_RX = {k: [re.compile(p, re.I) for p in v] for k, v in SYMPTOMS.items()}
_NEGATION = re.compile(r"(?:\bno|\bnot|\bwithout|\bnever|n't|\bnone)\s+(?:\w+\s+){0,2}$", re.I)

TOPICS: Dict[str, str] = {
    "sleep": r"\bsleep|insomnia|bedtime|rest\b",
    "food": r"\beat|food|meal|diet|appetite|hungry|craving",
    "work": r"\bwork\b|\bjob\b|office|boss|colleague",
    "family": r"family|mother-in-law|in-?laws?|my mum|my mom|children|kids",
    "relationship": r"husband|partner|boyfriend|relationship|marriage",
    "money": r"\bmoney\b|afford|bills|expens|salary",
    "exercise": r"exercise|workout|walk(?:ing)?\b|gym|yoga",
    "periods": r"\bperiods?\b|menstrua|\bcycle\b|ovulat",
    "contraception": r"contracept|birth control|\bpill\b|condom|implant|\biud\b",
    "fertility": r"conceive|trying for a baby|fertil|get pregnant",
    "menopause": r"menopaus|hot flush|hot flash",
}
_TOPIC_RX = {k: re.compile(v, re.I) for k, v in TOPICS.items()}

_LOW_MOOD = re.compile(
    r"not (?:feeling )?(?:great|good|well|okay|ok|fine|myself|right)|(?:feel(?:ing)?|am|i'?m|im) (?:so |very |really |quite )?"
    r"(?:sad|down|low|depressed|anxious|worried|stressed|overwhelmed|lonely|upset|scared|angry|irritable|hopeless|numb|awful|terrible|"
    r"miserable|crying|struggling|rough|drained|exhausted|tearful|panicky)|a bit rough|having a (?:hard|tough|bad|rough) (?:time|day|week)|"
    r"can'?t cope|struggling|so tired of|crying|stress(?:ed|ing|ful)|burn(?:t|ed)? out|fed up", re.I)
_GOOD_MOOD = re.compile(
    r"(?:feel(?:ing)?|am|i'?m|im|doing) (?:so |very |really |quite |pretty )?(?:good|great|well|fine|happy|better|amazing|excited|"
    r"relaxed|calm|energetic|hopeful|grateful|positive|wonderful|fantastic|strong)|doing well|much better|feeling better|good day|great day", re.I)
_OK_MOOD = re.compile(r"\b(?:okay|ok|alright|so-?so|meh|not bad|average|fine i guess)\b", re.I)


@dataclass
class Extracted:
    mood: Optional[int] = None
    symptoms: List[str] = field(default_factory=list)
    topics: List[str] = field(default_factory=list)

    def empty(self) -> bool:
        return self.mood is None and not self.symptoms and not self.topics


def extract(text: str) -> Extracted:
    """Tags from one message. A symptom directly after 'no/not/without' is not counted ('no headache')."""
    t = (text or "").lower().replace("’", "'")
    out = Extracted()

    for name, patterns in _SYMPTOM_RX.items():
        for p in patterns:
            for m in p.finditer(t):
                if _NEGATION.search(t[max(0, m.start() - 20):m.start()]):
                    continue
                if name not in out.symptoms:
                    out.symptoms.append(name)
                break

    for name, rx in _TOPIC_RX.items():
        if rx.search(t):
            out.topics.append(name)

    if _LOW_MOOD.search(t):
        out.mood = 2 if not re.search(r"hopeless|numb|can'?t cope|depressed|miserable|terrible|awful|crying", t) else 1
    elif _GOOD_MOOD.search(t) and not re.search(r"not (?:feeling )?(?:great|good|well)", t):
        out.mood = 5 if re.search(r"great|amazing|fantastic|wonderful|excited", t) else 4
    elif _OK_MOOD.search(t):
        out.mood = 3
    return out


# ── storage ──────────────────────────────────────────────────────────────────────────────────────────

async def remembering(db, user_id: str) -> bool:
    row = await db.get(CheckinPreference, user_id)
    return True if row is None else bool(row.remember)


async def remember(db, user_id: str, text: str, day: date) -> Optional[Extracted]:
    """Merge what this message told us into today's note. Does nothing if she turned memory off."""
    found = extract(text)
    if found.empty() or not await remembering(db, user_id):
        return None
    row = (await db.execute(select(WellbeingNote).where(WellbeingNote.user_id == user_id, WellbeingNote.day == day))).scalar_one_or_none()
    if row is None:
        row = WellbeingNote(user_id=user_id, day=day, mood=found.mood, symptoms=found.symptoms, topics=found.topics)
        db.add(row)
    else:
        row.mood = found.mood if found.mood is not None else row.mood          # the latest word on how she feels wins
        row.symptoms = sorted(set(row.symptoms or []) | set(found.symptoms))
        row.topics = sorted(set(row.topics or []) | set(found.topics))
    await db.commit()
    return found


async def recent_notes(db, user_id: str, today: date, days: int = 7) -> List[WellbeingNote]:
    since = today - timedelta(days=days)
    return list((await db.execute(
        select(WellbeingNote).where(WellbeingNote.user_id == user_id, WellbeingNote.day >= since).order_by(WellbeingNote.day.desc())
    )).scalars().all())


async def forget_everything(db, user_id: str) -> int:
    res = await db.execute(delete(WellbeingNote).where(WellbeingNote.user_id == user_id))
    await db.commit()
    return res.rowcount or 0


_MOOD_WORD = {1: "felt very low", 2: "felt low", 3: "felt okay", 4: "felt good", 5: "felt great"}


def _ago(day: date, today: date) -> str:
    d = (today - day).days
    return "Today" if d <= 0 else "Yesterday" if d == 1 else f"{d} days ago"


def context_lines(notes: Sequence[WellbeingNote], today: date, limit: int = 5) -> List[str]:
    """For the AI: one short line per recent day. Tags only."""
    lines = []
    for n in list(notes)[:limit]:
        bits = []
        if n.mood:
            bits.append(_MOOD_WORD[n.mood])
        if n.symptoms:
            bits.append("mentioned " + ", ".join(n.symptoms[:4]))
        if n.topics:
            bits.append("talked about " + ", ".join(n.topics[:3]))
        if bits:
            lines.append(f"- {_ago(n.day, today)}: " + "; ".join(bits))
    return lines


def low_mood_days(notes: Sequence[WellbeingNote], today: date, window: int = 5) -> int:
    return sum(1 for n in notes if n.mood is not None and n.mood <= 2 and (today - n.day).days < window)


def follow_up_topic(notes: Sequence[WellbeingNote], today: date) -> Optional[dict]:
    """What the next hello should pick up from: yesterday or the day before, newest first."""
    for n in notes:
        age = (today - n.day).days
        if age < 1 or age > 2:
            continue
        if n.mood is not None and n.mood <= 2:
            return {"kind": "low_mood"}
        if n.symptoms:
            return {"kind": "symptom", "symptom": n.symptoms[0]}
        if n.mood is not None and n.mood >= 4 and any(x.mood is not None and x.mood <= 2 for x in notes if (today - x.day).days > age):
            return {"kind": "better"}
    return None
