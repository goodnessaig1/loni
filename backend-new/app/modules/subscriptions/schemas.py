from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

PlanId = Literal['monthly', 'annual']
CancelReason = Literal['too_expensive', 'not_using_enough', 'found_alternative', 'temporary_break', 'other']


class PlanOut(BaseModel):
    id: PlanId
    price: int                      # whole naira
    currency: str = 'NGN'
    interval: Literal['month', 'year']
    label: str                      # "Monthly" / "Annual"
    billed: str                     # "Billed monthly"
    badge: Optional[str] = None     # "Save 40%"


class PlansOut(BaseModel):
    trial_days: int
    features: List[str]
    plans: List[PlanOut]


class SubscriptionOut(BaseModel):
    """`state` is what the app switches on: none -> offer, trialing/active -> manage, cancelled -> resume."""
    state: Literal['none', 'trialing', 'active', 'cancelled', 'expired']
    has_access: bool
    plan: Optional[PlanId] = None
    price: Optional[int] = None
    trial_ends_at: Optional[datetime] = None
    access_ends_at: Optional[datetime] = None
    days_left: Optional[int] = None
    cancelled_at: Optional[datetime] = None
    can_start_trial: bool


class StartTrialIn(BaseModel):
    plan: PlanId


class CancelIn(BaseModel):
    reason: CancelReason
    note: Optional[str] = Field(None, max_length=500)
