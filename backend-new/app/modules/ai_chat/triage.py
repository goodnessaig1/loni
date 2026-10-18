"""
Rule-based maternal danger-sign triage. Runs BEFORE the language model and never depends on it.

Why it is separate: a chat model answers the literal question. For a mother who writes "I'm bleeding heavily,
can I sleep first?" the real question is "do I need care now?", and that decision has to be deterministic,
fast and auditable. So:

* EMERGENCY  -> the app answers with a fixed, pre-reviewed message at once. The model is not called.
* URGENT     -> a fixed "get checked today" line is sent first, then the model explains, under a directive
                that forbids reassurance. Output is checked afterwards (safety.py).
* ROUTINE / EDUCATIONAL -> normal model answer, shaped by the question type.

Design choices (all biased towards NOT under-triaging):
* Over-triage costs a mother a few seconds; under-triage can cost a life. When in doubt the higher level wins.
* Negation ("no bleeding") only cancels a symptom when it sits right in front of it.
* A *general* question ("what are the signs of preeclampsia?") is educational; the same words said in the
  first person ("I have a severe headache and blurry vision") are not.
* Context can raise urgency (labour or waters breaking before 37 weeks) and can lower it (no kicks felt at
  10 weeks is normal), and nothing else does.

Sources for the danger signs: WHO maternal/newborn danger-sign guidance (antenatal, intrapartum, postnatal
care, essential newborn care). THIS FILE MUST BE REVIEWED AND SIGNED OFF BY A QUALIFIED MATERNAL-HEALTH
CLINICIAN BEFORE RELEASE, including the Nigerian Pidgin phrases (needs a native speaker).
"""
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Tuple


class Urgency(str, Enum):
    emergency = "emergency"
    urgent = "urgent"
    routine = "routine"
    educational = "educational"


_RANK = {Urgency.educational: 0, Urgency.routine: 1, Urgency.urgent: 2, Urgency.emergency: 3}


@dataclass(frozen=True)
class StageContext:
    """What we know about the mother from her profile (not from the message)."""
    kind: Optional[str] = None      # 'pregnancy' | 'postpartum' | 'general' (not pregnant) | 'ttc' (trying to conceive) | None
    week: Optional[int] = None      # gestational week, or weeks since birth


@dataclass(frozen=True)
class Rule:
    id: str
    urgency: Urgency
    domain: str                      # pregnancy | postpartum | newborn | mental_health | safety
    groups: Tuple[Tuple[str, ...], ...]  # AND of ORs: every group needs at least one matching pattern
    template: str = "maternal"       # which fixed emergency message to use
    preterm_escalates: bool = False  # urgent -> emergency when known to be before 37 weeks
    min_week: Optional[int] = None   # ignored when the mother is known to be earlier than this
    source: str = "WHO danger signs"


@dataclass
class TriageResult:
    urgency: Urgency
    domain: str = "general"
    template: str = "maternal"
    rule_ids: List[str] = field(default_factory=list)
    answer_type: str = "other"
    info_only: bool = False          # a general question that merely mentions a danger sign
    actions: List[dict] = field(default_factory=list)


# ── vocabulary ───────────────────────────────────────────────────────────────

BLEED = r"bl[eai]+d(?:ing|s)?"
HEAVY = (r"(?:hea?v(?:y|ily|ly|iy)|a lot|lots? of|too much|so much|plenty|profuse(?:ly)?|excessive(?:ly)?|badly|"
         r"severe(?:ly)?|non ?stop|nonstop|soaking|gushing|pouring|flooding|streaming)")
BABY = (r"(?:baby|babies|newborn|new born|infant|my (?:son|daughter|child|twins?|little one)|"
        r"\b\d+[- ]?(?:day|week|hour)s?[- ]old|days? old|weeks? old|neonat)")
VISION = (r"(?:blur(?:red|ry)?(?: vision)?|vision (?:is |has )?(?:blur|chang|dim|gone|loss)|can'?t see|cannot see|"
          r"double vision|seeing (?:spots|stars|flash|lights|things)|flashing lights?|everything (?:is |looks? |went |goes |became )?(?:blur|dim|dark|fuzzy|cloudy)|spots? (?:in|before) (?:my )?(?:eyes|vision)|"
          r"lost (?:my )?(?:sight|vision)|sudden(?:ly)? (?:can'?t|cannot) see|eyes? (?:are |is )?(?:blur|dim))")
HEADACHE = r"(?:head ?ache|head (?:is )?(?:pounding|splitting|killing|hurting)|head (?:hurts?|aches?)|migraine|head pain)"
SEVEREH = r"(?:severe(?:ly)?|terrible|worst|splitting|unbearable|excruciating|intense|killing|pounding|horrible|extreme(?:ly)?|very bad|so bad|really bad|bad|strong|awful|serious|major|big|persistent(?:ly)?|won'?t go away|not going away)"
SEVERE = r"(?:severe(?:ly)?|terrible|worst|splitting|unbearable|excruciating|intense|killing|pounding|horrible|extreme(?:ly)?|very bad|so bad|persistent(?:ly)?|won'?t go away|not going away)"

R = Rule
U = Urgency

