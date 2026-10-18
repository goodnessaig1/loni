"""Subscription rules: plans, trial, cancel/resume, and the single place that decides "has access"."""
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.subscriptions.models import Subscription
from app.modules.subscriptions.schemas import PlanOut, PlansOut, SubscriptionOut

TRIAL_DAYS = 7

FEATURES = [
    'Unlimited Loni AI conversations',
    'Priority Emergency ride dispatch',
    'Personalized pregnancy insights',
    'Unlimited personalized nutrition plans',
    'Personalized weekly health reports',
    'and many more',
]

# Prices live here (not in the app) so they can change without a release.
PLANS = {
    'monthly': PlanOut(id='monthly', price=9900, interval='month', label='Monthly', billed='Billed monthly'),
    'annual': PlanOut(id='annual', price=5900, interval='year', label='Annual', billed='Billed annually',
                      badge='Save 40%'),
}
PERIOD = {'monthly': timedelta(days=30), 'annual': timedelta(days=365)}


def plans_out() -> PlansOut:
    return PlansOut(trial_days=TRIAL_DAYS, features=FEATURES, plans=list(PLANS.values()))


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


async def get_subscription(db: AsyncSession, user_id: str) -> Optional[Subscription]:
    return (await db.execute(select(Subscription).where(Subscription.user_id == user_id))).scalar_one_or_none()


def effective_state(sub: Optional[Subscription], now: Optional[datetime] = None) -> str:
    """none | trialing | active | cancelled (still inside the paid period) | expired."""
    if sub is None:
        return 'none'
    now = now or datetime.now(timezone.utc)
    if _aware(sub.current_period_end) <= now:
        return 'expired'
    return sub.status


async def has_access(db: AsyncSession, user_id: str) -> bool:
    """Premium features call this. Trialing, active and cancelled-but-not-yet-ended all count."""
    return effective_state(await get_subscription(db, user_id)) in ('trialing', 'active', 'cancelled')


def to_out(sub: Optional[Subscription], now: Optional[datetime] = None) -> SubscriptionOut:
    now = now or datetime.now(timezone.utc)
    state = effective_state(sub, now)
    if sub is None:
        return SubscriptionOut(state='none', has_access=False, can_start_trial=True)
    end = _aware(sub.current_period_end)
    left = max((end - now).days + (1 if (end - now).seconds else 0), 0) if state != 'expired' else 0
    return SubscriptionOut(
        state=state,
        has_access=state in ('trialing', 'active', 'cancelled'),
        plan=sub.plan,
        price=PLANS[sub.plan].price,
        trial_ends_at=_aware(sub.trial_ends_at),
        access_ends_at=end,
        days_left=left,
        cancelled_at=_aware(sub.cancelled_at),
        can_start_trial=False,  # the one trial per person is spent
    )


class TrialAlreadyUsed(Exception):
    pass


async def start_trial(db: AsyncSession, user_id: str, plan: str) -> Subscription:
    if await get_subscription(db, user_id):
        raise TrialAlreadyUsed()
    now = datetime.now(timezone.utc)
    ends = now + timedelta(days=TRIAL_DAYS)
    sub = Subscription(user_id=user_id, plan=plan, status='trialing', trial_ends_at=ends, current_period_end=ends)
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


async def cancel(db: AsyncSession, sub: Subscription, reason: str, note: Optional[str]) -> Subscription:
    """Cancelling never cuts access short: it stays until `current_period_end`."""
    sub.status = 'cancelled'
    sub.cancelled_at = datetime.now(timezone.utc)
    sub.cancel_reason = reason
    sub.cancel_note = (note or '').strip() or None
    await db.commit()
    await db.refresh(sub)
    return sub


async def resume(db: AsyncSession, sub: Subscription) -> Subscription:
    """Undo a cancellation while access is still running. Back to trialing if the trial hasn't ended."""
    now = datetime.now(timezone.utc)
    trial_end = _aware(sub.trial_ends_at)
    sub.status = 'trialing' if trial_end and trial_end > now else 'active'
    sub.cancelled_at = None
    sub.cancel_reason = None
    sub.cancel_note = None
    await db.commit()
    await db.refresh(sub)
    return sub
