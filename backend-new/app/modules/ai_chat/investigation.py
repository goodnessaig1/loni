"""
Symptom investigation: what Loni still needs to find out before it can give useful guidance.

Triage (triage.py) decides HOW URGENT a message is. This module decides WHAT TO ASK NEXT when a woman reports a
symptom that is not an emergency, so Loni investigates like a good nurse instead of replying "kindly see a nurse":

    "I've been bleeding for two days"  ->  pathway "bleeding"
        known:    how long (two days)
        missing:  [warning sign] soaking a pad in an hour?  [warning sign] pain / dizziness?  pregnancy possible? ...
    -> per-turn note to the model: ask the top one or two missing things, warning signs first; once enough is known
       (or she wants an answer) stop asking and explain.

Properties:
* Deterministic and cheap (regexes, no model call). It never changes urgency: an emergency is handled by triage
  before this runs, and urgent cases get the urgent directive instead.
* A pathway carries on across turns: the assistant message stores the pathway id in its `meta`, so when she answers
  "I'm using a pad" the same pathway continues and that answer fills a slot.
* Her profile fills slots she should never be asked again (a pregnant woman is not asked "could you be pregnant?").
* Earlier notes of the same symptom are surfaced so a repeated complaint is recognised ("is it the same as before?").
* It stops: after MAX_TURNS investigative turns, or when every warning-sign question is answered, the note tells the
  model to answer.

PATHWAYS ARE CLINICAL CONTENT. Each one is versioned, and every question and warning sign must be reviewed and
signed off by a qualified clinician before release (see README "Needs clinician sign-off").
"""
import re
from dataclasses import dataclass, field
from typing import Iterable, List, Optional, Sequence, Tuple

from app.modules.ai_chat.triage import StageContext

PATHWAY_VERSION = "2026-11-22.1"
MAX_TURNS = 3          # investigative turns before Loni must give her an answer
_LOOKBACK = 8          # at most this many of her recent messages count when deciding what is already known
_ANSWER_MAX_CHARS = 160  # a longer message that names no symptom is a new topic, not an answer to Loni's question

# ── shared slot vocabulary ──────────────────────────────────────────────────────────────────────────
_DURATION = (r"\b(?:since|for (?:about |around |almost |over )?(?:a |an |the (?:past|last) |\d+ |one |two |three |four |five |six |seven |a few |few |several )?"
             r"(?:minutes?|hours?|days?|nights?|weeks?|months?|years?)|\d+ ?(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?)|yesterday|this morning|"
             r"last (?:night|week|month)|today|tonight|all day|just (?:now|started)|(?:two|three|four|five|few|couple of) days|started|began|on and off|comes and goes|weeks?|days?)\b")
_SEVERITY = (r"\b(?:mild|slight(?:ly)?|small|little|a bit|bit|light|moderate|bad|very bad|severe|terrible|unbearable|strong|sharp|dull|"
             r"stabbing|throbbing|cramp(?:y|ing)?|aching|annoying|manageable|worse|worsening|better|\d{1,2} ?(?:/|out of) ?10)\b")
_PREG_POSSIBLE = (r"\b(?:pregnan\w*|pregnancy test|tested|test (?:was|is|came)|period|lmp|last menstrual|on (?:the )?(?:pill|implant|injection|depo|coil|iud)|"
                  r"use (?:condoms?|protection|contracepti\w*)|not sexually active|haven'?t had sex|no sex|virgin|menopaus\w*|tubal|tubes? tied|trying to conceive|ttc)\b")
_BEFORE = r"\b(?:before|first time|never (?:had|happened)|happened (?:before|again)|again|usual(?:ly)?|always|every (?:month|time)|normal for me|last time|used to)\b"
_DIZZY = r"\b(?:dizz\w*|faint\w*|light-?headed|weak|pass(?:ed|ing)? out|collaps\w*|heart (?:racing|pounding)|pale)\b"
_FEVER = r"\b(?:fever\w*|temperature|hot body|body (?:is |dey )?hot|chills|shiver\w*|feverish|temp)\b"


