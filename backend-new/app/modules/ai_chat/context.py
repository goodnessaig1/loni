"""Builds the small, consent-friendly profile context handed to the model, and the stage used by triage."""
from typing import Optional, Tuple

from app.modules.ai_chat.triage import StageContext
from app.modules.care.service import stage_of


def first_name(name: Optional[str]) -> Optional[str]:
    parts = (name or "").strip().split()
    return parts[0] if parts else None


def stage_context(user) -> StageContext:
    """('pregnancy' | 'postpartum', week) from the profile; unknown when the profile has nothing usable."""
    if user is None:
        return StageContext()
    status = user.status.value if getattr(user, "status", None) else None
    if status is None:
        return StageContext()          # Loni is for every woman: no status means "we don't know yet", not "pregnant"
    if status in ("general", "ttc"):
        return StageContext(status, None)
    kind, week = stage_of(user)
    if kind == "postpartum":
        return StageContext("postpartum", week)
    # No usable week for a pregnant mother: say so rather than guess ("week 0" would be a claim).
    return StageContext("pregnancy", week if week and week > 0 else None)


def stage_text(stage: StageContext) -> Optional[str]:
    """For the emergency message: 'about 30 weeks pregnant' / 'about 3 weeks after birth'."""
    if stage.kind == "pregnancy" and stage.week:
        return f"about {stage.week} weeks pregnant"
    if stage.kind == "postpartum" and stage.week is not None:
        return f"about {stage.week} weeks after birth" if stage.week else "newly after birth"
    return None


def profile_lines(user, stage: StageContext) -> Tuple[str, ...]:
    """Only what answers need: preferred first name and stage. No email, phone, address, partner or contacts."""
    lines = []
    name = first_name(getattr(user, "name", None))
    if name:
        lines.append(f"- Preferred name: {name}")
    if stage.kind == "pregnancy":
        if stage.week:
            tri = 1 if stage.week <= 12 else 2 if stage.week <= 27 else 3
            lines.append(f"- Stage: pregnant, about week {stage.week} (trimester {tri}). Tailor milestones, symptoms and food advice to this week.")
        else:
            lines.append("- Stage: pregnant, week unknown. If it changes the answer, ask once.")
    elif stage.kind == "postpartum":
        lines.append(f"- Stage: postpartum, baby about {stage.week} weeks old." if stage.week else "- Stage: newly postpartum.")
    elif stage.kind == "ttc":
        lines.append("- Stage: trying to conceive. Be encouraging and realistic; fertility and cycle questions are likely.")
    elif stage.kind == "general":
        lines.append("- Stage: not pregnant (women's health in general). Her questions may be about periods, contraception, fertility, menopause, sexual or breast health, or wellbeing.")
    else:
        lines.append("- Stage: unknown. If it changes the answer, ask once.")
    return tuple(lines)
