"""
Nurse handoff: a short summary a mother can choose to share with the LONI nurse she is calling.

* Built deterministically from her profile stage, the triage decisions already stored on the chat, and her structured
  memory. No model writes it, so it cannot invent symptoms or history.
* She sees it first and shares it only with consent (the app asks before the call). Her last few messages are included
  only if she ticks that option.
* Status is honest: `awaiting_nurse` until a nurse actually opens it (`viewed_by_nurse`). Nothing here, and nothing the
  AI says (safety.py), may claim a nurse has reviewed it before that.
* A nurse can read it only if she is the nurse on a call with that mother in the last 24 hours.
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from app.modules.ai_chat.context import first_name, stage_context, stage_text

# Plain words for triage rule ids (what the nurse reads).
RULE_WORDS = {
    "self_harm": "thoughts of self-harm", "harm_baby": "thoughts of harming the baby", "abuse": "possible abuse / unsafe at home",
    "heavy_bleeding": "heavy bleeding", "seizure": "seizure / fit", "severe_breathing": "severe breathing difficulty or chest pain",
    "breathless_concerning": "breathlessness", "collapse": "fainting / collapse", "headache_vision": "headache with vision changes",
    "severe_abdominal_pain": "severe abdominal pain", "baby_coming": "baby coming / urge to push", "any_bleeding": "bleeding in pregnancy",
    "reduced_movement": "reduced baby movements", "waters_break": "waters breaking", "labour_signs": "signs of labour",
    "prolonged_labour": "prolonged labour", "wet_leak": "fluid leaking", "needs_transport": "asked for transport to hospital",
    "early_pregnancy_danger": "possible early-pregnancy emergency", "early_pregnancy_bleeding": "bleeding in early pregnancy",
    "postmenopausal_bleeding": "bleeding after menopause", "breast_lump": "new breast lump", "uti_red_flags": "urinary infection red flags",
    "pelvic_infection_signs": "possible pelvic infection", "sexual_assault": "sexual assault", "needs_ambulance": "asked for an ambulance",
    "serious_infection": "fever with signs of serious infection", "fever": "fever", "persistent_vomiting": "persistent vomiting",
    "severe_headache": "severe headache", "vision_changes": "vision changes", "sudden_swelling": "sudden swelling",
    "fall_or_trauma": "fall or blow to the belly", "pph_signs": "signs of postpartum haemorrhage",
    "newborn_not_breathing": "newborn not breathing", "newborn_danger_signs": "newborn danger signs", "severe_low_mood": "severe low mood",
}
_RANK = {"emergency": 3, "urgent": 2, "routine": 1, "educational": 0}
MAX_QUOTE = 240


def _latest_flag(messages: List[dict]) -> Optional[dict]:
    """The most serious triage decision in the last 24h of this chat, from the meta stored on assistant replies."""
    best = None
    for m in messages:
        meta = m.get("meta") or {}
        u = meta.get("urgency")
        if m.get("role") != "assistant" or u not in _RANK:
            continue
        if best is None or _RANK[u] >= _RANK[best["urgency"]]:
            best = {"urgency": u, "rule_ids": meta.get("rule_ids") or []}
    return best


def build_summary(user, messages: List[dict], facts: list, today: date, include_messages: bool) -> dict:
    """{'text': what the nurse (and she) reads, 'flag': urgency or None}."""
    from app.modules.checkins import facts as fx

    stage = stage_context(user)
    lines = ["LONI handoff summary. Shared by the mother. Generated automatically from her LONI chat and notes, "
             "NOT reviewed by a clinician. Please confirm everything with her."]
    name = first_name(getattr(user, "name", None))
    if name:
        lines.append(f"Name: {name}")
    st = stage_text(stage)
    lines.append(f"Stage: {st}" if st else {"general": "Stage: not pregnant", "ttc": "Stage: trying to conceive"}.get(stage.kind or "", "Stage: not recorded"))

    flag = _latest_flag(messages)
    if flag and flag["urgency"] in ("emergency", "urgent"):
        signs = ", ".join(RULE_WORDS.get(r, r.replace("_", " ")) for r in flag["rule_ids"]) or "danger sign"
        lines.append(f"LONI safety check flagged {flag['urgency'].upper()}: {signs}.")

    def group(kinds, title):
        items = [f for f in facts if f.kind in kinds and f.status == "active"]
        if items:
            lines.append(title + ":")
            lines.extend("  " + fx.describe(f, today).lstrip("- ") for f in items[:6])

    group(("allergy",), "Allergies")
    group(("condition",), "Conditions / history")
    group(("medication",), "Medicines")
    group(("symptom", "concern"), "Recent concerns")
    group(("appointment",), "Appointments")

    if include_messages:
        mine = [m["content"] for m in messages if m.get("role") == "user" and m.get("content")][-3:]
        if mine:
            lines.append("Her recent messages (her words, shared with her consent):")
            lines.extend("  \"" + (t if len(t) <= MAX_QUOTE else t[:MAX_QUOTE] + "…") + "\"" for t in mine)
    return {"text": "\n".join(lines), "flag": flag["urgency"] if flag else None}


def new_record(user_id: str, session_id: Optional[str], summary: dict, include_messages: bool) -> dict:
    now = datetime.now(timezone.utc)
    return {"id": str(uuid.uuid4()), "user_id": user_id, "session_id": session_id, "summary": summary["text"],
            "flag": summary["flag"], "includes_messages": include_messages, "status": "awaiting_nurse",
            "viewed_by": None, "viewed_at": None, "created_at": now, "expires_at": now + timedelta(hours=24)}


def public(rec: dict) -> dict:
    out = {k: v for k, v in rec.items() if k != "_id"}
    return out