RULES: Tuple[Rule, ...] = (
    # ── mental health & safety (most time-critical, checked in the same pass) ──────────────────────
    R("self_harm", U.emergency, "mental_health", template="crisis", source="Suicide/self-harm safety", groups=((
        r"kill(?:ing)? my ?self", r"end(?:ing)? (?:my|it all|my life)", r"want(?:ing)? to die", r"wanna die",
        r"suicid", r"hurt(?:ing)? my ?self", r"harm(?:ing)? my ?self", r"better off (?:dead|without me)",
        r"don'?t want to (?:live|be alive|be here)", r"no reason to live", r"take my own life", r"cut(?:ting)? my ?self",
        r"overdose", r"(?:want|wish|wanna|hope|rather|ready|going|just want) (?:to |i could |i would |i'?d |i was |i were )?(?:just )?(?:die|be dead|disappear|vanish|not exist|be gone|sleep forever|not wake up)", r"disappear forever", r"(?:end|ending) (?:it|everything)", r"not (?:want|wish) to (?:live|wake up)",
    ),)),
    R("harm_baby", U.emergency, "mental_health", template="harm_baby", source="Postnatal mental health safety", groups=((
        r"(?:hurt|harm|kill|drop|shake|smother|suffocate|throw)(?:ing)? (?:my |the )?(?:baby|newborn|child|infant)",
        r"(?:thoughts?|urge|feel(?:ing)?|scared|afraid|fear) (?:of |that i (?:will|might|could) )?(?:hurt|harm|kill)(?:ing)? (?:my |the )?(?:baby|newborn|child)",
        r"(?:baby|child|newborn) (?:would be|is) better off without me", r"(?:want|wanna|urge|feel like|going|tempted|could|might|i'?ll|i will) (?:to )?(?:shake|hit|hurt|harm|throw|smother|slap|strangle|choke|drop|kill) (?:him|her|them|the baby|my baby|my son|my daughter|the child|my child)",
    ),)),
    R("abuse", U.urgent, "safety", template="abuse", source="Safety / gender-based violence", groups=((
        r"(?:he|my (?:husband|partner|boyfriend|man|in-?laws?)|someone|they) (?:is |are |has |have |keeps? |always )?(?:beat(?:ing|s)?|hit(?:ting|s)?|slap(?:ping|s)?|punch(?:ing|es)?|kick(?:ing|s)? me|chok(?:ing|es)?|threaten(?:ing|s)? (?:me|to kill))",
        r"(?:i am|i'?m|im) (?:being )?(?:abused|beaten|hit|hurt by (?:him|my))", r"domestic violence", r"afraid (?:of|for my life)",
        r"(?:he|they) (?:will|want(?:s)? to|might) (?:kill|hurt) me",
    ),)),
    # ── emergencies in pregnancy / labour / after birth ───────────────────────────────────────────
    R("heavy_bleeding", U.emergency, "pregnancy", groups=((
        rf"{HEAVY} (?:vaginal )?(?:{BLEED}|blood)", rf"{BLEED} {HEAVY}", rf"{BLEED} (?:won'?t|will not|doesn'?t|does not|can'?t|cannot|not) (?:stop|slow)",
        rf"(?:{BLEED}|blood) (?:is |was |has been |became |getting |gets )?(?:very |so |really |extremely |too )*(?:heav(?:y|ier|ily)|much|a lot|worse|more and more)", rf"{BLEED}.{{0,30}}(?:getting worse|gets worse|increasing|more and more|heavier|worse and worse)",
        r"blood (?:no )?dey (?:stop|finish)|blood no (?:dey )?stop",
        r"(?:can'?t|cannot|won'?t) stop (?:the )?(?:bleeding|bleding|blood)", r"soak(?:ed|ing)? (?:through )?(?:a |one |my |the |two |three |\d+ )?(?:pads?|sanitary|bed|clothes|sheets|towel)",
        r"(?:blood|bleeding) (?:is )?(?:pouring|gushing|streaming|flowing|running) ", r"blood (?:is )?(?:coming|dripping|running) (?:out )?(?:down|everywhere|fast)",
        r"(?:large|big|huge|golf ball|fist)[- ]?(?:sized? )?clots?", r"passing (?:big |large )?clots", r"blood dey (?:com+ot|flow|run|pour)(?: well well)?", r"like a tap", r"pool of blood", r"blood (?:is )?(?:all over|everywhere|all around)", r"(?:bed|sheets|floor|clothes|dress|chair|toilet|bathroom) (?:is |are |was |were |got |full of |covered in |covered with )?(?:full of |covered in |soaked (?:in|with) |drenched (?:in|with) )?blood", r"(?:lost|losing|loosing) (?:so |too |a lot of )?(?:much )?blood",
    ),)),
    R("seizure", U.emergency, "pregnancy", template="seizure", groups=((
        r"seiz(?:ure|ing|ed)s?", r"convuls", r"\b(?:having|had|got|my|she'?s having|he'?s having|she is having|she had|he had) (?:a )?fits?\b", r"\bfitting\b",
        r"(?:shaking|jerking|twitching) (?:uncontrollably|all over|violently)", r"eyes? (?:rolled|rolling|roll) (?:back|up)", r"foaming (?:at|from) (?:the )?mouth", r"(?:stiff|rigid) (?:and )?(?:shaking|jerking|unresponsive)", r"body (?:is )?(?:shaking|jerking) (?:and|uncontrollably)",
    ),)),
    R("severe_breathing", U.emergency, "pregnancy", template="breathing", groups=((
        r"(?:can'?t|cannot|unable to|couldn'?t|struggling to|difficult(?:y)? (?:to |in )?|hard to|no air to) ?breath", r"(?:can'?t|cannot) get (?:any )?(?:air|breath)",
        r"gasping", r"(?:not|isn'?t|is not|stopped) breathing (?:properly|well|right|normally)", r"breathing (?:has )?stopped", r"(?:have|having|has|had|got|getting|with|in) (?:a lot of |some |severe |serious )?(?:trouble|difficulty|problems?|issues?|a hard time|hard time) (?:with )?breath", r"(?:turning|turned|going|gone) blue", r"blue (?:lips|face|skin|around)", r"(?:severe|extreme|sudden|serious) (?:shortness of breath|breathing (?:difficulty|trouble|problems?))",
        r"chest pain", r"pain in (?:my )?chest", r"(?:breath|breathing) (?:is )?(?:very |too )?(?:fast|hard|heavy|laboured|labored) and (?:chest|can'?t)", r"suffocating", r"no dey (?:fit )?breathe",
    ),)),
    R("breathless_concerning", U.urgent, "pregnancy", groups=((
        r"short(?:ness)? of breath", r"breathless", r"can'?t catch my breath", r"out of breath",
    ), (
        r"sudden(?:ly)?", r"at rest", r"resting", r"lying down", r"worse", r"worsening", r"constant", r"cough(?:ing)? (?:up )?blood", r"(?:with|and) (?:a )?(?:chest|racing heart|fast heart|palpitations|dizz)", r"dizzy", r"racing heart", r"palpitations",
    ))),
    R("collapse", U.emergency, "pregnancy", groups=((
        r"(?:fainted|passed out|collaps(?:ed|ing)|blacked out|black(?:ed)? out|unconscious|unresponsive|not responding|won'?t wake|can'?t wake|fell unconscious|lost consciousness|drop(?:ped)? (?:down|unconscious|on the floor|to the floor)|fell (?:down )?(?:and )?(?:isn'?t|is not|not) (?:moving|responding)|(?:going|about) to (?:faint|pass out|collapse)|feel(?:ing)? (?:very )?faint)",
    ),)),
    R("headache_vision", U.emergency, "pregnancy", source="WHO: pre-eclampsia danger signs", groups=((HEADACHE,), (VISION,))),
    R("severe_abdominal_pain", U.emergency, "pregnancy", groups=((
        rf"{SEVERE} (?:lower )?(?:abdomin(?:al)?|stomach|belly|tummy|pelvic|womb|uterus|side) ?(?:pain|cramp)", rf"(?:abdomin(?:al)?|stomach|belly|tummy|pelvic|womb|uterus) ?(?:pain|cramps?) (?:is |are )?(?:so |very )?(?:severe|unbearable|excruciating|terrible|intense|constant)",
        r"(?:sudden|sharp|stabbing|tearing|ripping) (?:and )?(?:severe |intense )?(?:abdomin(?:al)?|stomach|belly|tummy|pelvic|womb)? ?pain", r"pain (?:is )?(?:so |too )?(?:bad|severe|much|unbearable) (?:that )?(?:i )?(?:can'?t|cannot)",
        r"(?:belle|belly|stomach) (?:dey|is) (?:pain|paining|hurt) me (?:well well|too much|bad)", rf"{SEVERE} pain (?:in|on|around|at) (?:my )?(?:lower )?(?:abdomen|belly|stomach|tummy|pelvis|pelvic|womb|uterus|side)", r"(?:too much|too bad|too painful|too severe) to bear|can'?t bear (?:the|this|it|that)", r"hard (?:as a )?(?:rock|board)(?: belly| stomach| abdomen)?", r"(?:belly|stomach|abdomen) (?:is |has become |went |feels )?(?:rock )?hard (?:and|with) (?:pain|constant)",
    ),)),
    R("baby_coming", U.emergency, "pregnancy", template="birth", groups=((
        r"(?:baby|head|cord|feet?) (?:is )?(?:coming|crowning|out|showing|visible|delivering|being born)(?: now| out| already)?", r"(?:feel(?:ing)?|have|got) (?:the )?(?:urge|need) to push", r"(?:want|need|have|got) to push",
        r"(?:i'?m|i am|im|am) (?:already )?(?:pushing|delivering|giving birth now)", r"giving birth (?:now|right now|at home|in the car)", r"feel(?:ing)? like (?:i need to |i have to |i want to )?push", r"(?:going|about|gonna) to (?:deliver|give birth) (?:now|at home|here|in the car|before)", r"about to (?:deliver|give birth)", r"(?:i'?m|i am) (?:going to|gonna) have (?:the|my) baby (?:now|here|at home)", r"baby (?:is )?(?:coming|dey come) now",
        r"i (?:see|can see|feel) (?:the |my |a )?(?:head|cord|something) (?:coming|out|between)", r"cord (?:is )?(?:out|prolaps|hanging|showing)", r"something (?:is )?(?:coming|hanging|sticking|protruding|falling) (?:out|down|from)",
    ),)),
    # ── urgent: prompt assessment today ───────────────────────────────────────────────────────────
    R("any_bleeding", U.urgent, "pregnancy", groups=((
        rf"(?<!nose )(?<!gum )(?:vaginal )?(?:{BLEED}|spotting|blood (?:in|on|when|after|from))", r"(?:see|saw|seen|noticed|notice|found|find|have|having|had|got) (?:some |a little |a bit of |any |light |slight |pink |brown |fresh |red )?blood(?! ?(?:pressure|test|group|type|sugar|work|count|donation|result|level|glucose|thinner|clot(?:ting)? disorder))",
        r"blood (?:on|in) (?:my )?(?:underwear|panties|pad|toilet|tissue|pants|knickers)", r"(?:pink|brown|red) discharge",
    ),), min_week=None),
    R("reduced_movement", U.urgent, "pregnancy", min_week=16, source="WHO: reduced fetal movement", groups=((
        r"(?:baby|fetus|foetus|she|he|it|the baby) (?:has ?n'?t|hasn'?t|isn'?t|is not|is no longer|stopped|not|has stopped|doesn'?t|does not|no longer|barely|rarely|hardly|has not|stop) (?:been )?(?:moving|moved|kicking|kicked|move|kick|active|responding)",
        r"(?:reduced|less|decreased|slowed|slower|fewer|no|lack of|absent|little|very little|weak) (?:fetal |foetal |baby'?s? |baby )?(?:movements?|kicks?|kicking|activity)", r"(?:can'?t|cannot|don'?t|do not|didn'?t|did not|haven'?t|have not|no longer|stopped) (?:been )?(?:feel(?:ing)?|felt) (?:the |my |any )?(?:baby|movements?|kicks?|kicking|moving|her|him)",
        r"(?:moving|kicking|moves|kicks) (?:much |a lot |far |way )?(?:less|slower|weaker|differently|not as much|not like (?:before|usual)|lighter|barely)", r"(?:baby|she|he|it)'?s? (?:is |has been )?(?:not|isn'?t|less|much less) (?:as )?(?:active|lively|energetic)(?: as (?:usual|before|normal))?", r"(?:baby|belly|bump) (?:has been|is|was|went|got|seems?) (?:very |so |really |too )?(?:quiet|still|calm|silent)", r"(?:baby|belle|belly) (?:no|don) (?:dey )?(?:move|kick)", r"not (?:felt|feeling|feel) (?:the )?(?:baby|kick)", r"no movement",
    ),)),
    R("waters_break", U.urgent, "pregnancy", preterm_escalates=True, template="birth", groups=((
        r"(?:my )?(?:water|waters|membranes?) (?:has |have |just |had |is |are |was |were |been )*(?:broke|broken|breaking|burst|gone|leaking)", r"(?:fluid|water|liquid|amniotic|wetness|something) (?:is |has been |keeps? |was )?(?:leak(?:ing|s)?|gush(?:ing|ed|es)?|trickl(?:e|ing)|coming out|running down|flowing)",
        r"leak(?:ing|s|ed)? (?:fluid|water|liquid|urine or fluid)", r"green(?:ish)? (?:fluid|water|discharge|liquid)", r"(?:meconium)",
    ),)),
    R("labour_signs", U.urgent, "pregnancy", preterm_escalates=True, template="birth", groups=((
        r"(?:contractions?|labou?r pains?|pains?|tightenings?) (?:are |is |that are |that is )?(?:every|coming every|getting|regular|closer|stronger|lasting|each|about every|\d+)", r"(?:i'?m|i am|im|am) (?:in|having|starting|going into|probably in|think i'?m in) (?:active )?labou?r",
        r"(?:in|started|started having|start(?:ed|ing) to have|going into|think i'?m in|may be in) labou?r", r"(?:regular|painful|strong|frequent|closer together|timing) contractions?", r"contractions? (?:started|began|have started|every \d+)",
        r"(?:\d+|few|five|ten|three|two) minutes? apart", r"labou?r (?:has |have )?(?:started|begun|begin)", r"(?:belly|belle|stomach) (?:dey )?(?:tighten|tight) (?:and|with) (?:pain|regular)",
    ),)),
    R("prolonged_labour", U.urgent, "pregnancy", template="birth", groups=((
        r"labou?r (?:for|since|has been|has lasted|lasting) (?:\d+|two|three|four|a|many|over|more than) ?(?:days?|hours?|nights?)", r"(?:in|been in) labou?r (?:for|since) (?:\d+|two|three|a|many) ?(?:days?|hours?)", r"contractions? (?:for|since) (?:\d+|two|three|a|many) ?(?:days?|hours?)", r"(?:nothing|no progress) (?:is )?happening",
    ),)),
    R("wet_leak", U.urgent, "pregnancy", preterm_escalates=True, template="birth", groups=((
        r"(?:gush|gushed|gushing) of (?:fluid|water|liquid)", r"(?:felt|feel|feeling) a (?:gush|pop)", r"wet(?:ness)?.{0,25}(?:running|leaking|trickl|down my leg|soaking)", r"(?:running|trickling|dripping|leaking) (?:down|along) (?:my )?(?:leg|thigh)",
    ),)),
    R("needs_transport", U.urgent, "pregnancy", template="transport", source="LONI care access", groups=((
        r"(?:need|have|got|want) to (?:get|go|reach|be) (?:to )?(?:the )?(?:hospital|clinic|maternity|labou?r ward|emergency)(?: now| fast| quickly| urgently| immediately| asap| tonight| right now)?",
        r"(?:take|carry|rush|drive|bring) me (?:to )?(?:the )?(?:hospital|clinic|maternity)", r"(?:need|get me|call|send|want) (?:an |a )?(?:ambulance|emergency ride|ride to (?:the )?hospital|driver)(?: now| urgently| fast| immediately)?",
        r"how (?:do|can) i (?:get|reach) (?:to )?(?:the )?hospital (?:now|fast|quickly|urgently)", r"(?:get|go|taking|rush|rushed|rushing) (?:to|me to) (?:the )?hospital (?:now|fast|quickly|urgently|immediately|asap)",
        r"(?:need|want) transport (?:to|for) (?:the )?(?:hospital|clinic)", r"(?:hospital|clinic) (?:now|urgently|immediately|asap)",
    ), (
        r"now|urgent|immediately|asap|quickly|fast|emergency|right away|tonight|tonite|pain|bleed|labou?r|contraction|waters|scared|help|please",
    ))),
    # ── women's health beyond pregnancy ───────────────────────────────────────────────────────────
    R("early_pregnancy_danger", U.emergency, "womens_health", source="Possible ectopic pregnancy", groups=((
        r"(?:missed|late|no|skipped) (?:my )?period", r"period (?:is |has been )?(?:late|missed|overdue)", r"(?:positive|two lines|2 lines|faint line) (?:on a |on the )?(?:pregnancy )?test", r"pregnancy test (?:is |was |came back )?positive",
        r"(?:might|may|could|think i'?m|think i am|just found out i'?m|just found out i am) (?:be )?pregnant", r"just found out (?:that )?i'?m pregnant",
    ), (
        r"(?:severe|sharp|stabbing|sudden|one[- ]sided|one side|shoulder(?:[- ]tip)?)[^.]{0,30}pain", r"pain[^.]{0,25}(?:one side|shoulder)", r"(?:faint|dizzy|fainting|passing out|collaps)",
    ))),
    R("early_pregnancy_bleeding", U.urgent, "womens_health", source="Early pregnancy bleeding/pain", groups=((
        r"(?:missed|late|no|skipped) (?:my )?period", r"period (?:is |has been )?(?:late|missed|overdue)", r"(?:positive|two lines|2 lines|faint line) (?:on a |on the )?(?:pregnancy )?test", r"pregnancy test (?:is |was |came back )?positive",
        r"(?:might|may|could|think i'?m|think i am) (?:be )?pregnant",
    ), (
        r"(?:spotting|bleeding|bleed|cramp(?:s|ing)?|pain)",
    ))),
    R("postmenopausal_bleeding", U.urgent, "womens_health", template="soon", source="Postmenopausal bleeding", groups=((
        r"menopaus", r"post-?menopaus", r"(?:periods?|menstruation) (?:stopped|ended|ceased|have stopped|finished)", r"(?:stopped|no longer have|haven'?t had|have not had) (?:my )?periods? (?:for|in|since) (?:\d+|a few|many|several|over a|more than a) ?(?:years?|yrs)",
    ), (
        rf"(?:{BLEED}|spotting|blood)",
    ))),
    R("breast_lump", U.urgent, "womens_health", template="soon", source="Breast changes", groups=((
        r"(?:found|feel|felt|noticed|have|got|discovered|notice|see|saw) (?:a |an )?(?:new )?(?:hard )?(?:lump|knot|mass|swelling|hard (?:spot|area|patch))(?: in| on| under| near)?(?: my)? ?(?:breast|boob|armpit|nipple|chest)?", r"(?:lump|knot|mass) (?:in|on|under|near) (?:my )?(?:breast|boob|armpit|nipple)",
        r"nipple (?:is )?(?:discharg|bleed|inverted|turned inward|crust|leak(?:ing)? (?:blood|fluid))", r"(?:bloody|blood|clear|brown|green) discharge (?:from|out of|coming from) (?:my )?(?:nipple|breast)", r"(?:breast|boob) skin (?:is |has )?(?:dimpl|pucker|orange peel|thick|red and (?:thick|itchy))", r"dimpl(?:ing|ed) (?:on|in) (?:my )?(?:breast|boob)",
    ), (
        r"(?:breast|boob|nipple|armpit|chest)",
    ))),
    R("uti_red_flags", U.urgent, "womens_health", source="Urinary infection with warning signs", groups=((
        r"(?:burning|stinging|painful|pain|hurts?|burns?) (?:when|while|on) (?:i )?(?:pee|peeing|urinat|passing urine|urination)", r"\buti\b", r"urinary (?:tract )?infection", r"bladder infection", r"(?:frequent|constant|urgent) (?:need to )?(?:pee|urinat)",
    ), (
        r"fever", r"chills", r"back pain", r"flank", r"side pain", r"(?:pain|ache) in (?:my )?(?:back|side|kidney)", r"vomit", r"blood in (?:my )?(?:urine|pee)", r"bloody (?:urine|pee)", r"shiver", r"(?:very |so )?weak",
    ))),
    R("pelvic_infection_signs", U.urgent, "womens_health", source="Possible pelvic infection", groups=((
        r"discharge", r"vaginal (?:smell|odou?r)", r"(?:smelly|foul|fishy|bad[- ]smelling)",
    ), (
        r"fever", r"pelvic pain", r"(?:lower )?(?:abdominal|belly|stomach|tummy) pain", r"painful (?:sex|intercourse)", r"pain (?:during|with|after) sex", r"chills",
    ))),
    R("sexual_assault", U.urgent, "safety", template="assault", source="Sexual violence support", groups=((
        r"\b(?:raped|rape|sexually assaulted|sexual assault|molested|molest|forced (?:me|himself|sex)|sexually abused|sexually harass|made me have sex|forced me to have sex|non-?consensual|without my consent)\b", r"(?:he|they|someone|man) (?:forced|raped|assaulted|touched) me",
    ),)),
    R("needs_ambulance", U.urgent, "pregnancy", template="transport", source="LONI care access", groups=((
        r"(?:need|get me|call|send|want|require|order) (?:an |a |the )?(?:ambulance|emergency ride|emergency driver)", r"ambulance (?:now|please|urgent|needed|quick)",
    ),)),
    R("fever", U.urgent, "pregnancy", source="WHO: fever in pregnancy/postnatal", groups=((
        r"(?:\bfever\b|feverish|febrile|high temp(?:erature)?|hot (?:body|all over)|burning up|body (?:is )?(?:very )?hot|temperature (?:of |is |was |at |reads? |reading )?(?:3[7-9]\.?\d?|4\d\.?\d?|10[0-9]|99|10[0-5])|chills (?:and|with) (?:fever|shaking)|shivering and (?:hot|sweating)|body dey hot)",
    ),)),
    R("persistent_vomiting", U.urgent, "pregnancy", groups=((
        r"(?:can'?t|cannot|unable to|not able to|couldn'?t|won'?t|don'?t|no way to) (?:keep|hold|stay) (?:any(?:thing)?(?: food| water| fluids?| liquids?)?|water|food|fluids?|liquids?|meds?|medicine) (?:down|in)", r"(?:hold|keep) down (?:any(?:thing)?|water|food|fluids?|liquids?|meals?)", r"vomit(?:ing)? (?:all day|constantly|non ?stop|every time|nonstop|everything|for days|more than|\d+ times|many times|repeatedly|continuously|too much)",
        r"(?:throwing up|being sick|puking) (?:all day|constantly|nonstop|every time|everything|for days|many times)", r"(?:severe|extreme|constant|persistent|uncontrolled|can'?t stop) (?:vomiting|nausea and vomiting|hyperemesis)", r"hyperemesis", r"(?:keep|kept|keeps) (?:on )?(?:vomiting|throwing up|puking|being sick)", r"dehydrat",
        r"(?:no|haven'?t|have not|hasn'?t) (?:pee(?:d|ing)?|urinat(?:ed|ing)|passed urine) (?:for|since|in|all) ", r"(?:very |so )?dark (?:urine|pee)", r"(?:dizzy|weak) and (?:vomiting|dehydrated|can'?t (?:eat|drink))",
    ),)),
    R("severe_headache", U.urgent, "pregnancy", source="WHO: pre-eclampsia danger signs", groups=((rf"{SEVEREH} {HEADACHE}", rf"{HEADACHE} (?:is |that is |which is |that |which )?(?:so |very )?(?:severe|terrible|unbearable|persistent|won'?t go away|not going away|not (?:going|getting) (?:away|better)|getting worse|worse|bad|doesn'?t go away|does not go away|never goes away|isn'?t going away|keeps coming back|lasts|lasting)", r"head (?:is )?(?:splitting|killing me|pounding)", r"headache (?:for|since|all|that (?:has )?(?:lasted|been)) (?:days|two days|three days|\d+ days|yesterday|all day|all night|since)"),)),
    R("vision_changes", U.urgent, "pregnancy", source="WHO: pre-eclampsia danger signs", groups=((VISION,),)),
    R("sudden_swelling", U.urgent, "pregnancy", source="WHO: pre-eclampsia danger signs", groups=((
        r"(?:sudden(?:ly)?|severe(?:ly)?|extreme(?:ly)?|rapid(?:ly)?|very|so|too much|worse|worsening) (?:swell(?:ing|en)|puffy|puffiness)", r"swoll?en (?:face|hands?|eyes?|eyelids?|fingers?)", r"(?:face|hands?|eyes?|eyelids?) (?:is |are |has |have |got |became |become |looks? |look )?(?:very |so |suddenly |really )?(?:swoll?en|puffy|swelling)",
        r"swell(?:ing|ed)? (?:in|of) (?:my )?(?:face|hands?|eyes?)", r"(?:legs?|feet|ankles?) (?:are |is |have |has )?(?:suddenly |very |so |extremely |really )(?:swoll?en|swelling)", r"(?:legs?|feet|ankles?) (?:are |is |have |has )?(?:swoll?en|swelling)(?: (?:badly|a lot|suddenly|on one side|one side))", r"(?:one|single) (?:leg|calf) (?:is |has )?(?:swoll?en|painful|red|warm|hot)",
        r"calf (?:pain|swelling|tender)", r"pain (?:and|with) swelling in (?:one|my) (?:leg|calf)",
    ),)),
    R("fall_or_trauma", U.urgent, "pregnancy", groups=((
        r"(?:i )?(?:fell|fall|slipped|tripped|was hit|got hit|been hit|hit my|bumped my|knocked|kicked in|punched in) (?:down|over|on|onto|in|into|against|hard|badly)?(?: my| the)? ?(?:belly|stomach|abdomen|tummy|bump)", r"(?:car|road|motorbike|bike|keke|okada|traffic|vehicle|bus) (?:accident|crash|collision)", r"(?:accident|crash)(?:.*)(?:pregnan|belly|stomach|bump)",
        r"(?:belly|stomach|abdomen|tummy|bump) (?:was |got |is )?(?:hit|kicked|punched|injured|trauma)", r"(?:fell|fall|fallen) (?:down )?(?:the )?stairs", r"(?:hit|fell on|landed on) (?:my )?(?:belly|stomach|bump)",
    ),)),
    R("pph_signs", U.urgent, "postpartum", groups=((
        r"(?:foul|bad|strong|offensive|stinking|smelly|smells?) (?:smelling |smell(?:ing)? )?(?:discharge|lochia|bleeding|odou?r|smell)", r"discharge (?:that )?(?:smells?|is smelly|has a (?:bad |foul |strong )?(?:smell|odou?r))",
        r"(?:wound|stitches?|incision|scar|cs ?scar|c-?section (?:wound|scar|cut)|episiotomy|tear) (?:is |are |has |have |looks? |became |become |got )?(?:infect|open(?:ed|ing)?|burst|pus|swoll?en|red|hot|leak|bleed|gaping|smell|painful|oozing|discharg|separat|came apart|split|breaking)",
        r"(?:c-?section|caesarean|cesarean|stitches|episiotomy|tear|wound|incision)\b.{0,40}\b(?:infect|pus|ooz|leak|smell|open|burst|gaping|red|hot|swoll?en|separat|discharg|pain)", r"(?:lump|hard (?:spot|area|patch)).{0,25}(?:hot|red|painful)", r"(?:breast|boob).{0,30}(?:hot and red|red and hot|red and painful|red and swollen)", r"(?:pus|ooz(?:ing|e)) (?:from|coming from|at|in) (?:my )?(?:wound|stitches|scar|incision|cut)", r"(?:bleeding|lochia) (?:has |have )?(?:started|returned|come back|increased|got heavier|is heavier|became heavier|is back|getting heavier|more) (?:again|after|heavily|a lot|more)",
        r"(?:breast|boob|nipple|chest) (?:is |are )?(?:hot|red|hard and (?:painful|hot)|very painful|swoll?en and red|have a (?:hard )?lump)(?: and (?:fever|feverish|flu))?", r"(?:mastitis|breast abscess)", r"(?:burning|painful|pain|hurt(?:s|ing)?) (?:when|while) (?:i )?(?:urinat|pee|passing urine)(?: and (?:fever|chills|back pain))",
    ),)),
    # ── newborn ───────────────────────────────────────────────────────────────────────────────────
    R("newborn_not_breathing", U.emergency, "newborn", template="newborn", source="WHO essential newborn care", groups=((BABY,), (
        r"(?:not|isn'?t|is not|stopped|stop|has ?n'?t started|hasn'?t|no longer|struggling|can'?t|cannot|barely|pause[sd]?|pausing|gasping|difficulty|trouble|hard to|working hard to) ?(?:breath|breathing|to breath|for breath|for air)", r"(?:turning|turned|going|gone|is|looks?|looking|got) blue", r"blue (?:lips|face|skin|colou?r|around the mouth|baby)", r"(?:limp|floppy|unresponsive|won'?t wake|can'?t (?:be )?wake|not responding|(?:isn'?t|is not|not|won'?t|doesn'?t|does not) (?:responding|waking|wake|reacting|crying)|lifeless|motionless|unconscious|not moving at all|not waking|will not wake|very sleepy and (?:won'?t|can'?t))",
        r"(?:convuls|seiz|fits?\b|jerking|twitch|stiff(?:ening)?|arching|rigid|shaking (?:all over|uncontrollably))", r"grunting", r"(?:not|isn'?t|is not|stopped|barely|hardly|no longer) moving", r"(?:chest|ribs?) (?:is |are )?(?:sucking|pulling|drawing|indrawing|moving) (?:in|inward|hard)", r"(?:severe )?chest in-?drawing",
    ))),
    R("newborn_danger_signs", U.urgent, "newborn", template="newborn", source="WHO essential newborn care", groups=((BABY,), (
        r"(?:not|isn'?t|is not|won'?t|refus(?:es|ing|ed)|doesn'?t|does not|can'?t|cannot|barely|poorly|stopped|stop|unable to|hasn'?t|has not|weak(?:ly)?|unwilling to|difficult(?:y)? to|trouble|problems?|struggling|struggle|hard time|no longer|didn'?t|did not) ?(?:feeding|feed|eating|eat|latching|latch|suck(?:ing)?|nurs(?:e|ing)|taking (?:the )?(?:breast|milk|feeds?|bottle)|drinking|drink|sucking|wake for feeds?|waking for feeds?|interested in feeding)",
        r"(?:hasn'?t|has not|didn'?t|did not|not|haven'?t) (?:fed|eaten|nursed|had (?:a )?feed|taken (?:the )?(?:breast|milk)|woken for a feed|latched|breastfed)", r"refus(?:es|ing|ed)? (?:the )?(?:breast|bottle|milk|feeds?|to feed|to eat|to nurse)", r"(?:feeding|feed|eating|latch|suck|nurse|drink) (?:poorly|badly|weakly|very (?:little|poorly)|less|much less|not well|isn'?t going well)", r"(?:hot|warm to (?:the )?touch|hot to (?:the )?touch|feverish|fever|high temp(?:erature)?|temperature (?:of |is |was |at |reads? )?(?:3[7-9]\.?\d?|4\d\.?\d?))", r"(?:cold|cold to (?:the )?touch|very cold|too cold|hypotherm|low temp(?:erature)?|temperature (?:of |is |was |at |reads? )?(?:3[0-5]\.?\d?|below))",
        r"(?:fast|rapid|quick|heavy|noisy|laboured|labored|irregular|shallow) breath", r"breath(?:ing)? (?:is )?(?:very |too )?(?:fast|rapid|quick|heavy|noisy|hard|laboured|labored|irregular|shallow|fast and)", r"(?:yellow|jaundice|jaundiced|yellowish|yellowing)(?: skin| eyes| face|ness)?", r"(?:lethargic|very sleepy|too sleepy|sleeping (?:too much|all the time|and won'?t)|hard to wake|difficult to wake|drowsy|not alert|not waking up for feeds)",
        r"(?:vomit(?:ing)?|throwing up|spitting up) (?:green|bile|everything|every feed|after every|forcefully|projectile|blood|constantly|a lot|repeatedly|yellow)", r"(?:no|not|haven'?t|has not|hasn'?t|didn'?t|did not) (?:pee|wet|urinat|passed urine|pooped|poo|stool|meconium|diaper|nappy)", r"(?:cord|umbilical|navel|belly button) (?:stump |area )?(?:is |has |looks? |became |gets? )?(?:red|pus|smell|infect|bleed|ooz|swoll?en|discharg|wet|foul|hot)",
        r"(?:rash|blisters?|pustules?|spots?) (?:all over|spreading|with fever|on (?:the )?(?:body|skin))", r"(?:crying|cries|screaming|inconsolable|won'?t stop crying) (?:non ?stop|for hours|all night|constantly|and (?:can'?t|won'?t)|a high[- ]pitched|weakly|for (?:\d+|many|several) hours|very weak)", r"(?:weak|feeble|faint|whimper(?:ing)?) cry", r"(?:not|isn'?t|is not|less|much less) (?:as )?(?:active|alert|responsive|interested|awake|lively)(?: as (?:usual|before|normal))?", r"(?:bulging|sunken|swollen) (?:fontanelle|soft spot)", r"(?:pale|grey|gray|dusky|mottled)", r"(?:fits?|seizures?|convulsions?)",
    ))),
    # ── mild-to-moderate emotional distress (answered with care, flagged for human follow-up) ─────
    R("severe_low_mood", U.urgent, "mental_health", template="support", source="Perinatal mental health", groups=((
        r"(?:severe|serious|deep|bad|really bad|terrible) (?:depress|postpartum depress|ppd|anxiety|panic)", r"(?:can'?t|cannot|unable to|not able to|no longer able to|don'?t know how to) (?:cope|go on|carry on|function|get out of bed|eat|sleep for days|take care of (?:myself|my baby|the baby))", r"(?:hopeless|worthless|empty|numb|trapped|broken|giving up|give up|can'?t do this anymore|cannot do this anymore|can'?t take it anymore|no point|nothing matters|don'?t care anymore|don'?t want to (?:be a mother|see anyone|do anything))", r"(?:haven'?t|have not) (?:slept|eaten|bathed|left (?:the )?(?:bed|house|room)) (?:in|for) (?:days|\d+ days|a week)", r"(?:crying|cry) (?:every day|all the time|all day|non ?stop|constantly|for hours|every night|everyday|without (?:knowing )?why)", r"(?:i )?(?:hate|resent|regret|don'?t love|don'?t feel (?:anything|attached|connected|bonded|love)|feel nothing for) (?:my )?(?:baby|the baby|being a mother|being pregnant|this baby|my child)", r"(?:hearing|seeing) (?:voices|things)", r"(?:don'?t|do not|can'?t|cannot) (?:see|find) (?:the |any )?(?:point|purpose|meaning|reason)", r"feel(?:ing)? (?:so |very |really )?(?:low|empty|dead inside)", r"(?:panic attack|panic attacks)", r"(?:intrusive|scary|disturbing|awful|dark|horrible) thoughts",
    ),)),
)

