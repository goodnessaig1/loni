"""
Who gets which kind of hello, how often, and what it says.

Care categories come from where she is in the journey. Care LEVEL then adjusts the rhythm for how much support she
seems to need right now (see policy.care_level). Wording is warm and never gives medical advice: the check-in only opens
a conversation, and the AI (with its triage and safety checks) does the talking once she answers.
All copy here should be reviewed by a maternal-health professional and a Nigerian-English speaker before release.
"""
import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

# ── categories ───────────────────────────────────────────────────────────────────────────────────────

PREG_T1, PREG_T2, PREG_T3, PREG_TERM = "preg_t1", "preg_t2", "preg_t3", "preg_term"
PP_EARLY, PP_ACTIVE, PP_EXTENDED = "pp_early", "pp_active", "pp_extended"
GENERAL = "general"     # profile has no usable stage yet
WOMEN = "women"         # not pregnant, not postpartum (women's health in general)
TTC = "ttc"             # trying to conceive


def category_of(kind: Optional[str], week: Optional[int]) -> str:
    """kind: 'pregnancy' | 'postpartum' | None (as in ai_chat.triage.StageContext); week: gestational / since birth."""
    if kind == "pregnancy" and week:
        return PREG_T1 if week <= 12 else PREG_T2 if week <= 27 else PREG_T3 if week <= 36 else PREG_TERM
    if kind == "postpartum" and week is not None:
        return PP_EARLY if week <= 6 else PP_ACTIVE if week <= 12 else PP_EXTENDED
    if kind == "general":
        return WOMEN
    if kind == "ttc":
        return TTC
    return GENERAL


# Days between ordinary "hello"s for a mother at STANDARD care level. Steadier stretches get a lighter touch.
STANDARD_GAP_DAYS: Dict[str, int] = {
    PREG_T1: 2, PREG_T2: 3, PREG_T3: 2, PREG_TERM: 1,
    PP_EARLY: 1, PP_ACTIVE: 2, PP_EXTENDED: 3,
    GENERAL: 3, WOMEN: 2, TTC: 2,
}
# Levels that need closer contact always get a daily hello.
ENHANCED_GAP_DAYS = 1
INTENSIVE_GAP_DAYS = 1
# She has ignored this many hellos in a row: stop knocking daily and ease to weekly until she answers or opens one.
BACKOFF_AFTER_IGNORED = 3
BACKOFF_GAP_DAYS = 7


# ── messages ─────────────────────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Chip:
    key: str            # good | rough | question | nurse
    label: str          # what the button says
    message: Optional[str]   # what is sent to the AI when tapped; None = opens the nurse call instead


GOOD = Chip("good", "I'm doing well", "I'm doing well today.")
ROUGH = Chip("rough", "A bit rough", "I'm not feeling great today.")
QUESTION = Chip("question", "I have a question", "I have a question.")
NURSE = Chip("nurse", "Talk to a nurse", None)
CHIPS: Tuple[Chip, ...] = (GOOD, ROUGH, QUESTION, NURSE)


@dataclass(frozen=True)
class Template:
    key: str
    title: str
    text: str           # {name} and {week} are filled in; missing values fall back gracefully


