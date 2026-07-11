from datetime import datetime, timezone
import re
from app.modules.users.models import User

def calculate_pregnancy_start_date(status: str, pregnancy_week: str = None, baby_age: str = None):
    weeks = None
    if status == 'pregnant' and pregnancy_week:
        weeks_str = re.sub(r'[^0-9]', '', str(pregnancy_week))
        if weeks_str:
            weeks = int(weeks_str)
    elif status == 'newMom' and baby_age:
        weeks_str = re.sub(r'[^0-9]', '', str(baby_age))
        if weeks_str:
            weeks = int(weeks_str)
            
    if weeks is not None:
        # Subtract weeks in seconds: weeks * 7 days * 24 hours * 60 mins * 60 secs
        import time
        from datetime import timedelta
        # It's better to use timedelta
        return datetime.now(timezone.utc) - timedelta(weeks=weeks)
    return None

def enrich_user_data(user: User) -> dict:
    user_data = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "status": user.status.value if user.status else None,
        "account_status": user.account_status.value if user.account_status else "pending",
        "phone": user.phone,
        "gender": user.gender.value if user.gender else None,
        "user_type": user.user_type.value if user.user_type else None,
        "is_email_verified": user.is_email_verified,
        "is_phone_verified": user.is_phone_verified,
        "profile_picture": user.profile_picture,
        "referral_code": user.referral_code,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "is_online": user.is_online if hasattr(user, 'is_online') and user.is_online is not None else False,
        "trimester": user.trimester,
        "pregnancy_week": user.pregnancy_week,
        "pregnancy_start_date": user.pregnancy_start_date.isoformat() if user.pregnancy_start_date else None,
        "baby_age": user.baby_age,
    }

    if user.user_type and user.user_type.value == 'nurse' and hasattr(user, 'nurse_profile') and user.nurse_profile:
        user_data["nurse_profile"] = {
            "years_of_experience": user.nurse_profile.years_of_experience,
            "hospital_affiliation": user.nurse_profile.hospital_affiliation,
            "verification_documents": user.nurse_profile.verification_documents,
        }
    elif user.user_type and user.user_type.value == 'driver' and hasattr(user, 'driver_profile') and user.driver_profile:
        user_data["driver_profile"] = {
            "vehicle_type": user.driver_profile.vehicle_type,
            "has_ac": user.driver_profile.has_ac,
            "vehicle_brand": user.driver_profile.vehicle_brand,
            "vehicle_year": user.driver_profile.vehicle_year,
            "vehicle_model": user.driver_profile.vehicle_model,
            "plate_number": user.driver_profile.plate_number,
            "vehicle_color": user.driver_profile.vehicle_color,
            "verification_documents": user.driver_profile.verification_documents,
        }
    
    if user.pregnancy_start_date:
        now = datetime.now(timezone.utc)
        start = user.pregnancy_start_date
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
            
        diff_time = now.timestamp() - start.timestamp()
        diff_days = diff_time / (60 * 60 * 24)
        weeks = int(diff_days // 7)
        
        status_val = user.status.value if user.status else None
        
        if status_val == 'pregnant':
            user_data["pregnancyWeek"] = f"{weeks} weeks"
            user_data["pregnancy_week"] = f"{weeks} weeks"
            if weeks <= 13:
                user_data["trimester"] = '1st Trimester'
            elif weeks <= 27:
                user_data["trimester"] = '2nd Trimester'
            else:
                user_data["trimester"] = '3rd Trimester'
        elif status_val == 'newMom':
            user_data["babyAge"] = f"{weeks}"
            user_data["baby_age"] = f"{weeks}"
            if weeks == 0:
                user_data["trimester"] = 'Immediate'
            elif weeks <= 6:
                user_data["trimester"] = 'Early'
            elif weeks <= 12:
                user_data["trimester"] = 'Subacute'
            else:
                user_data["trimester"] = 'Ongoing'
                
    # Also support camelCase equivalents for frontend
    user_data["pregnancyStartDate"] = user_data["pregnancy_start_date"]
    user_data["profilePicture"] = user_data["profile_picture"]
    
    return user_data
