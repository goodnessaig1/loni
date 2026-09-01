from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
import asyncio

from app.core.database import get_db
from app.api.deps import get_admin_user
from app.modules.users.models import User, UserTypeEnum, AccountStatusEnum
from app.modules.users.schemas import UserResponse
from app.modules.admin.schemas import UpdateAccountStatusRequest
from app.modules.auth.email_service import send_account_approved_email
from app.modules.notifications.service import NotificationService
from app.core.ws_manager import manager as ws_manager

router = APIRouter()

@router.get("/users", response_model=List[UserResponse])
async def get_users_by_status(
    account_status: Optional[AccountStatusEnum] = Query(None, description="Filter users by account status"),
    user_type: Optional[UserTypeEnum] = Query(None, description="Filter users by user type (e.g. nurse, driver)"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    """
    Get users based on their account status and/or user type.
    Requires admin privileges.
    """
    query = select(User).options(
        selectinload(User.nurse_profile),
        selectinload(User.driver_profile)
    )
    
    if account_status:
        query = query.where(User.account_status == account_status)
    if user_type:
        query = query.where(User.user_type == user_type)
        
    result = await db.execute(query)
    users = result.scalars().all()
    
    return users

@router.patch("/users/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: str,
    data: UpdateAccountStatusRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    """
    Update a user's account status (e.g., active,pending or suspended account).
    Requires admin privileges.
    """
    result = await db.execute(
        select(User)
        .options(selectinload(User.nurse_profile), selectinload(User.driver_profile))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    old_status = user.account_status
    user.account_status = data.status
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Notify the user when their account is newly approved (nurse or driver).
    if old_status == AccountStatusEnum.pending and data.status == AccountStatusEnum.active:
        if user.user_type in [UserTypeEnum.nurse, UserTypeEnum.driver]:
            first_name = user.name.split()[0] if user.name else "there"
            role = user.user_type.value

            # Fire and forget the email sending so it doesn't block the response
            asyncio.create_task(send_account_approved_email(
                to_email=user.email,
                name=first_name,
                user_type=role
            ))

            # Real-time signal for a foregrounded app: it flips straight to
            # the dashboard without waiting on a (best-effort) push. Falls
            # through harmlessly if the user has no live socket right now -
            # the FCM push below covers the backgrounded / killed case.
            status_payload = {
                "account_status": data.status.value,
                "user_type": role,
            }
            try:
                await ws_manager.send_to_user(user.id, "account_status", status_payload)
            except Exception as e:  # signaling must never break the approval
                print(f"Failed to push account_status over WS to {user.id}: {e}")

            # Wake / notify a backgrounded or closed app. `type` lets the
            # client route the tap straight to the dashboard.
            asyncio.create_task(NotificationService.notify_user(
                user_id=user.id,
                title="You're approved 🎉",
                body=f"Your Loni {role} account has been verified. Tap to get started.",
                data={"type": "account_approved", **status_payload},
            ))

    return user
