from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from .models import HealthCheck

router = APIRouter()

@router.get("/")
async def health_check(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(select(HealthCheck).limit(1))
        db_status = "ok"
    except Exception as e:
        db_status = "error"
    return {"status": "ok", "db_status": db_status}