# ── question-type classification (used to pick a response pattern for the model) ────────────────────

_ANSWER_TYPES: Tuple[Tuple[str, str], ...] = (
    ("contraception", r"\b(?:contracepti\w*|birth control|family planning|(?:the )?(?:pill|mini-?pill|implant|iud|coil|depo|injectable|diaphragm|patch|ring)\b.{0,40}\b(?:prevent|pregnan|period|contracept|birth control)|condoms?|emergency contraception|morning[- ]after|plan b|postinor|safe period|withdrawal method|pull(?:ing)? out|unprotected sex|tubal|vasectomy|sterili[sz]ation|jadelle|implanon|copper t|hormonal (?:method|pill))"),
    ("fertility", r"\b(?:trying to (?:conceive|get pregnant)|ttc\b|fertil\w*|ovulat\w*|infertil\w*|ivf|iui|conceive|conception|get pregnant|can'?t get pregnant|not getting pregnant|chances of (?:getting )?pregnan|fertile window|tracking (?:my )?(?:cycle|ovulation)|preconception|before (?:getting )?pregnan|two[- ]week wait)"),
    ("menopause", r"\b(?:menopaus\w*|perimenopaus\w*|hot (?:flush|flash)(?:es)?|night sweats|hrt\b|hormone replacement|vaginal dryness|change of life|my periods? (?:are |have )?(?:stopping|stopped|irregular) (?:and|because) (?:i'?m|age))"),
    ("breast_health", r"\b(?:breast(?:s)?|boob(?:s)?|nipples?|mammogram|breast (?:self[- ]?exam|cancer|screening)|lump)\b"),
    ("sexual_health", r"\b(?:sex(?:ual)?|std|sti|hiv|gonorrh\w*|chlamyd\w*|syphilis|herpes|hpv|vagin\w*|vulva|yeast infection|thrush|bacterial vaginosis|\bbv\b|painful (?:sex|intercourse)|libido|pap smear|cervical (?:screening|cancer|smear)|intimate|discharge|itching down there|orgasm|dyspareunia|vaginismus)"),
    ("urinary_pelvic", r"\b(?:uti\b|urinary|bladder|pelvic floor|incontinen\w*|leak(?:ing|s)? (?:urine|pee)|pee(?:ing)? (?:a lot|often|frequently)|burning (?:when|while) (?:i )?(?:pee|urinat)|kidney)"),
    ("cycle_health", r"\b(?:periods?|menstrua\w*|my cycle|menses|pms|pmdd|period pain|menstrual cramps?|irregular (?:periods?|cycle)|missed (?:a )?period|late period|heavy (?:period|flow|bleeding)|spotting between|pcos|polycystic|endometriosis|fibroids?|ovarian cyst|cycle tracking|flow\b)"),
    ("medication", r"\b(?:medic(?:ine|ation|ines|ations)|drugs?|tablets?|pills?|capsules?|dose|dosage|prescri(?:bed|ption)|antibiotics?|paracetamol|ibuprofen|aspirin|folic|iron|supplements?|vitamins?|antimalarial|malaria (?:drug|medicine|tablet|treatment)|coartem|artemether|sp\b|fansidar|herbal|herbs?|traditional (?:medicine|remedy)|local (?:medicine|herb)|agbo|injection|vaccin(?:e|ation)|tetanus|stop(?:ping)? (?:taking|my)|can i take|safe to take|is it safe (?:to|for me to) take)"),
    ("test_explanation", r"\b(?:test|results?|scan|ultrasound|lab|laboratory|blood pressure|bp\b|haemoglobin|hemoglobin|hb\b|pcv|genotype|blood group|rhesus|rh\b|glucose|ogtt|sugar level|urine (?:test|result)|vdrl|hiv|hepatitis|reading|report|\d{2,3}\/\d{2,3}|measurement|normal range|reference range|sonograph)"),
    ("newborn_care", r"\b(?:newborn|new born|infant|breastfe|breast feed|breast-?feeding|latch|formula|colic|cord stump|umbilical|diaper|nappy|swaddl|jaundice|baby'?s? (?:sleep|feed|poo|stool|weight|skin|cry)|weaning|immunis|immuniz|vaccin|bcg|opv|baby (?:is|isn'?t|not|won'?t|has|hasn'?t|keeps?|cries|crying|sleeps|feeds)|my baby|my son|my daughter|\d+[- ]?(?:day|week|month)s?[- ]old)"),
    ("decision_support", r"\b(?:when (?:should|do|must|can) i (?:go|head|leave|call|rush|come)(?: to)?(?: the)?(?: hospital| clinic| maternity)?|should i (?:go|head|come)(?: to)? (?:the )?(?:hospital|clinic|maternity|labou?r ward)|which hospital|what hospital|choos(?:e|ing) (?:a |the )?(?:hospital|clinic|facility|maternity|doctor|midwife)|where should i (?:deliver|give birth|have)|birth (?:preferences?|choices?|options?)|home birth|natural (?:birth|delivery)|(?:c-?section|caesarean|cesarean) or|vaginal (?:birth|delivery) or|private (?:or|vs)|public (?:or|vs)|teaching hospital|general hospital|primary health ?(?:care|centre|center)|phc\b|traditional birth attendant|tba\b|should i (?:book|register)|is it (?:time|too early|too late) to go)"),
    ("partner_family", r"\b(?:my (?:husband|partner|boyfriend|fianc[eé]|man|mum|mom|mother|mother-in-law|in-?laws?|family|sister|friend)|husband|partner|in-?laws?|family|relatives?)\b.{0,60}\b(?:involve|tell|share|support|help|understand|know|invite|include|talk|attend|come|visit|see my|access|view|go with)|\b(?:involve|tell|share with|invite|include|how (?:can|do) i (?:get|ask)) (?:my )?(?:husband|partner|family|mum|mom|mother|in-?laws?|relatives?)|support (?:partner|circle|system)|add (?:a )?(?:support )?partner"),
    ("emotional_support", r"\b(?:anxi(?:ous|ety)|worr(?:y|ied|ies)|scared|afraid|fear|frighten|nervous|stress(?:ed)?|overwhelm|sad|depress|lonely|alone|cry(?:ing)?|crying|tearful|mood|miscarriage|stillbirth|lost (?:my|the) baby|grie(?:f|ving)|panic|can'?t cope|exhaust|tired of|isolated|husband|partner|in-?laws?|mother-in-law|family (?:pressure|is)|pressure|relationship|ashamed|shame|guilt|unwanted|unplanned|didn'?t plan|overwhelmed|bonding|baby blues|postpartum depression|ppd)"),
    ("birth_preparation", r"\b(?:labou?r|deliver(?:y|ing)|birth plan|giving birth|hospital bag|c-?section|caesarean|cesarean|epidural|induc(?:e|tion)|contractions?|water breaking|due date|overdue|breech|push(?:ing)?|episiotomy|perineal|stitches|post-?partum|after (?:delivery|birth)|recover(?:y|ing)|lochia|afterpains?|vbac)"),
    ("nutrition", r"\b(?:eat(?:ing)?|food|foods|diet|nutrition|meal|snack|drink(?:ing)?|water|hydrat|fruit|vegetable|protein|rice|beans?|garri|eba|pap|akamu|ogi|yam|plantain|fish|meat|eggs?|milk|coffee|tea|caffeine|alcohol|craving|cravings|appetite|weight gain|vitamin|iron-rich|safe to eat|can i eat|cannot eat|raw|undercooked|pawpaw|papaya|pineapple|suya|pepper|spicy|zobo|kunu|malt|soup)"),
    ("care_navigation", r"\b(?:find (?:a )?(?:nurse|doctor|hospital|clinic|midwife|maternity)|book(?:ing)? (?:a )?(?:nurse|appointment|ride|driver|doctor)|hospital near|clinic near|nearest hospital|ambulance|driver|ride\b|transport|pick me up|talk to (?:a )?nurse|speak to (?:a )?nurse|call (?:a )?nurse|see a (?:doctor|nurse|midwife)|antenatal (?:clinic|booking|registration)|where (?:can|do) i (?:go|deliver|register)|how much (?:does|is|will)|cost of|can'?t afford|no money|too expensive|afford)"),
    ("symptom_guidance", r"\b(?:pain|ache|aching|cramp(?:s|ing)?|nausea|nauseous|vomit|sick|dizzy|dizziness|faint|swell(?:ing|en)|itch(?:ing|y)?|rash|discharge|spotting|bleed|burning|heartburn|indigestion|constipat|diarrh|cough|cold|flu|sore|numb|tingl|contraction|braxton|leg (?:cramps?|pain)|back ?pain|backache|pelvic|headache|fever|tired|fatigue|exhaust|insomnia|can'?t sleep|short of breath|breath(?:less|ing)|palpitat|heart (?:racing|pounding)|movement|kick(?:s|ing)?|symptom|feel(?:ing)? (?:weird|strange|off|unwell|sick|bad)|something (?:is )?(?:wrong|not right|off)|normal\?)"),
    ("pregnancy_education", r"\b(?:week|weeks|trimester|developing|development|growth|size of|milestone|what (?:happens|to expect)|how big|baby'?s? (?:size|growth|development)|gestation|conception|ovulat|trying to (?:conceive|get pregnant)|fertil|early signs|am i pregnant|antenatal|prenatal|check-?ups?|appointment|booking visit|schedule)"),
)