@dataclass(frozen=True)
class Slot:
    key: str
    ask: str                          # what Loni needs to find out (the model words the question for her)
    known: str                        # regex over her recent messages: she has already addressed this (yes OR no)
    red_flag: bool = False            # a warning-sign question: asked before anything else
    skip_stages: Tuple[str, ...] = ()  # stages where this question does not apply or is answered by her profile
    stages: Tuple[str, ...] = ()      # only for these stages (empty = all)


@dataclass(frozen=True)
class Pathway:
    id: str
    label: str
    triggers: Tuple[str, ...]         # regexes that start this pathway from her message
    slots: Tuple[Slot, ...]
    memory_keys: Tuple[str, ...] = ()  # checkins.memory SYMPTOMS keys that mean "she has had this before"
    explain: str = ""                 # what a good answer covers once enough is known
    stages: Tuple[str, ...] = ()      # pathway only applies to these stages (empty = all)
    skip_stages: Tuple[str, ...] = ()


S = Slot
_PREG_SLOT = S("pregnancy_possible", "whether she could be pregnant (and when her last period started)", _PREG_POSSIBLE,
               skip_stages=("pregnancy", "postpartum"))
_HISTORY_SLOT = S("happened_before", "whether this has happened before, and whether it feels the same or different", _BEFORE)
_DURATION_SLOT = S("onset", "when it started and how long it has been going on", _DURATION)