_T: Dict[str, List[Template]] = {
    PREG_T1: [
        Template("t1_a", "Hello, {name} 💜", "Hi {name} 💜 The first weeks can bring tiredness and queasiness, and that is very common. How are you feeling today?"),
        Template("t1_b", "Thinking of you", "Good morning {name} 🌸 Just checking in. How is your body treating you this week?"),
        Template("t1_c", "How are you today?", "Hello {name}! You're in week {week} now. Anything on your mind, big or small? I'm here."),
    ],
    PREG_T2: [
        Template("t2_a", "Hello, {name} 💜", "Hi {name} 💜 Week {week} is often a steadier stretch. How are you feeling today?"),
        Template("t2_b", "Checking in", "Good morning {name} 🌸 How are you and baby doing today?"),
        Template("t2_c", "How are you?", "Hello {name}! Anything you've been wondering about lately? Ask me anything, anytime."),
    ],
    PREG_T3: [
        Template("t3_a", "Hello, {name} 💜", "Hi {name} 💜 Week {week} already! How are you feeling today, in your body and your mind?"),
        Template("t3_b", "Thinking of you", "Good morning {name} 🌸 The final stretch can feel heavy. How are you doing today?"),
        Template("t3_c", "Checking in", "Hello {name}! How are you sleeping and how is baby moving? Tell me how today is going."),
    ],
    PREG_TERM: [
        Template("term_a", "Hello, {name} 💜", "Hi {name} 💜 Any day now. How are you feeling today?"),
        Template("term_b", "Checking in", "Good morning {name} 🌸 How are you and baby today? I'm here if anything feels different."),
        Template("term_c", "How are you?", "Hello {name}! Is your hospital bag and plan to get there ready? Tell me how you're feeling."),
    ],
    PP_EARLY: [
        Template("ppe_a", "Hello, {name} 💜", "Hi {name} 💜 The first weeks with a newborn are a lot. How are you doing today? And how are you healing?"),
        Template("ppe_b", "Thinking of you", "Good morning {name} 🌸 How did you and baby sleep? Remember to ask for help and rest when you can."),
        Template("ppe_c", "Checking in", "Hello {name}! How are you feeling today, in your body and in your heart?"),
    ],
    PP_ACTIVE: [
        Template("ppa_a", "Hello, {name} 💜", "Hi {name} 💜 How are you and baby getting on this week?"),
        Template("ppa_b", "Checking in", "Good morning {name} 🌸 How is feeding going, and how are you feeling in yourself?"),
        Template("ppa_c", "How are you?", "Hello {name}! You've been doing so much. What's on your mind today?"),
    ],
    PP_EXTENDED: [
        Template("ppx_a", "Hello, {name} 💜", "Hi {name} 💜 Just a little hello. How are you doing these days?"),
        Template("ppx_b", "Checking in", "Good morning {name} 🌸 How are you and baby today? Ask me anything that's on your mind."),
        Template("ppx_c", "Thinking of you", "Hello {name}! How have you been feeling lately?"),
    ],
    GENERAL: [
        Template("gen_a", "Hello, {name} 💜", "Hi {name} 💜 Just checking in on you. How are you feeling today?"),
        Template("gen_b", "Thinking of you", "Good morning {name} 🌸 How are you today? I'm here whenever you want to talk."),
    ],
}

# (women's health in general / trying to conceive / milestones / follow-ups built from what she told Loni)
_WOMEN_TEMPLATES = {
    WOMEN: [
        Template("w_a", "Hello, {name} 💜", "Hi {name} 💜 Just checking in on you. How are you feeling today, in your body and your mood?"),
        Template("w_b", "Thinking of you", "Good morning {name} 🌸 How has your week been so far? I'm here if you want to talk about anything."),
        Template("w_c", "How are you?", "Hello {name}! Anything on your mind about your health, your cycle, your sleep, or just life? Ask me anything."),
        Template("w_d", "A little hello", "Hi {name} 💜 How's your energy today? Tell me how you're really doing."),
    ],
    TTC: [
        Template("ttc_a", "Hello, {name} 💜", "Hi {name} 💜 Thinking of you on this journey. How are you feeling today?"),
        Template("ttc_b", "Checking in", "Good morning {name} 🌸 Trying for a baby can bring a lot of feelings. How are you holding up?"),
        Template("ttc_c", "How are you?", "Hello {name}! How are you and your body doing this week? Any questions about your cycle, I'm here."),
    ],
}

