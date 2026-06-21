from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.modules.users.models import User
from app.modules.auth.schemas import (
    LoginRequest, RegisterRequest, VerifyOtpRequest, ResendOtpRequest,
    ForgotPasswordRequest, ResetPasswordRequest, StandardResponse,
    AddPhoneRequest, VerifyPhoneRequest, SetupPartnerRequest
)
from app.modules.auth.service import (
    authenticate_user, register_new_user, verify_otp, resend_otp, reset_password
)
from app.core.security import create_access_token, get_password_hash
from sqlalchemy.future import select
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
        
    # Update password and phone
    user.password = get_password_hash(data.password)
    user.phone = data.phone
    user.is_email_verified = False # ensure they verify
    db.add(user)
    await db.commit()
    
    # Send email verification OTP
    await resend_otp(db, data.email, "email_verification")
    
    return {"success": True, "message": "Account setup. OTP sent to email."}