PATHWAYS: Tuple[Pathway, ...] = (
    Pathway("bleeding", "vaginal bleeding or spotting",
            (r"\bbl[eai]+d(?:ing)?\b(?!.{0,15}(?:nose|gums?))", r"\bspotting\b", r"\bblood (?:on|in) (?:my )?(?:pant|underwear|pad|tissue|toilet)",
             r"\bheavy (?:period|flow|menses)\b", r"\bperiod (?:is |has been )?(?:very |so |too )?heavy\b", r"\b(?:brown|pink) discharge\b"),
            (
                S("amount", "how much: a few spots when wiping, or actually needing a pad",
                  r"\b(?:spot(?:s|ting)?|few drops|drops?|light|little|small|heavy|pad|pads|soak\w*|clots?|liner|tampon|tissue|wip\w*|flow|a lot|much)\b", red_flag=True),
                S("soaking", "how quickly a pad gets soaked (soaking one in an hour or less is a warning sign) and whether she is passing large clots",
                  r"\b(?:soak\w*|full|hours?|hrs?|change\w*|clots?|light|lightly|slow\w*|quick\w*|fast|spot(?:s|ting)?|few drops|liner|not (?:much|heavy))\b", red_flag=True),
                S("pain_dizzy", "any belly or pelvic pain, dizziness, weakness or fainting with it", rf"\b(?:pain\w*|cramp\w*|hurt\w*|ache|aching)\b|{_DIZZY}", red_flag=True),
                _DURATION_SLOT,
                _PREG_SLOT,
                S("colour", "the colour (bright red, dark red, brown or pink)", r"\b(?:red|brown|pink|dark|black|bright)\b"),
                _HISTORY_SLOT,
            ),
            memory_keys=("spotting", "heavy period"),
            explain="common explanations for her situation (for example a period that is early or heavy, spotting around ovulation or with "
                    "hormonal contraception, implantation spotting, cervical irritation), the ones that need checking (pregnancy-related "
                    "bleeding, infection, fibroids or polyps), what she can do now, and exactly which amount of bleeding or which symptoms "
                    "mean she must be seen today or go now"),
    Pathway("abdominal_pain", "belly or pelvic pain",
            (r"\b(?:abdomin\w*|stomach|belly|belle|tummy|lower belly|pelvic|pelvis|womb|uterus)\b.{0,25}\b(?:pain\w*|cramp\w*|hurt\w*|ache\w*|sore)\b",
             r"\b(?:pain\w*|cramp\w*|hurt\w*|ache\w*) (?:in|on|around) (?:my )?(?:abdomen|stomach|belly|tummy|lower belly|pelvis|side)\b",
             r"\b(?:belly|belle|stomach|tummy) (?:dey|is) (?:pain|paining|hurt\w*)", r"\bcramp(?:s|ing)\b"),
            (
                S("severity", "how bad it is (mild, moderate, severe, or a number out of 10) and whether it stops her doing normal things", _SEVERITY, red_flag=True),
                S("bleeding", "any vaginal bleeding or spotting with it", r"\b(?:bl[eai]+d\w*|blood|spotting)\b", red_flag=True),
                S("location", "where exactly (one side, the middle, low down, all over) and whether it spreads to the shoulder or back",
                  r"\b(?:left|right|one side|both sides|middle|centre|center|low(?:er)?|upper|top|all over|everywhere|side|shoulder|back|navel|belly button|pelvis)\b"),
                S("fever_vomit", "any fever, vomiting or pain when passing urine", rf"{_FEVER}|\b(?:vomit\w*|throw\w* up|nause\w*|urin\w*|pee\w*|wee)\b"),
                _DURATION_SLOT,
                _PREG_SLOT,
                _HISTORY_SLOT,
            ),
            memory_keys=("cramps", "pelvic pain", "bloating", "constipation"),
            explain="the common causes for her stage (period cramps, wind or constipation, round-ligament or stretching pain in pregnancy, "
                    "after-pains postpartum), the causes that need a check (infection, a pregnancy outside the womb when pregnancy is "
                    "possible, miscarriage, cysts), safe comfort measures, and which pain pattern means go now"),
    Pathway("headache", "headache",
            (r"\bhead ?ache\b", r"\bmigraine\b", r"\bhead (?:is |dey |keeps? )?(?:pain\w*|hurt\w*|ach\w*|pound\w*|bang\w*|split\w*)", r"\bmy head\b"),
            (
                S("severity", "how bad it is and whether it is the worst she has had or came on suddenly", _SEVERITY + r"|\b(?:worst|sudden\w*|thunderclap)\b", red_flag=True),
                S("vision_swelling", "any blurred vision, flashing lights, or sudden swelling of the face or hands",
                  r"\b(?:vision|blur\w*|see\w*|eyes?|flash\w*|spots|lights|swell\w*|swollen|puffy|face|hands|fingers)\b", red_flag=True,
                  stages=("pregnancy", "postpartum")),
                S("blood_pressure", "whether her blood pressure has been checked recently and what it was",
                  r"\b(?:blood pressure|bp|\d{2,3} ?/ ?\d{2,3}|pressure|hypertension)\b", stages=("pregnancy", "postpartum")),
                S("other_signs", "any fever, stiff neck, vomiting, weakness or confusion", rf"{_FEVER}|\b(?:neck|vomit\w*|weak\w*|confus\w*|numb\w*)\b"),
                _DURATION_SLOT,
                S("triggers", "what she thinks set it off (sleep, water, food, screen time, stress, caffeine) and what she has tried",
                  r"\b(?:sleep\w*|water|drink\w*|dehydrat\w*|food|eat\w*|skip\w*|stress\w*|screen|phone|caffeine|coffee|tea|tried|took|rest\w*|sun)\b"),
                _HISTORY_SLOT,
            ),
            memory_keys=("headache",),
            explain="common causes (tension, dehydration, missed meals, poor sleep, hormones, caffeine changes), what she can safely do now "
                    "without naming doses, and the warning signs (in pregnancy or after birth: severe or persistent headache, vision "
                    "changes, swelling, high blood pressure)"),
    Pathway("nausea_vomiting", "nausea or vomiting",
            (r"\bnause\w*", r"\bvomit\w*", r"\bthrow(?:ing)? up\b", r"\bmorning sickness\b", r"\bqueas\w*", r"\bfeel(?:ing)? sick\b"),
            (
                S("keeping_down", "whether she can keep any fluids down, and whether she is passing urine normally",
                  r"\b(?:keep\w* (?:down|anything|water|food)|can'?t (?:eat|drink)|drink\w*|fluids?|water|urin\w*|pee\w*|wee)\b", red_flag=True),
                S("frequency", "how often she is vomiting in a day", r"\b(?:\d+ times|once|twice|every|all day|morning|after (?:eating|meals?)|times)\b"),
                S("other_signs", "any blood in the vomit, belly pain, fever or dizziness", rf"\b(?:blood|pain\w*)\b|{_FEVER}|{_DIZZY}", red_flag=True),
                _DURATION_SLOT,
                _PREG_SLOT,
            ),
            memory_keys=("nausea", "vomiting"),
            explain="common causes for her stage (early pregnancy, a stomach bug, food, stress), practical tips (small frequent meals, "
                    "sips of fluid, ginger or bland foods if they suit her), and the signs of dehydration or something more serious"),
    Pathway("discharge_itching", "vaginal discharge, itching or discomfort",
            (r"\bdischarge\b(?!.{0,20}(?:nipple|breast|hospital))", r"\b(?:vagina\w*|vulva|private part|down there)\b.{0,25}\b(?:itch\w*|smell\w*|sore|burn\w*|pain\w*|dry|swell\w*)",
             r"\bitch\w*\b.{0,20}\b(?:vagina\w*|vulva|private|down there)", r"\b(?:fishy|smelly|bad) smell\b", r"\bthrush\b|\byeast\b"),
            (
                S("appearance", "what the discharge looks like (colour, thick or watery) and whether there is a smell",
                  r"\b(?:white|yellow|green|grey|gray|clear|brown|pink|thick|thin|watery|cottage|lumpy|frothy|smell\w*|odou?r|fishy)\b"),
                S("pain_fever", "any pelvic pain, fever, pain during sex, or sores", rf"\b(?:pain\w*|sores?|blisters?|ulcers?|sex)\b|{_FEVER}", red_flag=True),
                S("itch_burn", "any itching, burning or soreness, and pain when passing urine", r"\b(?:itch\w*|burn\w*|sore\w*|sting\w*|urin\w*|pee\w*)\b"),
                _DURATION_SLOT,
                _PREG_SLOT,
                _HISTORY_SLOT,
            ),
            memory_keys=("itching",),
            explain="what normal discharge is like and how it changes through the cycle and in pregnancy, common treatable causes in "
                    "plain words (thrush, bacterial vaginosis, infections) without diagnosing, simple hygiene tips (no douching), and "
                    "that a clinic check or swab confirms the cause and treatment"),
    Pathway("urinary", "urinary symptoms",
            (r"\b(?:burn\w*|sting\w*|pain\w*|hurt\w*) (?:when|while|on) (?:i )?(?:pee\w*|urinat\w*|wee)", r"\buti\b", r"\burinary\b",
             r"\b(?:pee\w*|urinat\w*) (?:a lot|often|frequently|every)", r"\bblood in (?:my )?(?:urine|pee)", r"\bleak\w* (?:urine|pee)\b"),
            (
                S("fever_back", "any fever, chills, back or side pain, or vomiting", rf"{_FEVER}|\b(?:back|side|flank|kidney|vomit\w*)\b", red_flag=True),
                S("blood", "any blood in the urine", r"\b(?:blood|red|pink|brown)\b"),
                _DURATION_SLOT,
                _PREG_SLOT,
                _HISTORY_SLOT,
            ),
            memory_keys=(),
            explain="common causes (a bladder infection, not drinking enough, pregnancy pressure on the bladder), simple self-care, and "
                    "that a urine test is how an infection is confirmed and treated, sooner in pregnancy"),
    Pathway("breast", "breast pain or changes",
            (r"\b(?:breast|boob|nipple)s?\b.{0,25}\b(?:pain\w*|sore|tender|lump|swell\w*|red|hot|hard|discharg\w*|hurt\w*|crack\w*)",
             r"\b(?:lump|pain\w*|sore\w*) (?:in|on) (?:my )?(?:breast|boob|nipple|armpit)"),
            (
                S("lump_discharge", "whether there is a new lump, nipple discharge (especially bloody), or skin change", r"\b(?:lump|knot|mass|discharg\w*|leak\w*|blood\w*|dimpl\w*|skin|inverted|rash)\b", red_flag=True),
                S("red_hot_fever", "whether the breast is red, hot or hard, and any fever or flu-like feeling", rf"\b(?:red|hot|hard|warm|swollen)\b|{_FEVER}",
                  red_flag=True, stages=("postpartum",)),
                S("cycle_link", "whether it comes and goes with her period", r"\b(?:period|cycle|before my|monthly|month)\b", skip_stages=("pregnancy", "postpartum")),
                S("feeding", "how breastfeeding is going (latch, cracked nipples, feeding pattern)", r"\b(?:latch\w*|feed\w*|crack\w*|breastfe\w*|pump\w*|baby)\b", stages=("postpartum",)),
                S("side", "whether it is one breast or both", r"\b(?:one|both|left|right|side)\b"),
                _DURATION_SLOT,
            ),
            memory_keys=("breast tenderness",),
            explain="normal causes (cycle changes, pregnancy, breastfeeding), feeding and comfort tips when relevant, and that any new "
                    "lump, bloody discharge or one-sided persistent change should be examined soon (most are not cancer, but only an "
                    "examination can say)"),
    Pathway("fatigue", "tiredness or weakness",
            (r"\b(?:so |very |really |always |extremely )?(?:tired|exhausted|fatigue\w*|weak|drained|worn out|no energy)\b",),
            (
                S("breathless_dizzy", "any breathlessness, racing heart, dizziness or fainting", rf"\b(?:breath\w*|heart|palpitat\w*)\b|{_DIZZY}", red_flag=True),
                S("sleep", "how she has been sleeping", r"\b(?:sleep\w*|night|insomnia|awake|wake|rest\w*|nap\w*)\b"),
                S("different", "whether it is the usual tiredness or feels different this time", r"\b(?:usual|different|normal|worse|new|never|always|same)\b"),
                S("eating_iron", "how she is eating, and whether she takes iron or has had a blood count (PCV/Hb) recently",
                  r"\b(?:eat\w*|food|appetite|iron|pcv|hb|haemoglobin|hemoglobin|blood (?:count|level)|anaemi\w*|anemi\w*|vitamin\w*)\b"),
                S("mood", "how her mood has been", r"\b(?:mood|sad|low|down|anxi\w*|stress\w*|happy|okay|fine|depress\w*)\b"),
                _DURATION_SLOT,
            ),
            memory_keys=("tiredness", "trouble sleeping"),
            explain="common reasons for her stage (pregnancy, broken sleep with a baby, low iron, stress, low mood), practical ways to "
                    "rest and eat well, and that lasting tiredness, breathlessness or dizziness deserves a blood count check"),
    Pathway("missed_period", "a late or missed period",
            (r"\b(?:missed|late|no|skipped|haven'?t (?:seen|had)) (?:my )?(?:period|menses|monthly)\b", r"\bperiod (?:is |has been )?(?:\w+ ){0,3}(?:late|overdue|missing)\b",
             r"\bperiod (?:never |didn'?t |did not |hasn'?t |has not )(?:come|show)"),
            (
                S("pain_bleeding", "any one-sided or sharp pain, shoulder-tip pain, dizziness, or bleeding", rf"\b(?:pain\w*|cramp\w*|bl[eai]+d\w*|spotting|shoulder)\b|{_DIZZY}", red_flag=True),
                S("days_late", "how many days late it is, and her usual cycle length", r"\b(?:\d+ (?:days?|weeks?)|days? late|weeks? late|cycle|usually|every \d+|regular|irregular|days)\b"),
                S("test", "whether she has done a pregnancy test, and the result", r"\b(?:test\w*|positive|negative|line|lines)\b"),
                S("contraception_sex", "whether pregnancy is possible (sex since her last period, contraception)", r"\b(?:sex|contracepti\w*|pill|condoms?|implant|injection|depo|iud|coil|protection|postinor)\b"),
                S("other_changes", "any recent stress, weight change, illness, new medicine or breastfeeding", r"\b(?:stress\w*|weight|ill|sick|medic\w*|travel\w*|breastfe\w*|exercise|diet)\b"),
            ),
            stages=("general", "ttc", None),
            explain="the common reasons (pregnancy, stress, weight change, illness, hormonal contraception, breastfeeding, PCOS, "
                    "perimenopause), when and how to do a pregnancy test, and which symptoms with a missed period need care now"),
    Pathway("fever", "fever or feeling hot",
            (r"\bfever\w*", r"\bhigh temperature\b", r"\b(?:body|i) (?:is |dey |feel )?(?:very )?hot\b", r"\bchills\b", r"\bfeverish\b"),
            (
                S("temperature", "her temperature if she has a thermometer", r"\b(?:3[5-9](?:\.\d)?|4[0-2](?:\.\d)?|9\d(?:\.\d)?|10\d(?:\.\d)?|thermometer|degrees?|°)\b"),
                S("danger", "any confusion, fast breathing, fainting, a stiff neck, or (after birth) a bad-smelling discharge or a painful wound",
                  rf"\b(?:confus\w*|breath\w*|neck|smell\w*|wound|stitches|rash)\b|{_DIZZY}", red_flag=True),
                S("other_symptoms", "other symptoms (pain passing urine, cough, belly pain, vomiting, body pains)", r"\b(?:urin\w*|pee\w*|cough\w*|pain\w*|vomit\w*|ache\w*|catarrh|cold)\b"),
                S("malaria", "whether she has had a malaria test", r"\b(?:malaria|rdt|test\w*|mp)\b"),
                _DURATION_SLOT,
            ),
            memory_keys=("fever",),
            explain="that fever needs its cause found, especially in pregnancy or after birth (malaria, urine infection and others are "
                    "common in Nigeria and treatable), safe ways to stay comfortable and hydrated without naming doses, and the signs that "
                    "make it an emergency"),
    Pathway("back_pain", "back pain",
            (r"\bback ?(?:pain|ache)\b", r"\b(?:my )?back (?:is |dey )?(?:hurt\w*|ach\w*|pain\w*)", r"\bwaist (?:is |dey )?pain\w*", r"\blower back\b"),
            (
                S("pattern", "whether it comes and goes in waves or tightenings, or is constant", r"\b(?:come\w* and go\w*|waves?|tighten\w*|regular|constant|all the time|on and off|every \d+)\b",
                  red_flag=True, stages=("pregnancy",)),
                S("fever_urine", "any fever, pain passing urine, or pain on one side under the ribs", rf"{_FEVER}|\b(?:urin\w*|pee\w*|side|kidney|ribs?)\b", red_flag=True),
                S("severity", "how bad it is", _SEVERITY),
                _DURATION_SLOT,
                S("what_helps", "what makes it better or worse (posture, lifting, rest)", r"\b(?:sit\w*|stand\w*|lift\w*|rest\w*|lying|bend\w*|walk\w*|sleep\w*|better|worse)\b"),
            ),
            memory_keys=("back pain",),
            explain="common causes (posture, pregnancy hormones loosening the joints, lifting and carrying a baby), comfort measures and "
                    "positions, and the signs that point to labour, a kidney infection or something needing a check"),
    Pathway("swelling", "swelling",
            (r"\bswell\w*", r"\bswollen\b", r"\bpuffy\b", r"\b(?:legs?|feet|ankles?) (?:are |is )?(?:big|fat|swell\w*)\b"),
            (
                S("where_sudden", "where (feet and ankles, face, hands) and whether it came on suddenly",
                  r"\b(?:feet|foot|ankles?|legs?|calf|face|eyes?|hands?|fingers?|sudden\w*|gradual\w*|slowly|morning|evening)\b", red_flag=True),
                S("one_leg", "whether one leg is more swollen, painful, red or warm than the other", r"\b(?:one leg|both|left|right|calf|red|warm|hot|tender)\b", red_flag=True),
                S("headache_vision", "any headache, vision changes or upper belly pain", r"\b(?:head\w*|vision|blur\w*|eyes?|see\w*|belly|stomach|ribs)\b",
                  red_flag=True, stages=("pregnancy", "postpartum")),
                S("blood_pressure", "her most recent blood pressure reading", r"\b(?:blood pressure|bp|\d{2,3} ?/ ?\d{2,3}|pressure)\b", stages=("pregnancy", "postpartum")),
                _DURATION_SLOT,
            ),
            memory_keys=("swelling",),
            explain="that gentle swelling of the feet and ankles late in the day is common in pregnancy, practical tips (feet up, "
                    "moving, fluids), and that sudden swelling of the face or hands, one painful leg, or swelling with headache or vision "
                    "changes needs checking today"),
    Pathway("hot_flushes", "menopause symptoms",
            (r"\bhot (?:flush|flash)\w*", r"\bnight sweats\b", r"\bperimenopaus\w*", r"\bvaginal dryness\b"),
            (
                S("bleeding_after", "whether there has been any bleeding after her periods stopped for a year", r"\b(?:bl[eai]+d\w*|spotting|period\w*)\b", red_flag=True),
                S("impact", "how much it is affecting sleep, work, mood or relationships", r"\b(?:sleep\w*|work\w*|mood|night|relationship|sex|daily|life)\b"),
                S("last_period", "when her last period was and whether periods have become irregular", r"\b(?:period\w*|months?|year\w*|irregular|stopped)\b"),
                S("age_tried", "her age range and what she has already tried", r"\b(?:\d{2}|forties|fifties|tried|using|took|taking)\b"),
            ),
            memory_keys=("hot flushes",),
            explain="what is happening in perimenopause and menopause, day-to-day measures (layers, cool room, avoiding triggers, "
                    "movement, sleep routine), that treatments including hormone therapy are a decision for her clinician, and that any "
                    "bleeding after periods have stopped for a year needs a prompt check"),
)

