"""
Fixed, pre-written safety messages. These are what a mother sees for an emergency, so they are deliberately
short, action-first, free of questions and never produced by the model.

Clinical wording must be approved by a maternal-health professional before release. Two deliberate
omissions: no phone number is hard-coded (it comes from settings.EMERGENCY_PHONE and the app's own
buttons), and nothing here claims a ride, nurse or hospital is available.
"""
import re
from typing import Optional

# ── EMERGENCY: sent instead of a model answer ────────────────────────────────────────────────────────

EMERGENCY = {
    "maternal": (
        "**This could be an emergency. Please get medical help right now.**\n\n"
        "- Go to the nearest hospital emergency department, or call local emergency services, **now**. Please don't wait to see if it settles.\n"
        "- Don't go alone, and don't drive yourself, especially if you feel weak, dizzy or faint.\n"
        "- If you need transport, tap **Request Emergency Ride** below. But don't wait for a ride if you can get to care faster another way.\n"
        "- Keep your phone with you, and tell the staff what is happening{stage}.\n\n"
        "I'm here with you. 💜"
    ),
    "seizure": (
        "**A seizure is an emergency. Please get medical help right now.**\n\n"
        "- Call local emergency services or get her to the nearest hospital immediately.\n"
        "- While you wait: lay her on her **left side**, move anything hard or sharp away, and **don't put anything in her mouth**.\n"
        "- Stay with her. Note when it started and how long it lasted.\n"
        "- If you need transport, tap **Request Emergency Ride** below, but don't delay getting help.\n\n"
        "You are not alone in this. 💜"
    ),
    "breathing": (
        "**Trouble breathing is an emergency. Please get medical help right now.**\n\n"
        "- Call local emergency services or go to the nearest hospital immediately.\n"
        "- Sit upright and try to stay as calm as you can while help comes. Loosen anything tight around your chest.\n"
        "- Please don't be alone. Ask someone to stay with you and take you.\n"
        "- If you need transport, tap **Request Emergency Ride** below, but don't wait for it if you can get help faster.\n\n"
        "I'm here with you. 💜"
    ),
    "birth": (
        "**You may be about to give birth, or you may need care right away. Please get help now.**\n\n"
        "- Call local emergency services or head to the nearest facility that can deliver babies **right now**.\n"
        "- Don't go alone. If the baby is coming before you arrive: stay calm, lie down or kneel with support, keep warm towels ready, and let the baby come. **Don't pull on the baby or the cord.**\n"
        "- If you need transport, tap **Request Emergency Ride** below, but don't wait for it if you can get help faster.\n\n"
        "You can do this, and help is the priority. 💜"
    ),
    "newborn": (
        "**Your baby needs urgent medical care right now.**\n\n"
        "- Go to the nearest hospital emergency department or call local emergency services **immediately**.\n"
        "- While you get ready: keep your baby **warm**, wrapped and skin-to-skin against you. Don't give anything by mouth if baby is very sleepy, limp, or struggling to breathe.\n"
        "- If baby has stopped breathing or is blue, tell the emergency service straight away so they can guide you.\n"
        "- If you need transport, tap **Request Emergency Ride** below, but don't delay.\n\n"
        "You're doing the right thing by acting fast. 💜"
    ),
    "crisis": (
        "**I'm really glad you told me. Your safety matters most right now.**\n\n"
        "- If you might act on these thoughts, or you are in immediate danger, **call local emergency services or go to the nearest hospital now**.\n"
        "- Please don't be alone. Call or message someone you trust and ask them to come to you right now.\n"
        "- You can also talk to a LONI nurse right now using the button below.\n\n"
        "What you are feeling is serious, and it can get better with the right support. You deserve that support. 💜"
    ),
    "abuse": (
        "**If you are in danger right now, please get to safety and call local emergency services.**\n\n"
        "- Go to a safe place, such as a neighbour, a relative or a health facility, and don't stay alone with the person who is hurting you.\n"
        "- Call local emergency services if you can.\n"
        "- You can also talk to a LONI nurse right now using the button below. What is happening is not your fault.\n\n"
        "You deserve to be safe. 💜"
    ),
    "harm_baby": (
        "**Thank you for telling me. Telling someone is the right thing to do, and you're not a bad mother.**\n\n"
        "- If you feel you might hurt your baby right now: **put your baby down somewhere safe (their cot), step into another room, and call someone to come and take over**. Call local emergency services if you can't get anyone.\n"
        "- Please talk to a LONI nurse right now using the button below, and tell a doctor about these thoughts. They are treatable, and more common than people say.\n\n"
        "You are not alone, and help is available. 💜"
    ),
}

# ── URGENT: sent first, then the model explains ──────────────────────────────────────────────────────

URGENT = {
    "soon": "**Please have this checked by a healthcare professional soon, within the next few days. Please don't ignore it.**\n\n",
    "assault": "**I'm so sorry this happened to you. It is not your fault, and you deserve care and support.** If you're in danger right now, call local emergency services or go somewhere safe. A health worker can help with injuries, emergency contraception and infection prevention, and the sooner the better. You can also talk to a LONI nurse using the button below.\n\n",
    "transport": "**Let's get you to care. Tap Request Emergency Ride below. If this is life-threatening, call emergency services now instead of waiting for a ride.**\n\n",
    "maternal": "**Please get this checked by a healthcare professional today. Don't wait for it to pass.**\n\n",
    "birth": "**Please contact your maternity facility or go to the hospital now. You may be in labour, or your waters may have broken.**\n\n",
    "newborn": "**A baby with these signs should be seen by a health worker today. Please don't wait.**\n\n",
    "abuse": "**Your safety matters. If you are in danger right now, call local emergency services or go somewhere safe.**\n\n",
    "support": "**You don't have to go through this alone. Please speak to a nurse or your clinician soon.**\n\n",
    "seizure": "**Please get this checked by a healthcare professional today. Don't wait for it to pass.**\n\n",
    "breathing": "**Please get this checked by a healthcare professional today. Don't wait for it to pass.**\n\n",
    "crisis": "**Please speak to a nurse or your clinician today.**\n\n",
    "harm_baby": "**Please speak to a nurse or your clinician today.**\n\n",
}


NOT_AN_AMBULANCE = "\n\n_LONI is not an ambulance or emergency service. Please don't wait for replies here before getting help._"


def _with_number(text: str, phone: Optional[str]) -> str:
    """Name the emergency number configured for this deployment (never a number the model made up)."""
    if not phone:
        return text
    return re.sub(r"local emergency services", f"emergency services ({phone})", text, flags=re.I)


def emergency_message(template: str, stage_text: Optional[str] = None, phone: Optional[str] = None) -> str:
    body = EMERGENCY.get(template, EMERGENCY["maternal"])
    body = body.replace("{stage}", f" and that you are {stage_text}" if stage_text else "")
    return _with_number(body, phone) + NOT_AN_AMBULANCE


def urgent_header(template: str, phone: Optional[str] = None) -> str:
    return _with_number(URGENT.get(template, URGENT["maternal"]), phone)
