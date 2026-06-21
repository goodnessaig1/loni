import asyncio
import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        print("Migrating emergency_contacts for email...")
        try:
            await conn.execute(text("ALTER TABLE emergency_contacts ADD COLUMN email VARCHAR(255)"))
            print("Added email column to emergency_contacts")
        except Exception as e:
            print("email column might already exist", str(e))
        print("Done!")

if __name__ == "__main__":
    asyncio.run(migrate())
