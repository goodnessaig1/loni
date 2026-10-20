from datetime import datetime, time, timedelta, timezone

from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.calls.models import Call

# "Today" for the dashboard tile, in Nigerian time.
WAT = timezone(timedelta(hours=1))

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
        
    start_today = datetime.combine(datetime.now(WAT).date(), time.min, tzinfo=WAT)
    today_calls = (await db.execute(
        select(func.count(Call.id)).where(
            or_(Call.caller_id == user_id, Call.receiver_id == user_id),
            Call.duration_seconds > 0,
            Call.created_at >= start_today,
        )
    )).scalar() or 0

    # Ratings mothers gave this user (as the one who answered).
    rating_row = (await db.execute(
        select(func.avg(Call.rating), func.count(Call.rating)).where(
            Call.receiver_id == user_id, Call.rating.is_not(None),
        )
    )).first()
    rating_avg = round(float(rating_row[0]), 1) if rating_row and rating_row[0] is not None else None

    return {
        "total_calls": total_calls,
        "total_duration_seconds": total_duration_seconds,
        "total_duration_formatted": formatted,
        "today_calls": today_calls,
        "rating_avg": rating_avg,
        "rating_count": rating_row[1] if rating_row else 0,
    }