ANSWER_PATTERNS = {
    "symptom_guidance": "Symptom question: first check for danger signs in what she wrote; give safe self-care only if no warning sign is present; say clearly when she should contact a clinician; ask at most one focused question.",
    "medication": "Medication question: never tell her to start, stop or change a prescribed medicine and never give doses. Explain general safety information, note that this depends on her medicines, stage and history, and direct her to her prescriber, pharmacist or a LONI nurse.",
    "test_explanation": "Test-result question: explain only what the values she gave actually mean and what the terms are. Do not call a result normal without a stated reference range, and do not invent units. Say that an AI explanation is not a formal report and recommend clinical review; if the value suggests danger (for example high blood pressure), treat it as needing prompt assessment.",
    "nutrition": "Food question: say whether the food is generally safe, how to prepare it and any exceptions; offer a local alternative if relevant. For traditional remedies or herbs, say they are not proven safe and to check with a clinician first.",
    "emotional_support": "Emotional-support question: validate her feelings first, listen without judgement, offer one or two small realistic steps, and gently suggest a human (a LONI nurse, a trusted person, her clinician). Do not minimise.",
    "birth_preparation": "Labour/birth question: check for emergency signs first. Explain when to go to the facility, what to bring and how to get there, and to follow her facility's instructions.",
    "newborn_care": "Newborn question: establish the baby's age if it matters. Explain safe care, and check for danger signs: feeding, breathing, temperature, alertness, colour. A baby that may be unwell should be seen promptly.",
    "decision_support": "Decision question (when to go to hospital, which facility, birth preferences): give balanced, plain information and the factors that matter; do not choose for her. Say clearly that the decision belongs with her and her own care team, tell her which signs mean 'go now', and never name or recommend a specific hospital as available or best. Money should never delay emergency care: say so kindly.",
    "partner_family": "Partner/family question: she controls what is shared and with whom. Give practical, respectful ways to involve them, explain that LONI lets her invite a support partner and choose what they see, and never suggest sharing health details without her say-so. If there are signs of pressure or unsafety, put her wellbeing first.",
    "cycle_health": "Periods/cycle question: explain what is typical and what varies from woman to woman, using plain words. Say which patterns deserve a clinician (very heavy bleeding, soaking a pad every hour, severe pain that stops normal life, periods that stop or are far apart for months, bleeding between periods or after sex, a missed period when pregnancy is possible). Do not diagnose PCOS, endometriosis or fibroids; explain what they are and that a clinician confirms them. Never advise hormones or doses.",
    "contraception": "Contraception question: give balanced, non-judgemental information about the main options (how they work, what to expect, common side effects, and that no method suits everyone) and ask what matters to her. Never recommend a specific product or dose; choosing and starting a method is for a clinician or pharmacist. For unprotected sex or a missed pill, say emergency contraception works better the sooner it is used and she should speak to a pharmacist or nurse today. Mention that only condoms also protect against infections.",
    "fertility": "Trying-to-conceive question: be encouraging and realistic. Explain the fertile window and cycle basics, healthy preparation (folic acid is something to ask a clinician about, balanced food, movement, limiting alcohol and smoking), and when to seek help (commonly after about 12 months of trying, or 6 months if over 35, or sooner with irregular periods, known conditions or pain). Be sensitive to the stress and grief that trying can bring. Never give doses.",
    "menopause": "Menopause question: normalise it, explain the stages and common changes (hot flushes, sleep, mood, dryness, irregular periods) and what can help day to day. Hormone therapy and other treatments are a decision for her clinician, so explain that without recommending any. Bleeding after periods have stopped for a year always needs a prompt clinician check.",
    "sexual_health": "Sexual-health question: be matter-of-fact, kind and shame-free. Give clear information, explain that testing and treatment for infections are routine and confidential, and encourage seeing a clinician for symptoms like unusual discharge, sores, pain or bleeding after sex. Never diagnose an infection from a description.",
    "breast_health": "Breast-health question: explain normal breast changes through the cycle, how to check her own breasts, and that any NEW lump, nipple discharge, skin change or one-sided persistent change should be checked by a clinician soon, without panic (most lumps are not cancer, but only an examination can say). Encourage screening as advised for her age.",
    "urinary_pelvic": "Urinary/pelvic question: explain common causes in plain words and simple self-care (fluids, not holding urine, hygiene, pelvic floor exercises). Burning with fever, back or side pain, blood or vomiting needs prompt assessment. Do not recommend antibiotics or doses.",
    "care_navigation": "Care-access question: only the app's own functions exist for you to offer: talking to a LONI nurse by voice call, and requesting an emergency ride. You cannot see availability, prices, hospital lists or bookings: do not invent any, and never say something has been booked. Point her to the buttons and say she will see confirmation in the app.",
    "pregnancy_education": "Pregnancy-stage question: give a direct answer by week, then practical actions and what to raise at her next antenatal visit.",
    "other": "",
}


