import enum
from sqlalchemy import Column, String, Boolean, DateTime, Enum, Integer, ForeignKey
from sqlalchemy.orm import relationship as sa_relationship
from sqlalchemy.sql import func
from app.core.database import Base

class StatusEnum(str, enum.Enum):
    pregnant = 'pregnant'
    newMom = 'newMom'

class GenderEnum(str, enum.Enum):
    Male = 'Male'
    Female = 'Female'
    Others = 'Others'

class UserTypeEnum(str, enum.Enum):
    nurse = 'nurse'
    user = 'user'
    rider = 'rider'
    admin = 'admin'
    partner = 'partner'

class EmergencyContactStatus(str, enum.Enum):
    pending = 'pending'
    connected = 'connected'

class User(Base):
    __tablename__ = 'users'

    id = Column(String(12), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    status = Column(Enum(StatusEnum, native_enum=False, length=50), nullable=False)
    trimester = Column(String(50), nullable=True)
    pregnancy_week = Column(String(50), nullable=True)
    pregnancy_start_date = Column(DateTime(timezone=True), nullable=True)
    baby_age = Column(String(50), nullable=True)
    phone = Column(String(50), nullable=True)
    gender = Column(Enum(GenderEnum, native_enum=False, length=50), default=GenderEnum.Female)
    user_type = Column(Enum(UserTypeEnum, native_enum=False, length=50), default=UserTypeEnum.user)
    is_email_verified = Column(Boolean, default=False, nullable=False)
    is_phone_verified = Column(Boolean, default=False, nullable=False)
    profile_picture = Column(String(255), nullable=True)
    referral_code = Column(String(50), unique=True, index=True, nullable=False)
    referred_by = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    emergency_contacts = sa_relationship("EmergencyContact", foreign_keys="[EmergencyContact.user_id]", back_populates="user")

class EmergencyContact(Base):
    __tablename__ = 'emergency_contacts'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(12), ForeignKey('users.id'), nullable=False)
    contact_user_id = Column(String(12), ForeignKey('users.id'), nullable=False)
    relationship = Column(String(100), nullable=False)
    status = Column(Enum(EmergencyContactStatus, native_enum=False, length=50), default=EmergencyContactStatus.pending, nullable=False)
    location = Column(Boolean, default=False, nullable=False)
    updates = Column(Boolean, default=False, nullable=False)
    emergency = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = sa_relationship("User", foreign_keys=[user_id], back_populates="emergency_contacts")
    contact_user = sa_relationship("User", foreign_keys=[contact_user_id])
