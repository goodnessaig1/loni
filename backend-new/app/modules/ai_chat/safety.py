"""
Output checks run on the model's finished answer. The prompt asks the model to behave; this makes sure it did,
because a prompt is not a safety system. Each check returns a note that is appended to the answer.
"""
import re
from typing import List, Optional

from app.modules.ai_chat.triage import Urgency

# Reassurance that must never accompany a red flag.
_REASSURING = re.compile(
    r"(?:nothing to worry|no need to worry|don'?t worry|do not worry|not to worry|completely normal|totally normal|perfectly normal|"
    r"very common and (?:harmless|normal)|is normal in pregnancy|is common in pregnancy|normal during pregnancy|"
    r"should (?:go|pass|settle) (?:away )?on its own|nothing serious|not serious|probably fine|you'?ll be fine|you will be fine|it'?s fine|it is fine)", re.I)

# Anything that points her to a person who can examine her.
_REFERS = re.compile(
    r"(?:hospital|clinic|emergency|healthcare (?:professional|provider|worker)|health worker|doctor|midwife|nurse|obstetric|facility|"
    r"medical (?:help|care|attention|assessment)|seen by|checked)", re.I)

_DOSE = re.compile(r"\b\d+(?:\.\d+)?\s?(?:mg|mcg|µg|ml|iu|g)\b|\b(?:one|two|three|four|1|2|3|4)\s+(?:tablets?|pills?|capsules?)\s+(?:every|twice|daily|a day|per day|three times|at night|morning)", re.I)
_DOSE_CONTEXT = re.compile(r"\b(?:take|taking|give|dose|dosage|use|swallow|drink)\b", re.I)

# Claims the chat cannot make: it has no booking system access.
_CLAIMS_BOOKING = re.compile(
    r"(?:i(?:'ve| have| am| will|'ll)? (?:have )?(?:booked|scheduled|arranged|dispatched|sent|called|notified|requested|ordered) (?:a |an |the |your |you )?(?:nurse|driver|ride|ambulance|doctor|appointment|car|taxi)|"
    r"(?:a |an |the |your )(?:nurse|driver|ride|ambulance|doctor|car) (?:is|are|will be|has been|have been) (?:on (?:the|their) way|coming|dispatched|booked|arranged|assigned|available|waiting|confirmed)|"
    r"(?:booking|ride|appointment|request) (?:is |has been |was )?(?:confirmed|successful|booked|made|done))", re.I)

# Loni cannot know what a nurse or doctor has done: it must never say a clinician reviewed, approved, was told, or will call.
_CLIN = r"(?:nurse|doctor|midwife|clinician|medical team|care team|loni team)s?"
_CLAIMS_CLINICIAN = re.compile(
    rf"(?:(?:a |the |your |our )?(?:loni )?{_CLIN} (?:has|have|had)? ?(?:already )?(?:reviewed|seen|read|checked|looked (?:at|over)|approved|confirmed|gone through)(?: \w+)?? (?:this|it|that|your|you|the (?:chat|conversation|summary|notes?|messages?)|what you|our (?:chat|conversation))\b"
    rf"|{_CLIN} (?:has|have) (?:already )?been (?:notified|informed|alerted|told|contacted|updated|messaged)"
    rf"|(?:a |the |your )?(?:loni )?(?:nurse|doctor|midwife) (?:will|is going to|'ll) (?:call|contact|reach out to|ring|text|message) you"
    rf"|\bi(?:'ve| have|'ll| will|'m going to| am going to)? (?:let|notified|notify|informed|inform|alerted|alert|told|tell|messaged|contacted|flagged (?:this|it) (?:to|for)|passed (?:this|it) (?:on )?to|pass (?:this|it) (?:on )?to|shared (?:this|it|your \w+|the \w+) with|sent (?:this|it|your \w+|the \w+) to|forwarded (?:this|it|your \w+|the \w+) to) (?:a |the |your |our )?(?:loni )?{_CLIN}\b)", re.I)
# "Nurses have seen this many times" is about experience, not about her chat.
_EXPERIENCE = re.compile(r"(?:many|a lot|lots|so many|countless|often|before|plenty|all the time|every day|regularly|commonly)\b", re.I)


def _claims_clinician(text: str) -> bool:
    for m in _CLAIMS_CLINICIAN.finditer(text):
        if re.search(r"\b(?:seen|handled|dealt with)\b", m.group(0), re.I) and _EXPERIENCE.match(text[m.end():].lstrip()):
            continue
        return True
    return False


_STOP_MEDS = re.compile(r"\b(?:you (?:can|may|should|could) (?:safely )?(?:stop|skip|discontinue|quit)|(?:stop|skip|discontinue) (?:taking )?(?:your|the) (?:medic|tablet|pill|drug|treatment|prescri))", re.I)


