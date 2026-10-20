import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import update
from app.modules.auth.models import Otp
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.modules.users.models import User
from app.modules.auth.schemas import (
    LoginRequest, RegisterRequest, VerifyOtpRequest, ResendOtpRequest,
    ForgotPasswordRequest, ResetPasswordRequest, StandardResponse,
    AddPhoneRequest, VerifyPhoneRequest, SetupPartnerRequest, VerifyPartnerSetupRequest
)
from app.modules.auth.service import (
    authenticate_user, register_new_user, verify_otp, resend_otp, reset_password
)
from app.modules.auth.email_service import (
    send_inviter_connection_success_email, send_partner_connection_success_email
)
from app.core.security import create_access_token, get_password_hash
from sqlalchemy.future import select
from app.modules.users.models import User, EmergencyContact
from app.utils.user_enrichment import enrich_user_data

router = APIRouter()

@router.post("/register", response_model=StandardResponse)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await register_new_user(db, data)
    return {"success": True, "message": "Registration successful", "data": result}

@router.post("/login", response_model=StandardResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await authenticate_user(db, data.email, data.password)
    return {"success": True, "message": "Login successful", "data": result}

@router.post("/verify-email", response_model=StandardResponse)
async def verify_email(data: VerifyOtpRequest, db: AsyncSession = Depends(get_db)):
    await verify_otp(db, data.email, data.otp, data.type.value)
    
    # Fetch the user to return token and user details so the app can log them in
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if user:
        token = create_access_token(subject=user.id)
        user_data = enrich_user_data(user)
        return {"success": True, "message": "Verification successful", "data": {"token": token, "user": user_data}}
        
    return {"success": True, "message": "Verification successful"}

@router.post("/resend-otp", response_model=StandardResponse)
async def resend_otp_route(data: ResendOtpRequest, db: AsyncSession = Depends(get_db)):
    await resend_otp(db, data.email, data.type.value)
    return {"success": True, "message": "OTP sent successfully"}

@router.post("/forgot-password", response_model=StandardResponse)
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    await resend_otp(db, data.email, "reset_password")
    return {"success": True, "message": "Reset password OTP sent to email"}

@router.post("/reset-password", response_model=StandardResponse)
async def reset_password_route(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    await verify_otp(db, data.email, data.otp, "reset_password")
    await reset_password(db, data.email, data.newPassword)
    return {"success": True, "message": "Password reset successful"}

@router.post("/add-phone", response_model=StandardResponse)
async def add_phone(
    data: AddPhoneRequest, 
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    current_user.phone = data.phone # type: ignore
    db.add(current_user)
    await db.commit()
    
    # Generate an OTP for phone verification
    await resend_otp(db, str(current_user.email), "phone_verification")
    
    return {"success": True, "message": "Phone added and OTP sent"}

@router.post("/verify-phone", response_model=StandardResponse)
async def verify_phone(
    data: VerifyPhoneRequest, 
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    await verify_otp(db, str(current_user.email), data.otp, "phone_verification")
    return {"success": True, "message": "Phone verification successful"}

@router.post("/setup-partner", response_model=StandardResponse)
async def setup_partner(data: SetupPartnerRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Please ensure you were invited first."
        )
        
    if user.user_type != "partner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is only for invited partners."
        )
        
    if user.is_phone_verified:
        # Setup is one-time; afterwards the account is changed only by logging in or resetting the password.
        raise HTTPException(status_code=409, detail="This account is already set up. Log in, or reset your password.")

    # Nothing changes until the code emailed to the invited address is entered (verify-partner-setup),
    # so knowing someone's email is not enough to set their password.
    await resend_otp(db, data.email, "phone_verification")
    pending = json.dumps({
        "password_hash": get_password_hash(data.password),
        "phone": data.phone,
        "name": (data.name or "").strip() or None,
    })
    await db.execute(update(Otp).where(Otp.email == data.email, Otp.type == "phone_verification").values(payload=pending))
    await db.commit()

    return {"success": True, "message": "Check your email for the code to finish setting up."}

@router.post("/verify-partner-setup", response_model=StandardResponse)
async def verify_partner_setup(data: VerifyPartnerSetupRequest, db: AsyncSession = Depends(get_db)):
    pending_raw = (await db.execute(select(Otp.payload).where(
        Otp.email == data.email, Otp.otp == data.otp, Otp.type == "phone_verification",
    ))).scalars().first()

    # Verify OTP
    await verify_otp(db, data.email, data.otp, "phone_verification")

    # Fetch partner
    result = await db.execute(select(User).where(User.email == data.email))
    partner = result.scalar_one_or_none()

    if not partner or partner.user_type != "partner":
        raise HTTPException(status_code=400, detail="Invalid partner user")

    # Apply what was submitted at setup, now that the email owner has confirmed it.
    if pending_raw:
        pending = json.loads(pending_raw)
        partner.password = pending["password_hash"]
        partner.phone = pending.get("phone") or partner.phone
        if pending.get("name"):
            partner.name = pending["name"]
        partner.is_email_verified = True
        db.add(partner)
        
    # Find emergency contact relationship
    contact_result = await db.execute(select(EmergencyContact).where(EmergencyContact.contact_user_id == partner.id))
    emergency_contact = contact_result.scalar_one_or_none()
    
    if emergency_contact:
        # Update relationship status
        emergency_contact.status = "connected"
        emergency_contact.connected_at = datetime.now(timezone.utc)
        partner.is_phone_verified = True
        db.add(emergency_contact)
        db.add(partner)
        await db.commit()
        
        # Get inviter to send emails
        inviter_result = await db.execute(select(User).where(User.id == emergency_contact.user_id))
        inviter = inviter_result.scalar_one_or_none()
        
        if inviter:
            # She sees them as connected straight away (live + push + Notification Centre).
            from app.modules.users.partner_sync import tell
            await tell(db, inviter.id, "partner_connected", "Support partner connected",
                       f"{partner.name} joined your support circle.", {"partner_name": partner.name})
            await db.commit()
            # Send emails in background
            import asyncio
            asyncio.create_task(send_inviter_connection_success_email(inviter.email, partner.name))
            asyncio.create_task(send_partner_connection_success_email(partner.email, inviter.name))
            
    return {"success": True, "message": "Partner setup fully verified and connected."}