# When something is worth marking: a short note in her day, not medical advice.
MILESTONES = {
    12: Template("ms_12", "First trimester done 🎉", "Hi {name} 💜 You've just finished the first trimester. That's a real milestone. How are you feeling?"),
    20: Template("ms_20", "Halfway there 🎉", "Hi {name} 💜 Halfway through your pregnancy! How are you feeling about it all?"),
    28: Template("ms_28", "Third trimester 🎉", "Hi {name} 💜 Welcome to the third trimester. How are you doing today?"),
    37: Template("ms_37", "Full term 🎉", "Hi {name} 💜 You've reached full term. How are you feeling today?"),
}

# Opening lines built from what she told Loni recently (her own words, via the symptom/mood notes, never medical claims).
FOLLOW_UP_SYMPTOM = Template("fu_symptom", "How's the {symptom}, {name}?", "Hi {name} 💜 You mentioned {symptom} recently. How is it today, any better?")
FOLLOW_UP_LOW_MOOD = Template("fu_lowmood", "Thinking of you, {name}", "Hi {name} 💜 I've been thinking about you since we last spoke. How are you feeling today?")
FOLLOW_UP_GOOD_NEWS = Template("fu_better", "Good to hear from you", "Hi {name} 💜 Last time you sounded a bit better. How are you today?")



_T.update(_WOMEN_TEMPLATES)

# Sent the day after an urgent, emergency or emotional-distress conversation. Not the "daily hello".
FOLLOWUP_URGENT = Template("followup_urgent", "How are you doing, {name}?",
                           "Hi {name} 💜 I've been thinking about you since yesterday. Were you able to get checked, and how are you feeling now?")
FOLLOWUP_MENTAL = Template("followup_mental", "Thinking of you, {name}",
                           "Hi {name} 💜 I wanted to check in on you after we spoke. How are you feeling today? You don't have to go through this alone.")

FOLLOWUP_CHIPS: Tuple[Chip, ...] = (
    Chip("good", "Yes, I'm okay now", "I was seen and I'm okay now."),
    Chip("rough", "Not yet", "I haven't been checked yet."),
    Chip("question", "I'm still worried", "I'm still worried."),
    NURSE,
)
FOLLOWUP_MENTAL_CHIPS: Tuple[Chip, ...] = (
    Chip("good", "A little better", "I'm feeling a little better."),
    Chip("rough", "Still struggling", "I'm still struggling."),
    Chip("question", "I want to talk", "I want to talk."),
    NURSE,
)


def render(template: Template, name: Optional[str], week: Optional[int], symptom: Optional[str] = None) -> Tuple[str, str]:
    """(title, body). A missing name reads naturally ('mama' for mothers, 'dear' otherwise would be presumptuous, so it
    just says 'there'), a missing week drops the week-specific phrasing."""
    who = (name or "").strip() or "there"
    wk = str(week) if week else ""
    sym = symptom or "how you've been feeling"
    title = template.title.format(name=who, week=wk, symptom=sym)
    body = template.text.format(name=who, week=wk or "your", symptom=sym)
    return title, body


def pick(category: str, last_key: Optional[str], rng: Optional[random.Random] = None) -> Template:
    """A template for this category that is not the one she saw last time (when there is a choice)."""
    options = _T.get(category) or _T[GENERAL]
    fresh = [t for t in options if t.key != last_key] or options
    return (rng or random).choice(fresh)


def all_templates() -> List[Template]:
    return ([t for ts in _T.values() for t in ts] + [FOLLOWUP_URGENT, FOLLOWUP_MENTAL]
            + list(MILESTONES.values()) + [FOLLOW_UP_SYMPTOM, FOLLOW_UP_LOW_MOOD, FOLLOW_UP_GOOD_NEWS])


def chip_for_message(text: str) -> Optional[Chip]:
    """Which chip (if any) a message she sent is exactly the text of."""
    t = (text or "").strip().lower()
    for chip in (*CHIPS, *FOLLOWUP_CHIPS, *FOLLOWUP_MENTAL_CHIPS):
        if chip.message and chip.message.lower() == t:
            return chip
    return None
