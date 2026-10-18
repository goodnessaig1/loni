"""
Changing a mother's stage (trimester, or pregnant <-> postpartum, or recovery stage).

The app stores "how far along" as a snapshot (`pregnancy_week` / `baby_age`) plus `pregnancy_start_date`, and
every read recomputes the live week from that start date (see utils/user_enrichment.py). So a stage change
must move the *start date*, otherwise the next read would snap the stage right back.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.modules.users.models import StatusEnum, User

# Weeks covered by each stage (matches the registration screen and the stage picker).
TRIMESTER_WEEKS = {1: (1, 12), 2: (13, 27), 3: (28, 40)}
RECOVERY_WEEKS = {'early': (1, 6), 'active': (7, 12), 'extended': (13, 52)}


def trimester_of(week: int) -> int:
    return 1 if week <= 12 else 2 if week <= 27 else 3


def recovery_stage_of(week: int) -> str:
    return 'early' if week <= 6 else 'active' if week <= 12 else 'extended'


def _digits(raw: Optional[str]) -> Optional[int]:
    digits = ''.join(ch for ch in str(raw or '') if ch.isdigit())
    return int(digits) if digits else None


def apply_stage(user: User, status: Optional[str], trimester: Optional[int], recovery_stage: Optional[str],
                now: Optional[datetime] = None) -> None:
    """Mutates `user`; the caller commits."""
    now = now or datetime.now(timezone.utc)
    current = user.status.value if user.status else 'pregnant'
    target = status or current

    if target in ('ttc', 'general'):
        user.status = StatusEnum.ttc if target == 'ttc' else StatusEnum.general
        user.pregnancy_week = None
        user.baby_age = None
        user.trimester = None
        user.pregnancy_start_date = None
        return

    if target == 'pregnant':
        week = _digits(user.pregnancy_week) if current == 'pregnant' else None
        if week is None:
            week = _digits(user.pregnancy_week) or 1  # coming back from postpartum: reuse the old value
        if trimester:
            lo, hi = TRIMESTER_WEEKS[trimester]
            if not lo <= week <= hi:
                week = lo
        week = min(max(week, 1), 40)
        user.status = StatusEnum.pregnant
        user.pregnancy_week = f"{week} weeks"
        user.trimester = {1: '1st Trimester', 2: '2nd Trimester', 3: '3rd Trimester'}[trimester_of(week)]
        user.baby_age = None
    else:
        week = _digits(user.baby_age) if current == 'newMom' else None
        if week is None:
            week = 1
        if recovery_stage:
            lo, hi = RECOVERY_WEEKS[recovery_stage]
            if not lo <= week <= hi:
                week = lo
        user.status = StatusEnum.newMom
        user.baby_age = str(week)
        user.pregnancy_week = None
        user.trimester = {'early': 'Early', 'active': 'Subacute', 'extended': 'Ongoing'}[recovery_stage_of(week)]

    user.pregnancy_start_date = now - timedelta(weeks=week)
