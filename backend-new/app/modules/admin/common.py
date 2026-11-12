"""Small helpers shared by the admin list endpoints: paging, date windows, short references and CSV."""
import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Iterable, List, Optional, Sequence

from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.staff.deps import StaffContext


def require(staff: StaffContext, *permissions: str) -> None:
    if not all(staff.can(p) for p in permissions):
        raise HTTPException(status_code=403, detail="You don't have access to this.")


def since(days: Optional[int]) -> Optional[datetime]:
    return datetime.now(timezone.utc) - timedelta(days=days) if days else None


def short_ref(prefix: str, value) -> str:
    """Display reference such as USR-8K2Q or RIDE-104. Never the only key: links use the real id."""
    text = str(value)
    return f"{prefix}-{text if text.isdigit() else text[-4:].upper()}"


async def page_of(db: AsyncSession, query, page: int, page_size: int):
    total = (await db.execute(select(func.count()).select_from(query.order_by(None).subquery()))).scalar_one()
    rows = (await db.execute(query.offset((page - 1) * page_size).limit(page_size))).all()
    return rows, {"total": total, "page": page, "page_size": page_size, "pages": max(1, -(-total // page_size))}


async def count(db: AsyncSession, query) -> int:
    return (await db.execute(select(func.count()).select_from(query.order_by(None).subquery()))).scalar_one()


def _cell(value) -> str:
    text = "" if value is None else (value.isoformat() if isinstance(value, datetime) else str(value))
    # Spreadsheet formula injection: never let a cell start with = + - @
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def csv_response(filename: str, header: Sequence[str], rows: Iterable[Sequence]) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    for row in rows:
        writer.writerow([_cell(v) for v in row])
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="loni-{filename}-{stamp}.csv"',
                                      "Cache-Control": "no-store"})


def ok(data) -> dict:
    return {"success": True, "data": data}


def tab_counts(tabs: List[str]) -> dict:
    return {t: 0 for t in tabs}
