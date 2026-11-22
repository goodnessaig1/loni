"""
Implicit conversation-quality signals, used to find patterns where Loni misses the point (never to judge one chat).

Each signal is a label stored on the turn's `ai_safety_events` record, never her words:

    correction     she says Loni got it wrong ("no, I said...", "that's not what I meant")
    clarification  she did not understand the answer ("I don't understand", "what do you mean")
    repeat         she asks essentially the same thing again (the last answer may have missed the point)
    thanks         she says it helped
    wants_detail   she asks for more detail
    wants_shorter  she asks for shorter answers

These are hints, not proof: a repeat can mean a new worry, a missing thanks means nothing. Explicit feedback (the
thumbs on a message) is stored separately in `ai_feedback` (see service.record_feedback).
"""
import re
from typing import List, Sequence

_RX = {
    "correction": re.compile(r"\b(?:no,? (?:i said|i meant|that'?s not)|that'?s not what i (?:said|meant|asked)|you (?:misunderstood|got it wrong|didn'?t understand|are wrong|'re wrong)|"
                             r"i (?:didn'?t|did not) (?:say|mean) that|i already (?:told|said)|i told you (?:already|before)|not what i asked|wrong answer)\b", re.I),
    "clarification": re.compile(r"\b(?:i (?:don'?t|do not|didn'?t) (?:understand|get it|get you)|what do you mean|meaning\?|explain (?:again|better|that)|"
                                r"i'?m confused|confusing|in simple (?:words|terms|english)|simpler)\b", re.I),
    "thanks": re.compile(r"\b(?:thank(?:s| you| u)|thx|that (?:helps|helped)|very helpful|so helpful|god bless you|you'?re (?:the best|amazing))\b", re.I),
    "wants_detail": re.compile(r"\b(?:explain more|tell me more|more detail|in detail|go deeper|elaborate|tell me everything)\b", re.I),
    "wants_shorter": re.compile(r"\b(?:too long|shorter|be brief|keep it short|summari[sz]e)\b", re.I),
}
_WORD = re.compile(r"[a-z']{3,}")
_STOP = {"the", "and", "you", "for", "are", "but", "what", "how", "why", "can", "this", "that", "with", "have", "has", "was", "its",
         "it's", "i'm", "she", "him", "her", "his", "they", "them", "about", "should", "would", "could", "will", "please", "loni", "again"}


def _words(text: str) -> set:
    return {w for w in _WORD.findall((text or "").lower()) if w not in _STOP}


def _is_repeat(text: str, history: Sequence[dict]) -> bool:
    """Her message overlaps heavily with one of her last three earlier messages."""
    now = _words(text)
    if len(now) < 3:
        return False
    earlier = [m.get("content") or "" for m in history if m.get("role") == "user"]
    if earlier and earlier[-1] == text:
        earlier = earlier[:-1]
    for prev in earlier[-3:]:
        before = _words(prev)
        if before and len(now & before) / len(now | before) >= 0.6:
            return True
    return False


def detect(text: str, history: Sequence[dict] = ()) -> List[str]:
    found = [name for name, rx in _RX.items() if rx.search(text or "")]
    if _is_repeat(text, history):
        found.append("repeat")
    return found