_COMPILED = {p.id: tuple(re.compile(t, re.I) for t in p.triggers) for p in PATHWAYS}
_SLOT_RX = {(p.id, s.key): re.compile(s.known, re.I) for p in PATHWAYS for s in p.slots}
_BY_ID = {p.id: p for p in PATHWAYS}

# She wants an answer now, not more questions.
_WANTS_ANSWER = re.compile(r"\b(?:just (?:tell|answer)|what (?:is it|do you think|could it be|should i do|do i do)|is it (?:serious|normal|bad|dangerous)|"
                           r"stop asking|too many questions|what does (?:it|this) mean|should i (?:be worried|worry|go))\b", re.I)


def _is_answer(text: str) -> bool:
    """Her message reads as a reply to Loni's question, not a new topic: short, and not a fresh general question
    ("what foods should I eat?"), unless she is asking for Loni's view of this concern ("what could it be?")."""
    t = (text or "").strip()
    if len(t) > _ANSWER_MAX_CHARS:
        return False
    from app.modules.ai_chat.triage import _INFO_Q, _normalise
    return not _INFO_Q.search(_normalise(t)) or bool(_WANTS_ANSWER.search(t))


@dataclass
class Investigation:
    pathway: Pathway
    known: List[Slot] = field(default_factory=list)
    missing: List[Slot] = field(default_factory=list)
    from_profile: List[str] = field(default_factory=list)
    recurring: Optional[str] = None     # an earlier note of the same symptom ("she said, last mentioned 9 days ago")
    turns: int = 0                      # investigative turns already spent on this concern
    ready: bool = False                 # enough is known (or she wants an answer): explain now

    @property
    def id(self) -> str:
        return self.pathway.id


