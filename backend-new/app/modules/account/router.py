"""Account-level things every role shares: app settings, contacting support. Mounted at /api/v1/account."""
import asyncio
import html
import logging
from typing import Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.ratelimit import limit
from app.core.config import settings
from app.core.database import get_db
from app.modules.account import service
from app.modules.account.models import SupportMessage
from app.modules.users.models import User

router = APIRouter()
logger = logging.getLogger("account")

SUBJECTS = ("General question", "Account & verification", "Calls", "Rides & trips", "Payments", "Report a problem", "Other")


class SettingsIn(BaseModel):
    prefs: Dict[str, bool]


class SupportIn(BaseModel):
    subject: str = Field(min_length=2, max_length=120)
    message: str = Field(min_length=5, max_length=4000)
    name: Optional[str] = Field(default=None, max_length=255)
    email: Optional[str] = Field(default=None, max_length=255)

    @field_validator("message", "subject")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Required")
        return v


@router.get("/settings")
async def get_settings(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return {"success": True, "data": {"prefs": await service.get_settings(db, current_user)}}


@router.put("/settings")
async def put_settings(body: SettingsIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    prefs = await service.update_settings(db, current_user, body.prefs)
    return {"success": True, "message": "Settings saved", "data": {"prefs": prefs}}


@router.get("/support")
async def support_info(current_user: User = Depends(get_current_user)):
    """How to reach LONI support - served by the API so the numbers change without an app release."""
    return {"success": True, "data": {
        "email": settings.SUPPORT_EMAIL,
        "phone": settings.SUPPORT_PHONE,
        "hours": settings.SUPPORT_HOURS,
        "subjects": list(SUBJECTS),
    }}


@router.post("/support", status_code=201, dependencies=[Depends(limit("account.support", 5, 3600, "You have sent several messages already. Our team will reply by email."))])
async def contact_support(body: SupportIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    msg = SupportMessage(
        user_id=current_user.id,
        user_type=current_user.user_type.value if current_user.user_type else None,
        name=(body.name or current_user.name or "").strip() or "LONI user",
        email=(body.email or current_user.email).strip(),
        subject=body.subject,
        message=body.message,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    asyncio.create_task(_forward(msg))
    return {"success": True, "message": "Message sent. Our team will get back to you by email.", "data": {"id": msg.id}}


async def _forward(msg: SupportMessage) -> None:
    """Copy the message to the support inbox. Stored first, so a failed email loses nothing."""
    try:
        from app.modules.auth.email_service import send_plain_email
        body = (f"<p><b>From:</b> {html.escape(msg.name)} &lt;{html.escape(msg.email)}&gt; ({html.escape(msg.user_type or '')})</p>"
                f"<p><b>Subject:</b> {html.escape(msg.subject)}</p><p>{html.escape(msg.message).replace(chr(10), '<br/>')}</p>")
        await send_plain_email(settings.SUPPORT_EMAIL, f"[LONI support #{msg.id}] {msg.subject}", body, reply_to=msg.email)
    except Exception as e:  # never fail the request because email is down
        logger.warning("support email forward failed for #%s: %s", msg.id, e)
