import enum
from sqlalchemy import Column, String, Boolean, DateTime, Enum, Integer, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship as sa_relationship
from sqlalchemy.sql import func
from app.core.database import Base

class AccountStatusEnum(str, enum.Enum):
    pending = 'pending'
    active = 'active'
    suspended = 'suspended'

class StatusEnum(str, enum.Enum):
    pregnant = 'pregnant'
    newMom = 'newMom'

class GenderEnum(str, enum.Enum):
    Male = 'Male'
    Female = 'Female'
    Others = 'Others'

class UserTypeEnum(str, enum.Enum):
    nurse = 'nurse'
    driver = 'driver'
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
    status = Column(Enum(StatusEnum, native_enum=False, length=50), nullable=True) # Maternal status, optional for nurses/drivers
    account_status = Column(Enum(AccountStatusEnum, native_enum=False, length=50), server_default='pending', nullable=False)
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
    is_online = Column(Boolean, default=False, nullable=False, server_default='false')
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    emergency_contacts = sa_relationship("EmergencyContact", foreign_keys="[EmergencyContact.user_id]", back_populates="user")
    nurse_profile = sa_relationship("NurseProfile", back_populates="user", uselist=False)
    driver_profile = sa_relationship("DriverProfile", back_populates="user", uselist=False)

class EmergencyContact(Base):
    __tablename__ = 'emergency_contacts'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(12), ForeignKey('users.id'), nullable=False)
    contact_user_id = Column(String(12), ForeignKey('users.id'), nullable=False)
    relationship = Column(String(100), nullable=False)
    status = Column(Enum(EmergencyContactStatus, native_enum=False, length=50), default=EmergencyContactStatus.pending, nullable=False)
    location = Column(Boolean, default=True, nullable=False)
    updates = Column(Boolean, default=True, nullable=False)
    emergency = Column(Boolean, default=True, nullable=False)
    # Set once, in verify_partner_setup, when status flips to 'connected' -
    # distinct from created_at (when the invite was sent).
    connected_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = sa_relationship("User", foreign_keys=[user_id], back_populates="emergency_contacts")
    contact_user = sa_relationship("User", foreign_keys=[contact_user_id])

class NurseProfile(Base):
    __tablename__ = 'nurse_profiles'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(12), ForeignKey('users.id'), unique=True, nullable=False)
    years_of_experience = Column(Integer, nullable=True)
    hospital_affiliation = Column(String(255), nullable=True)
    verification_documents = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = sa_relationship("User", back_populates="nurse_profile")

class DriverProfile(Base):
    __tablename__ = 'driver_profiles'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(12), ForeignKey('users.id'), unique=True, nullable=False)
    # Personal info step (collected during onboarding, before vehicle details).
    full_name = Column(String(255), nullable=True)
    date_of_birth = Column(String(50), nullable=True)
    profile_photo = Column(String(500), nullable=True)
    vehicle_type = Column(String(100), nullable=True)
    has_ac = Column(Boolean, nullable=True)
    vehicle_brand = Column(String(100), nullable=True)
    vehicle_year = Column(String(50), nullable=True)
    vehicle_model = Column(String(100), nullable=True)
    plate_number = Column(String(100), nullable=True)
    vehicle_color = Column(String(100), nullable=True)
    verification_documents = Column(JSON, nullable=True)
    # Set when the driver taps "Submit for Review" on the final step. Until then
    # the profile rows exist but the application is still in progress.
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    # --- Live dispatch state (emergency ride module) ---
    # Last reported GPS fix, pushed by the driver app while online / on a
    # trip via POST /rides/location. Used to pick the nearest driver and to
    # stream the car's position to the waiting mother.
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)  # degrees, 0-360
    location_updated_at = Column(DateTime(timezone=True), nullable=True)
    # "Accepting rides" - distinct from User.is_online ("app is open"). A
    # driver on an active trip is is_online=True but is_available=False.
    is_available = Column(Boolean, default=True, server_default='true', nullable=False)
    active_ride_id = Column(Integer, nullable=True)
    # Cumulative, updated on trip completion. rating_avg/count come from the
    # mother's post-trip star rating.
    rating_avg = Column(Float, default=0, nullable=False, server_default='0')
    rating_count = Column(Integer, default=0, nullable=False, server_default='0')
    total_trips = Column(Integer, default=0, nullable=False, server_default='0')
    total_earnings = Column(Integer, default=0, nullable=False, server_default='0')  # whole Naira

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = sa_relationship("User", back_populates="driver_profile")
