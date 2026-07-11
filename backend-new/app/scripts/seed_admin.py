import asyncio
import os
import sys

# Add backend-new to sys.path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"))

from app.core.database import AsyncSessionLocal
from app.modules.users.models import User, UserTypeEnum, AccountStatusEnum, GenderEnum
from app.core.security import get_password_hash
from app.utils.generateId import generate_id
# pyrefly: ignore [missing-import]
from sqlalchemy import select

async def seed_admin():
    email = os.getenv("ADMIN_EMAIL")
    password = os.getenv("ADMIN_PASSWORD")
    
    if not email or not password:
        print("Error: Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env")
        return

    name = "Goodness Aigbokhan"

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if user:
            print(f"Admin with email {email} already exists.")
            
            # If exists but not admin, let's update it to ensure it is admin
            if user.user_type != UserTypeEnum.admin:
                user.user_type = UserTypeEnum.admin
                user.account_status = AccountStatusEnum.active
                await db.commit()
                print(f"Updated existing user {email} to be an admin.")
            return

        hashed_password = get_password_hash(password)
        
        new_admin = User(
            id=generate_id(),
            name=name,
            email=email,
            password=hashed_password,
            user_type=UserTypeEnum.admin,
            account_status=AccountStatusEnum.active,
            is_email_verified=True,
            gender=GenderEnum.Male, # Required by default
            referral_code=generate_id(8)
        )
        
        db.add(new_admin)
        await db.commit()
        print(f"Successfully created admin user: {name} ({email})")

if __name__ == "__main__":
    asyncio.run(seed_admin())
