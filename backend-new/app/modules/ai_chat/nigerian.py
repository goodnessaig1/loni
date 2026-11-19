"""
Nigerian English and Pidgin: what common phrases USUALLY mean, so the model reads her the way a Nigerian nurse would.

This never decides urgency (triage.py does, before the model) and never assumes a diagnosis. Many of these phrases are
vague on purpose ("my belle is doing somehow"), so the hint tells the model the likely meaning AND to ask one short
clarifying question instead of guessing. Needs review by a native speaker and a clinician before release.
"""
import re
from dataclasses import dataclass
from typing import List, Tuple


@dataclass(frozen=True)
class Idiom:
    key: str
    pattern: str
    meaning: str
    vague: bool = False      # true: the model must ask what she means before giving symptom advice


IDIOMS: Tuple[Idiom, ...] = (
    Idiom("belle_somehow", r"(?:belle|belly|stomach|tummy) (?:\w+ ){0,3}(?:doing|dey do|dey turn|turning) (?:me )?somehow",
          "her belly feels unwell or strange (could be pain, tightening, nausea, unusual baby movement or just discomfort)", True),
    Idiom("body_somehow", r"(?:body|i) (?:\w+ ){0,2}(?:doing|dey do|feel(?:ing)?) (?:me )?somehow|feeling somehow",
          "she feels unwell or 'off' in a way she has not described yet", True),
    Idiom("dealing_with_me", r"(?:pregnancy|baby|this thing|everything|it) (?:is |dey )?(?:dealing with|finishing|wearing) me|dealing with me",
          "she is struggling: tired, uncomfortable or overwhelmed by the pregnancy; this is about how she is coping, not one symptom", True),
    Idiom("no_fit_sleep", r"(?:i )?no (?:fit|dey) sleep|(?:can'?t|cannot) sleep at all|sleep no (?:dey )?come",
          "she cannot sleep / is sleeping badly"),
    Idiom("waist_pain", r"waist (?:is |dey )?(?:pain|paining|hurt|aching)|paining me (?:for|in|at) (?:my )?waist",
          "in Nigerian English 'waist' usually means the LOWER BACK / hips, not the waistline"),
    Idiom("paining", r"\b(?:is|are|dey) paining me\b|\bpaining me\b",
          "'X is paining me' means 'X hurts'"),
    Idiom("belle", r"\bbelle\b", "'belle' means belly / tummy (or the pregnancy itself)"),
    Idiom("body_weak", r"body (?:dey|is) weak|my body is weak|weakness (?:of|for) body",
          "she feels weak / tired; ask whether she also feels dizzy, faint or breathless", True),
    Idiom("heat", r"(?:body|my body) (?:dey|is) hot|hot body",
          "'my body is hot' usually means she feels feverish"),
    Idiom("pikin", r"\bpikin\b", "'pikin' means child / baby"),
    Idiom("abeg", r"\babeg\b", "'abeg' means 'please'"),
    Idiom("wahala", r"\bwahala\b", "'wahala' means trouble / stress"),
    Idiom("no_allow_sleep", r"(?:baby|pikin|this child|this baby) (?:\w+ ){0,2}(?:doesn'?t|does not|no dey|won'?t|will not) (?:allow|let) me sleep",
          "she means the baby (kicking, or a newborn waking) keeps her awake; often said lightly"),
)
_RX = [(i, re.compile(i.pattern, re.I)) for i in IDIOMS]

_JOKING = re.compile(r"😂|🤣|😅|😆|\blol\b|\blmao\b|\bhaha+\b|\bhehe+\b", re.I)


def detect(text: str) -> List[Idiom]:
    t = (text or "").lower().replace("’", "'")
    return [i for i, rx in _RX if rx.search(t)]


def is_joking(text: str) -> bool:
    return bool(_JOKING.search(text or ""))


def directive(text: str, serious: bool) -> str:
    """A per-turn hint for the model, or '' when nothing applies. `serious` = triage found a danger sign."""
    found = detect(text)
    parts = []
    if found:
        lines = "\n".join(f"- \"{i.key.replace('_', ' ')}\": {i.meaning}" for i in found)
        parts.append("NIGERIAN ENGLISH: she wrote in Nigerian English/Pidgin. Likely meanings:\n" + lines)
        if any(i.vague for i in found) and not serious:
            parts.append("What she described is vague. Do NOT assume a diagnosis or list possible conditions. Acknowledge it warmly "
                         "in her own register, then ask ONE short clarifying question (for example what exactly she feels, since when, "
                         "and, if pregnant, whether there is any bleeding, strong pain or change in the baby's movement).")
        parts.append("You may reply with a light Nigerian touch if it feels natural, but keep the medical parts in clear plain English.")
    if is_joking(text) and not serious:
        parts.append("She is being light-hearted. Match it with a little warmth or gentle humour first, then be helpful. "
                     "Never joke about a symptom that could be serious.")
    return "\n".join(parts)