def _stage_ok(stages: Sequence[Optional[str]], skip: Sequence[str], kind: Optional[str]) -> bool:
    if stages and kind not in stages:
        return False
    return kind not in skip


def detect(text: str, stage: StageContext) -> Optional[Pathway]:
    """The pathway her message starts, or None. First match wins (the list is ordered by priority)."""
    t = (text or "").lower().replace("’", "'")
    for p in PATHWAYS:
        if not _stage_ok(p.stages, p.skip_stages, stage.kind):
            continue
        if any(rx.search(t) for rx in _COMPILED[p.id]):
            return p
    return None


def _ongoing(history: Sequence[dict]) -> Tuple[Optional[str], int]:
    """(pathway id, turns spent) from the most recent assistant messages that were investigating."""
    pid, turns = None, 0
    for m in reversed(history):
        if m.get("role") != "assistant":
            continue
        inv = (m.get("meta") or {}).get("investigation")
        if not inv:
            break
        if pid is None:
            if inv.get("ready"):
                return None, 0             # Loni already gave her answer: the investigation is over
            pid = inv.get("id")
        if inv.get("id") != pid:
            break
        turns += 1
    return pid, turns


def assess(text: str, stage: StageContext, history: Sequence[dict] = (), symptom_notes: Iterable[Tuple[str, str]] = (),
           personal: bool = True) -> Optional[Investigation]:
    """What is known and missing for the symptom she is talking about, or None when no investigation applies.

    `history` is this session's messages (oldest first, may include the current one); `symptom_notes` is
    (memory symptom key, description line) for what Loni remembers about her; `personal` is False for a general
    question ("why do women get cramps?"), which is answered, not investigated."""
    ongoing_id, turns = _ongoing(history)
    pathway = detect(text, stage) if personal else None
    if pathway is None and ongoing_id in _BY_ID and _is_answer(text):
        pathway = _BY_ID[ongoing_id]       # she is answering Loni's last question about this concern
    if pathway is None:
        return None
    if pathway.id != ongoing_id:
        turns = 0                          # a new concern starts its own investigation

    # Only her words since this concern came up count (an older, different complaint must not fill slots).
    mine = [m.get("content") or "" for m in history if m.get("role") == "user"][-min(turns + 1, _LOOKBACK):]
    if not mine or mine[-1] != text:
        mine.append(text)
    said = "\n".join(mine).lower().replace("’", "'")

    inv = Investigation(pathway, turns=turns)
    for slot in pathway.slots:
        if not _stage_ok(slot.stages, (), stage.kind):
            continue
        if stage.kind in slot.skip_stages:
            if slot.key == "pregnancy_possible":
                inv.from_profile.append("she is pregnant (profile)" if stage.kind == "pregnancy" else "she recently gave birth (profile)")
            continue
        (inv.known if _SLOT_RX[(pathway.id, slot.key)].search(said) else inv.missing).append(slot)
    inv.missing.sort(key=lambda s: not s.red_flag)   # warning-sign questions first, stable otherwise

    for key, line in symptom_notes:
        if key in pathway.memory_keys:
            inv.recurring = line.lstrip("- ").strip()
            break

    open_flags = [s for s in inv.missing if s.red_flag]
    inv.ready = (not open_flags and len(inv.missing) <= 2) or turns >= MAX_TURNS or bool(_WANTS_ANSWER.search(text or "")) or not inv.missing
    return inv


