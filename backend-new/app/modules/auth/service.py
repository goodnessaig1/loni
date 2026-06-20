from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from app.modules.users.models import User
from app.modules.auth.models import Otp
from app.core.security import verify_password, create_access_token, get_password_hash
from fastapi import HTTPException, status
from app.utils.generateId import generate_id
from app.modules.auth.schemas import RegisterRequest
from app.modules.auth.email_service import send_otp_email
from app.utils.user_enrichment import calculate_pregnancy_start_date, enrich_user_data
from datetime import datetime, timedelta, timezone
import random

async def authenticate_user(db: AsyncSession, email: str, password: str) -> dict:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(password, str(user.password)): # type: ignore
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token(subject=user.id)
    return {"token": token, "user": enrich_user_data(user)}

async def register_new_user(db: AsyncSession, data: RegisterRequest) -> dict:
    result = await db.execute(select(User).where(User.email == data.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    start_date = calculate_pregnancy_start_date(
        status=data.status.value,
        pregnancy_week=data.pregnancyWeek,
        baby_age=data.babyAge
    )

    new_user = User(
        id=generate_id(),
        name=data.name,
        email=data.email,
        password=get_password_hash(data.password),
        status=data.status,
        trimester=data.trimester,
        pregnancy_week=data.pregnancyWeek,
        pregnancy_start_date=start_date,
        baby_age=data.babyAge,
        phone=None,
        gender=data.gender,
        user_type=data.userType,
        referral_code=generate_id(8),
        referred_by=data.referredBy
    )
    db.add(new_user)
    
    # Generate OTP
    otp_code = str(random.randint(1000, 9999))
    new_otp = Otp(
        email=data.email,
        otp=otp_code,
        type="email_verification",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
    )
    db.add(new_otp)
    
    await db.commit()
    await db.refresh(new_user)
    
    # Send email with Brevo API
    await send_otp_email(data.email, otp_code, "Verification")
    
    print(f"\n\n==========================================")
    print(f"   YOUR OTP FOR {data.email} IS: {otp_code}   ")
    print(f"==========================================\n\n")
    
    token = create_access_token(subject=new_user.id)
    return {"token": token}

async def verify_otp(db: AsyncSession, email: str, otp: str, type: str):
    print(f"DEBUG verify_otp inputs: email={email}, otp={otp}, type={type}")
    
    # First, check if the user is already verified (Idempotency check)
    user_res = await db.execute(select(User).where(User.email == email))
    user = user_res.scalar_one_or_none()
    
    if user:
        if type == "email_verification" and user.is_email_verified:
            print(f"DEBUG verify_otp: User {email} is already email verified. Returning success.")
            return True
        elif type == "phone_verification" and user.is_phone_verified:
            print(f"DEBUG verify_otp: User {email} is already phone verified. Returning success.")
            return True

    result = await db.execute(select(Otp).where(Otp.email == email, Otp.otp == otp, Otp.type == type))
    otp_record = result.scalar_one_or_none()
    
    print(f"DEBUG verify_otp otp_record found: {otp_record is not None}")
    
    # Needs timezone-aware comparison
    if not otp_record or otp_record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        print(f"DEBUG verify_otp failure. Record exists: {bool(otp_record)}")
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
    if type == "email_verification":
        res = await db.execute(select(User).where(User.email == email))
        user = res.scalar_one_or_none()
        if user:
            user.is_email_verified = True # type: ignore
            db.add(user)
    elif type == "phone_verification":
        res = await db.execute(select(User).where(User.email == email))
        user = res.scalar_one_or_none()
        if user:
            user.is_phone_verified = True # type: ignore
            db.add(user)
            
    await db.delete(otp_record)
    await db.commit()
    return True

async def resend_otp(db: AsyncSession, email: str, type: str):
    res = await db.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    await db.execute(delete(Otp).where(Otp.email == email, Otp.type == type))
    
    otp_code = str(random.randint(1000, 9999))
    new_otp = Otp(
        email=email,
        otp=otp_code,
        type=type,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
    )
    db.add(new_otp)
    await db.commit()
    
    # Send email with Brevo API
    await send_otp_email(email, otp_code, "Verification")
    
    print(f"\n\n==========================================")
    print(f"   YOUR OTP FOR {email} IS: {otp_code}   ")
    print(f"==========================================\n\n")
    
    return True

async def reset_password(db: AsyncSession, email: str, new_password: str):
    res = await db.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.password = get_password_hash(new_password) # type: ignore
    db.add(user)
    await db.commit()
    return True
