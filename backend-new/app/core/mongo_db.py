from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

# Global MongoDB client instance
client: AsyncIOMotorClient = None
db = None

def get_mongo_client() -> AsyncIOMotorClient:
    return client

def get_mongo_db():
    return db