def directive(inv: Investigation) -> str:
    """The per-turn note for the model."""
    p = inv.pathway
    lines = [f"SYMPTOM INVESTIGATION: {p.label} (pathway {p.id} v{PATHWAY_VERSION})."]
    known = [s.key.replace("_", " ") for s in inv.known] + inv.from_profile
    if known:
        lines.append("Already known from her (do NOT ask again): " + "; ".join(known) + ".")
    lines.append("Anything in WHAT YOU KNOW ABOUT HER also counts as known (cycle length, last period, conditions, medicines): use it "
                 "instead of asking, but re-check things that may have changed (pregnancy status, current symptoms, dates).")
    if inv.recurring:
        lines.append(f"She has mentioned this before: {inv.recurring}. Acknowledge that naturally and ask whether it feels the same or different this time.")
    if inv.ready:
        if inv.missing:
            lines.append("Still unknown: " + "; ".join(s.ask for s in inv.missing[:3]) + ".")
        lines.append(f"You now know enough to help: stop investigating and give her a real answer. Explain {p.explain}. "
                     "Present causes as possibilities, never a diagnosis. Say plainly whether and how soon she should be seen, and why. "
                     "If one missing detail would change your advice, you may ask it at the end, once.")
    else:
        nxt = inv.missing[:2]
        flagged = [s for s in nxt if s.red_flag]
        lines.append("Still unknown, most important first: " + "; ".join(
            ("[warning sign] " if s.red_flag else "") + s.ask for s in inv.missing[:5]) + ".")
        lines.append("Now: acknowledge what she said in a sentence (specific to her words, not a stock line), give any useful "
                     "information you can already give, then ask about " + " and ".join(s.ask for s in nxt) +
                     " in your own natural words (one or two short questions, not a form). " +
                     ("If a question is sensitive, say briefly why you are asking. " if flagged or any(s.key == "pregnancy_possible" for s in nxt) else "") +
                     "Do not send her to a nurse just because you are still finding out. If her answer reveals a warning sign, "
                     "tell her clearly to get care.")
    return "\n".join(lines)


def meta(inv: Investigation) -> dict:
    """Stored on the assistant message so the next turn continues the same investigation. No health text."""
    return {"id": inv.pathway.id, "version": PATHWAY_VERSION, "turn": inv.turns + 1, "ready": inv.ready,
            "missing": [s.key for s in inv.missing]}
