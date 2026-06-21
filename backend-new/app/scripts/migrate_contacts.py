import asyncio
import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        print("Migrating emergency_contacts...")
        try:
            await conn.execute(text("ALTER TABLE emergency_contacts ADD COLUMN status VARCHAR(50) DEFAULT 'pending'"))
        except Exception as e:
            print("status column might already exist")
        try:
            await conn.execute(text("ALTER TABLE emergency_contacts ADD COLUMN profile_picture VARCHAR(255)"))
        except Exception as e:
            print("profile_picture column might already exist")
        try:
            await conn.execute(text("ALTER TABLE emergency_contacts ADD COLUMN location BOOLEAN DEFAULT FALSE"))
        except Exception as e:
            print("location column might already exist")
        try:
            await conn.execute(text("ALTER TABLE emergency_contacts ADD COLUMN updates BOOLEAN DEFAULT FALSE"))
        except Exception as e:
            print("updates column might already exist")
        try:
            await conn.execute(text("ALTER TABLE emergency_contacts ADD COLUMN emergency BOOLEAN DEFAULT FALSE"))
        except Exception as e:
            print("emergency column might already exist")
        
        await conn.execute(text("UPDATE emergency_contacts SET status = 'pending' WHERE status IS NULL"))
        await conn.execute(text("UPDATE emergency_contacts SET location = FALSE WHERE location IS NULL"))
        await conn.execute(text("UPDATE emergency_contacts SET updates = FALSE WHERE updates IS NULL"))
        await conn.execute(text("UPDATE emergency_contacts SET emergency = FALSE WHERE emergency IS NULL"))
        print("Done!")

if __name__ == "__main__":
    asyncio.run(migrate())
