from typing import Dict

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.account.models import UserSettings
from app.modules.users.models import User

# Every setting a screen can show, with its default. Unknown keys sent by a client are ignored.
DEFAULTS: Dict[str, bool] = {
    "push": True,                   # all roles: push notifications at all
    "email_updates": True,          # all roles: account / summary emails
    "sms_alerts": False,            # partner: SMS for emergencies (no SMS provider yet)
    "incoming_calls": True,         # nurse: ring for new support requests
    "messages": True,               # nurse: message notifications
    "availability_reminders": True, # nurse / driver: remind to go online
    "call_sounds": True,            # nurse / driver: ringtone and ringback
    "trip_updates": True,           # driver: trip and request notifications
}


def effective(prefs: dict | None) -> Dict[str, bool]:
    out = dict(DEFAULTS)
    for k, v in (prefs or {}).items():
        if k in DEFAULTS and isinstance(v, bool):
            out[k] = v
    return out


async def get_settings(db: AsyncSession, user: User) -> Dict[str, bool]:
    row = await db.get(UserSettings, user.id)
    return effective(row.prefs if row else None)


async def update_settings(db: AsyncSession, user: User, changes: dict) -> Dict[str, bool]:
    row = await db.get(UserSettings, user.id)
    if row is None:
        row = UserSettings(user_id=user.id, prefs={})
        db.add(row)
    merged = effective(row.prefs)
    for k, v in changes.items():
        if k in DEFAULTS and isinstance(v, bool):
            merged[k] = v
    # store only what differs from the defaults
    row.prefs = {k: v for k, v in merged.items() if DEFAULTS[k] != v}
    await db.commit()
    return merged
