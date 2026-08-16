from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.calls.models import Call

async def get_user_call_stats(db: AsyncSession, user_id: str):
    stmt = select(
        func.count(Call.id).label("total_calls"),
        func.coalesce(func.sum(Call.duration_seconds), 0).label("total_duration_seconds")
    ).where(
        or_(Call.caller_id == user_id, Call.receiver_id == user_id),
        Call.duration_seconds > 0
    )
    result = await db.execute(stmt)
    row = result.first()
    
    total_calls = row.total_calls if row else 0
    total_duration_seconds = row.total_duration_seconds if row else 0
    
    # Format duration
    if total_duration_seconds < 60:
        formatted = f"{total_duration_seconds} sec{'s' if total_duration_seconds != 1 else ''}"
    elif total_duration_seconds < 3600:
        minutes = total_duration_seconds // 60
        formatted = f"{minutes} min{'s' if minutes != 1 else ''}"
    else:
        hours = total_duration_seconds // 3600
        minutes = (total_duration_seconds % 3600) // 60
        formatted = f"{hours} hr{'s' if hours != 1 else ''} {minutes} min"
        
    return {
        "total_calls": total_calls,
        "total_duration_seconds": total_duration_seconds,
        "total_duration_formatted": formatted
    }
