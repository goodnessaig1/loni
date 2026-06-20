import enum
from sqlalchemy import Column, String, Integer, DateTime, Enum
from sqlalchemy.sql import func
from app.core.database import Base

class OtpTypeEnum(str, enum.Enum):
    email_verification = 'email_verification'
    phone_verification = 'phone_verification'
    reset_password = 'reset_password'

class Otp(Base):
    __tablename__ = 'otps'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), index=True, nullable=False)
    otp = Column(String(6), nullable=False)
    type = Column(Enum(OtpTypeEnum, native_enum=False, length=50), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
