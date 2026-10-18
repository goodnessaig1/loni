"""
Second safety net: a small model call that can only RAISE urgency.

Keyword rules are fast and predictable but they cannot see every way a worried mother phrases things (on a fresh
set of unseen phrasings the rules alone caught roughly half of the emergencies). So messages that the rules did
not call an emergency are also read by a model with one narrow job: classify urgency as JSON. The final urgency
is the HIGHER of the two. Properties that keep this safe:

* it can only raise, never lower, what the rules found;
* it has a short timeout and fails OPEN to the rules, so a slow or broken model never blocks a reply;
* it sees only the last few turns and her stage, nothing else;
* its output is parsed strictly; anything unexpected is ignored.
"""
import asyncio
import json
import re
from typing import List, Optional, Tuple

from app.modules.ai_chat.triage import StageContext, TriageResult, Urgency, _actions, _RANK

TIMEOUT_SECONDS = 4.0

CLASSIFIER_PROMPT = """You are a safety triage classifier for a women's health and maternal-care app used in Nigeria. Users are women of any age and stage: not pregnant, trying to conceive, pregnant, postpartum, or menopausal. You do not answer the user. Read the LAST message (earlier turns are context) and output ONE line of JSON:
{"urgency": "emergency|urgent|routine|educational", "domain": "pregnancy|postpartum|newborn|womens_health|mental_health|safety|general"}

emergency = needs help NOW: heavy or uncontrolled bleeding (including a period that is soaking pads with dizziness or faintness); a missed period or positive pregnancy test with sudden sharp or one-sided pain, shoulder pain or dizziness; seizures/fits; severe trouble breathing; collapse or unresponsive; severe headache with vision problems; severe or sudden abdominal pain; baby/cord/limb coming out; labour or waters breaking before 37 weeks; newborn not breathing, blue, limp, fitting or unresponsive; thoughts of suicide, self-harm or harming the baby; immediate danger from violence.
urgent = needs a professional TODAY: any bleeding or spotting in pregnancy; a very heavy period; bleeding after menopause; a new breast lump or nipple discharge; burning urine with fever or back pain; foul discharge with pelvic pain or fever; sexual assault; fever; reduced or stopped baby movements; persistent vomiting or cannot keep fluids down; severe or persistent headache; blurred vision; sudden swelling of face/hands; waters leaking or labour at term; fall or accident with a bump; signs of wound/breast infection or foul discharge after birth; a newborn feeding poorly, very sleepy, fast breathing, jaundiced, too hot or too cold; severe low mood, hopelessness or abuse.
routine = a health question or mild symptom with none of the above.
educational = general information, nutrition, planning, small talk, or a general question about warning signs that is not happening to her.

Rules: if unsure between two levels choose the HIGHER one. Misspellings, Nigerian Pidgin, slang and very short messages are common: read for meaning. A general question about a sign ("what are the signs of...") is educational. Output only the JSON."""

_JSON = re.compile(r"\{[^{}]*\}")
_DOMAINS = {"pregnancy", "postpartum", "newborn", "womens_health", "mental_health", "safety", "general"}


def parse(raw: str) -> Optional[Tuple[Urgency, str]]:
    """Strict parse of the classifier's reply; None for anything that is not exactly what we asked for."""
    if not raw:
        return None
    m = _JSON.search(raw)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
        urgency = Urgency(str(data.get("urgency", "")).strip().lower())
    except (ValueError, TypeError):
        return None
    domain = str(data.get("domain", "general")).strip().lower()
    return urgency, domain if domain in _DOMAINS else "general"


def _transcript(history: List[dict], text: str) -> str:
    tail = [m for m in history[-4:] if m.get("content")]
    lines = [f"{m['role'].upper()}: {m['content'][:400]}" for m in tail]
    if not tail or tail[-1].get("role") != "user" or tail[-1].get("content") != text:
        lines.append(f"USER: {text[:600]}")
    return "\n".join(lines)


async def classify(client, model: str, text: str, stage: StageContext, history: List[dict]) -> Optional[Tuple[Urgency, str]]:
    stage_line = (f"Profile: pregnant, week {stage.week}" if stage.kind == "pregnancy" and stage.week
                  else "Profile: pregnant" if stage.kind == "pregnancy"
                  else f"Profile: postpartum, baby {stage.week} weeks old" if stage.kind == "postpartum" and stage.week is not None
                  else "Profile: unknown")
    try:
        resp = await asyncio.wait_for(client.chat.completions.create(
            model=model, temperature=0, max_tokens=40, stream=False,
            messages=[{"role": "system", "content": CLASSIFIER_PROMPT},
                      {"role": "user", "content": f"{stage_line}\n\n{_transcript(history, text)}"}],
        ), timeout=TIMEOUT_SECONDS)
        return parse(resp.choices[0].message.content or "")
    except Exception as e:  # timeout, network, provider error: fail open to the rules
        print(f"Triage classifier unavailable, using rules only: {type(e).__name__}")
        return None


def merge(rules: TriageResult, verdict: Optional[Tuple[Urgency, str]], text: str) -> TriageResult:
    """The higher urgency wins. The classifier can raise a result, never lower it."""
    if not verdict:
        return rules
    urgency, domain = verdict
    if _RANK[urgency] <= _RANK[rules.urgency] or urgency not in (Urgency.urgent, Urgency.emergency):
        return rules
    template = {"newborn": "newborn", "mental_health": "crisis", "safety": "abuse"}.get(domain, "maternal")
    if urgency == Urgency.urgent and domain == "mental_health":
        template = "support"
    rules.urgency = urgency
    rules.info_only = False
    rules.domain = domain if domain != "general" else (rules.domain or "pregnancy")
    rules.template = template
    rules.rule_ids = [*rules.rule_ids, "llm_classifier"]
    rules.actions = _actions(urgency, rules.domain, rules.answer_type, text)
    return rules