# ── engine ───────────────────────────────────────────────────────────────────────────────────────────

_NEGATION = re.compile(r"(?:\bno|\bnot|\bnever|\bwithout|\bnone|n't|\bnor)\s+(?:\w+\s+)?$")
_INFO_Q = re.compile(r"^\s*(?:hi\b.{0,15}[,.!?]\s*)?(?:what(?:'s| is| are| does| do| happens)?|which|how (?:do|can|does|would|will|should|to)|(?:is it|are) (?:normal|safe)|(?:is|are|can|could|does|do) (?:\w+ ){1,3}(?:normal|common|safe)\b|tell me about|explain|can you (?:tell|explain|list)|is it (?:normal|true|safe)|are there|why (?:do|does|is|are)|when (?:should|do|does|is)|give me (?:the )?(?:signs|symptoms|list)|list|signs of|symptoms of)\b", re.I)
_PERSONAL = re.compile(r"\b(?:i(?:'m| am| was) (?:having|bleeding|feeling|experiencing|getting|passing|vomiting|leaking|in pain|in (?:active )?labou?r (?:now|already)|\d+ weeks)|i have (?:a|an|been|some|got|just)|i'?ve (?:been|had|got|noticed|just)|ive (?:been|had|got)|i feel|i just|i can'?t|i cannot|i keep|i started|i had|i got|i noticed|i see|i saw|i woke|my (?:baby|belly|stomach|head|waters?|water|legs?|feet|hands|face|body|wound|stitches|breasts?|husband|partner|sister|friend|mother|mum|wife|daughter|son|newborn|pad|bleeding|contractions?|pain)|right now|just now|just started|this morning|last night|since (?:yesterday|morning|last|i)|for (?:the )?(?:past|last) \w+|it (?:started|began|won'?t|keeps|is getting|has been)|help|please|urgent|emergency|now\b|today|tonight|what should i do|what do i do|should i go|do i need)\b", re.I)