# Answers that touch health must carry a short, natural reminder that this is support, not medical care.
_HEALTH_TYPES = {"symptom_guidance", "medication", "test_explanation", "newborn_care", "birth_preparation",
                 "decision_support", "nutrition", "pregnancy_education", "cycle_health", "contraception", "fertility",
                 "menopause", "sexual_health", "breast_health", "urinary_pelvic"}
_HAS_DISCLAIMER = re.compile(
    r"(?:not (?:a )?(?:substitute|replacement)|not medical advice|general (?:information|support|guidance|advice)|"
    r"doesn'?t replace|does not replace|(?:your|her) (?:own )?(?:doctor|midwife|care team|healthcare provider|health provider|clinician|health ?care team)(?: knows| is (?:the )?best| can| should)|"
    r"know(?:s)? your situation best|can'?t (?:examine|diagnose)|cannot (?:examine|diagnose)|isn'?t a diagnosis|is not a diagnosis)", re.I)
DISCLAIMER = ("_This is general information, not medical advice. Your own doctor or midwife knows your situation best, "
              "so please don't delay care because of anything here._")


_PHONE = re.compile(r"(?:\+?234|\b0)[\d\s\-().]{8,16}\d")
_HOURS_CLAIM = re.compile(r"(?:open(?:s)?|operat\w+|available)\s+(?:24\s?(?:/|\s?hours|hrs)|round the clock|all day)|\b24\s?/\s?7\b|\b(?:opens?|closes?)\s+(?:at|by|from)\s+\d", re.I)


def reminded_recently(history, within: int = 6) -> bool:
    """True when one of Loni's last few answers already carried the 'general information' reminder. Repeating the same
    disclaimer on every message reads as robotic, so routine answers skip it for a while (urgent ones never do)."""
    seen = 0
    for m in reversed(history or []):
        if m.get("role") != "assistant":
            continue
        if DISCLAIMER in (m.get("content") or "") or _HAS_DISCLAIMER.search(m.get("content") or ""):
            return True
        seen += 1
        if seen >= within:
            break
    return False


def validate(urgency: Urgency, text: str, answer_type: str = "other", looked_up: Optional[set] = None,
             reminded_recently: bool = False) -> List[str]:
    """Notes to append to an answer ([] when it is fine).

    `looked_up` is None when no facility lookup happened, else the set of phone numbers (last 9 digits) the lookup returned.
    `reminded_recently`: the reminder was shown in one of the last few answers, so a routine answer need not repeat it."""
    notes: List[str] = []
    serious = urgency in (Urgency.urgent, Urgency.emergency)
    need_disclaimer = (serious or (answer_type in _HEALTH_TYPES and not reminded_recently)) and not _HAS_DISCLAIMER.search(text)
    if urgency in (Urgency.urgent, Urgency.emergency):
        if _REASSURING.search(text):
            notes.append("I want to be clear: because of what you've described, please don't wait or assume this is normal. "
                         "Have it checked by a healthcare professional today.")
        elif not _REFERS.search(text):
            notes.append("Please have this checked by a healthcare professional today. You can tap **Talk to a Nurse** below if you need help deciding where to go.")
    if _DOSE.search(text) and _DOSE_CONTEXT.search(text):
        notes.append("I can't tell you a dose. Please don't start, stop or change any medicine without your doctor or pharmacist.")
    elif _STOP_MEDS.search(text):
        notes.append("Please don't stop or change a prescribed medicine without speaking to your doctor or pharmacist first.")
    if _claims_clinician(text):
        notes.append("To be clear: no nurse or doctor has seen this conversation. If you'd like one to, tap **Talk to a Nurse** "
                     "and you can choose to share a short summary with them.")
    if _CLAIMS_BOOKING.search(text):
        notes.append("I can't confirm bookings or arrivals from this chat. Please use the buttons in the app and wait for the confirmation there.")
    # Phone numbers and opening hours must come from a lookup, never from the model's memory.
    numbers = {re.sub(r"\D", "", m.group(0))[-9:] for m in _PHONE.finditer(text)}
    if numbers and (looked_up is None or not numbers <= looked_up):
        notes.append("Please double-check any phone number with the hospital's official page before you rely on it. "
                     "I can only share numbers I looked up just now." if looked_up is not None else
                     "I can't confirm phone numbers from here. Please check the hospital's official page or Google Maps for the right number.")
    if looked_up is None and _HOURS_CLAIM.search(text):
        notes.append("I can't check opening hours from here, so please call the facility or check its official page to confirm.")
    if need_disclaimer:
        notes.append(DISCLAIMER)  # last, so it reads as the closing line
    return notes
