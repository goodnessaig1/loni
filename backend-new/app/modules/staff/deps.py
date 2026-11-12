"""
FastAPI dependencies that guard the admin API.

    staff: Staff = Depends(require_permission("nurses.manage"))

Every request re-reads the staff row, their role and their session, so suspending someone, revoking a
session or removing a permission takes effect on their very next request (tokens carry no permissions).
"""
from dataclasses import dataclass, field
from typing import FrozenSet, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.modules.staff import permissions as perms
from app.modules.staff.models import Staff, StaffSession, StaffStatusEnum
from app.modules.staff.security import aware, decode_access_token, now, same

_bearer = HTTPBearer(auto_error=False)


@dataclass
class ClientInfo:
    ip: Optional[str]
    user_agent: Optional[str]


@dataclass
class StaffContext:
    staff: Staff
    session: StaffSession
    permissions: FrozenSet[str] = field(default_factory=frozenset)

    @property
    def id(self) -> str:
        return self.staff.id

    def can(self, permission: str) -> bool:
        return permission in self.permissions


def effective_permissions(staff: Staff) -> FrozenSet[str]:
    if staff.is_super_admin:
        return perms.ALL
    if staff.role is None:
        return frozenset()
    return frozenset(perms.clean(staff.role.permissions))


def verify_gateway(request: Request) -> None:
    """With ADMIN_GATEWAY_SECRET set, only the portal's server (which holds the secret) may call the admin API."""
    expected = settings.ADMIN_GATEWAY_SECRET
    if expected and not same(request.headers.get("x-admin-gateway"), expected):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def client_info(request: Request, _: None = Depends(verify_gateway)) -> ClientInfo:
    ip = request.client.host if request.client else None
    # The portal forwards the browser's address; trusted only when the gateway secret proved who is calling.
    if settings.ADMIN_GATEWAY_SECRET and request.headers.get("x-admin-client-ip"):
        ip = request.headers["x-admin-client-ip"][:64]
    return ClientInfo(ip=ip, user_agent=(request.headers.get("user-agent") or "")[:255] or None)


_unauthorized = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Your session has ended. Please sign in again.",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_staff(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_gateway),
) -> StaffContext:
    if credentials is None:
        raise _unauthorized
    claims = decode_access_token(credentials.credentials)
    if claims is None:
        raise _unauthorized
    session = await db.get(StaffSession, claims["sid"])
    if (session is None or session.staff_id != claims["sub"] or session.revoked_at is not None
            or aware(session.expires_at) <= now()):
        raise _unauthorized
    staff = await db.get(Staff, claims["sub"])
    if staff is None or staff.status != StaffStatusEnum.active:
        raise _unauthorized
    return StaffContext(staff=staff, session=session, permissions=effective_permissions(staff))


def require_permission(*needed: str):
    """Allow the request only if the signed-in staff member holds every one of `needed`."""
    for key in needed:
        if key not in perms.ALL:  # a typo here would silently lock everyone out
            raise ValueError(f"Unknown permission {key!r}")

    async def _dep(ctx: StaffContext = Depends(get_current_staff)) -> StaffContext:
        if not all(ctx.can(p) for p in needed):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this.")
        return ctx
    return _dep


async def require_super_admin(ctx: StaffContext = Depends(get_current_staff)) -> StaffContext:
    if not ctx.staff.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only a super admin can do this.")
    return ctx