_NEWBORN_STRICT = re.compile(r"newborn|new born|infant|\bborn\b|delivered|\d+[- ]?(?:day|week|hour)s?[- ]old|days? old|weeks? old|my (?:son|daughter|child|twins?)\b|since (?:the )?(?:birth|delivery)|after (?:birth|delivery)", re.I)


_PREGNANCY_ONLY = {"any_bleeding", "reduced_movement", "waters_break", "labour_signs", "prolonged_labour", "wet_leak", "baby_coming", "fall_or_trauma"}
_PERIOD_WORDS = re.compile(r"\b(?:period|periods|menstrua\w*|menses|my cycle|monthly)\b", re.I)
_FAINT_WORDS = re.compile(r"\b(?:dizzy|dizziness|faint\w*|weak|light-?headed|short of breath|heart (?:racing|pounding)|palpitat\w*|pale|passing out|collaps\w*)\b", re.I)

_COMBOS = (
    frozenset({"fall_or_trauma", "any_bleeding"}),
    frozenset({"any_bleeding", "reduced_movement"}),
    frozenset({"any_bleeding", "waters_break"}),
    frozenset({"severe_headache", "sudden_swelling"}),
    frozenset({"vision_changes", "sudden_swelling"}),
    frozenset({"fever", "reduced_movement"}),
    frozenset({"fall_or_trauma", "reduced_movement"}),
    frozenset({"breathless_concerning", "sudden_swelling"}),
)


