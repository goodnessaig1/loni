from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.modules.subscriptions import service
from app.modules.users.models import User


async def require_plus(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> User:
    """Dependency for LoniPlus-only endpoints: 403 unless a trial / paid period is running."""
    if not await service.has_access(db, current_user.id):
        raise HTTPException(status_code=403, detail="LoniPlus required")
    return current_user