def _normalise(text: str) -> str:
    t = text.lower().replace("’", "'").replace("‘", "'").replace("`", "'")
    t = re.sub(r"(.)\1{2,}", r"\1\1", t)      # "bleeeeding" -> "bleeding"
    t = re.sub(r"\s+", " ", t).strip()
    return t


_COMPILED = {r.id: tuple(tuple(re.compile(p, re.I) for p in g) for g in r.groups) for r in RULES}
_EXCLUDE = re.compile(r"nose ?bleed|bleeding (?:from )?(?:my )?(?:nose|gums?)|(?:my )?gums? (?:are |is )?bleed|cut (?:my )?(?:finger|hand|leg|knee|foot)|paper cut|bleed(?:ing)? (?:the )?(?:radiator|brakes?|tyres?)", re.I)


def _group_hit(text: str, patterns: Tuple["re.Pattern", ...]) -> bool:
    """A group matches when any pattern matches somewhere that is not directly negated."""
    for p in patterns:
        for m in p.finditer(text):
            if _NEGATION.search(text[max(0, m.start() - 22):m.start()]):
                continue
            return True
    return False


def _rule_fires(rule: Rule, text: str, stage: StageContext) -> bool:
    if rule.min_week is not None and stage.kind == "pregnancy" and stage.week is not None and stage.week < rule.min_week:
        return False
    if rule.domain == "pregnancy" and stage.kind == "postpartum" and rule.id in ("reduced_movement", "labour_signs", "waters_break", "baby_coming"):
        return False
    if stage.kind in ("general", "ttc") and rule.id in _PREGNANCY_ONLY:
        return False  # not pregnant: labour, baby movement and "bleeding in pregnancy" do not apply
    if rule.id in ("early_pregnancy_danger", "early_pregnancy_bleeding") and stage.kind in ("pregnancy", "postpartum"):
        return False  # she already knows she is pregnant: the pregnancy rules cover her
    if rule.id == "any_bleeding" and stage.kind == "postpartum":
        return False  # lochia is expected for weeks; heavy or returning bleeding is caught by other rules
    if rule.domain == "newborn" and stage.kind in ("pregnancy", "general", "ttc") and not _NEWBORN_STRICT.search(text):
        return False  # "my baby" while pregnant means the unborn baby
    if rule.id == "any_bleeding" and _EXCLUDE.search(text):
        text = _EXCLUDE.sub(" ", text)
    return all(_group_hit(text, g) for g in _COMPILED[rule.id])


def classify_answer_type(text: str) -> str:
    t = _normalise(text)
    for name, pattern in _ANSWER_TYPES:
        if re.search(pattern, t):
            return name
    return "other"


def _effective_urgency(rule: Rule, stage: StageContext) -> Urgency:
    if rule.preterm_escalates and stage.kind == "pregnancy" and stage.week is not None and stage.week < 37:
        return Urgency.emergency
    return rule.urgency


# Health questions where she should see the "Talk to a Nurse" option under the answer.
_NURSE_OFFER = {"symptom_guidance", "medication", "test_explanation", "newborn_care", "birth_preparation",
                "decision_support", "emotional_support", "partner_family", "cycle_health", "contraception", "fertility",
                "menopause", "sexual_health", "breast_health", "urinary_pelvic"}


def _actions(urgency: Urgency, domain: str, answer_type: str, text: str) -> List[dict]:
    ride = {"type": "request_ride", "label": "Request Emergency Ride", "route": "/ride/request"}
    nurse = {"type": "talk_to_nurse", "label": "Talk to a Nurse", "route": "/nurse/connecting"}
    call = {"type": "call_emergency", "label": "Call emergency services"}
    if urgency == Urgency.emergency:
        return [nurse, call] if domain == "mental_health" else [ride, nurse, call]
    if urgency == Urgency.urgent:
        if domain == "safety":
            return [call, nurse]
        if domain == "mental_health":
            return [nurse, call]
        return [nurse, ride]
    if urgency in (Urgency.routine, Urgency.educational) and answer_type in _NURSE_OFFER:
        out = [nurse]
        if answer_type in ("emotional_support", "partner_family"):
            out.append({"type": "invite_partner", "label": "Invite a Support Partner", "route": "/profile/emergency-contacts"})
        if answer_type == "partner_family":
            out.reverse()
        return out
    if answer_type == "care_navigation":
        t = text.lower()
        wants_ride = re.search(r"ambulance|driver|ride|transport|pick me|hospital|clinic|get there|reach", t)
        wants_nurse = re.search(r"nurse|midwife|doctor|speak|talk|call|appointment", t)
        out = []
        if wants_nurse or not wants_ride:
            out.append(nurse)
        if wants_ride:
            out.append(ride)
        return out
    return []


def triage(text: str, stage: Optional[StageContext] = None) -> TriageResult:
    stage = stage or StageContext()
    t = _normalise(text or "")
    answer_type = classify_answer_type(t)

    fired: List[Tuple[Rule, Urgency]] = [(r, _effective_urgency(r, stage)) for r in RULES if _rule_fires(r, t, stage)]

    info_only = bool(fired) and bool(_INFO_Q.search(t)) and not _PERSONAL.search(t)
    if info_only:
        # A general question that mentions a danger sign. The model answers it, with the warning signs included.
        return TriageResult(Urgency.educational, "general", "maternal", [r.id for r, _ in fired], answer_type, True, _actions(Urgency.educational, "general", answer_type, t))

    if not fired:
        urgency = Urgency.routine if answer_type in ("symptom_guidance", "medication", "test_explanation", "newborn_care", "cycle_health", "sexual_health", "urinary_pelvic") else Urgency.educational
        return TriageResult(urgency, "general", "maternal", [], answer_type, False, _actions(urgency, "general", answer_type, t))

    fired.sort(key=lambda ru: -_RANK[ru[1]])
    top_rule, top = fired[0]
    ids = {r.id for r, _ in fired}
    if (top == Urgency.emergency and top_rule.id == "heavy_bleeding" and stage.kind in ("general", "ttc")
            and _PERIOD_WORDS.search(t) and not _FAINT_WORDS.search(t) and ids <= {"heavy_bleeding", "any_bleeding"}):
        top = Urgency.urgent  # a very heavy period needs a prompt check, not the emergency message (unless she is unwell)
    if "sudden_swelling" in ids and re.search(HEADACHE, t):
        top = Urgency.emergency  # swelling with a headache: pre-eclampsia warning signs together
    # Pairs that are each "urgent" alone but together point to something dangerous (abruption, pre-eclampsia ...).
    if top == Urgency.urgent and any(pair <= ids for pair in _COMBOS):
        top = Urgency.emergency
    # Several separate urgent signs together are more than the sum of their parts.
    if top == Urgency.urgent and len({r.id for r, u in fired if u == Urgency.urgent and r.domain in ("pregnancy", "postpartum")}) >= 3:
        top = Urgency.emergency
    domain = top_rule.domain
    template = top_rule.template

    actions = _actions(top, domain, answer_type, t)
    if template == "transport" and top == Urgency.urgent:
        # She asked for a way to the hospital: the ride comes first.
        ride = {"type": "request_ride", "label": "Request Emergency Ride", "route": "/ride/request"}
        actions = [ride, *[a for a in actions if a["type"] != "request_ride"]]
        if not any(a["type"] == "call_emergency" for a in actions):
            actions.append({"type": "call_emergency", "label": "Call emergency services"})
    return TriageResult(top, domain, template, [r.id for r, _ in fired], answer_type, False, actions)
