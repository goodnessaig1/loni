"""
/admin/staff, /admin/roles, /admin/permissions, /admin/audit-logs: managing the portal's own team.

Guard rails against privilege escalation:
  - super admins are made only by app/scripts/create_super_admin.py, never through the API;
  - only a super admin can change another super admin;
  - nobody can change their own role or status;
  - someone who isn't a super admin can only grant permissions they hold themselves.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.staff import permissions as perms
from app.modules.staff import service
from app.modules.staff.deps import ClientInfo, StaffContext, client_info, require_permission
from app.modules.staff.models import Staff, StaffAuditLog, StaffRole, StaffStatusEnum
from app.modules.staff.schemas import (
    AuditLogOut, InviteStaffRequest, PermissionOut, RoleIn, RoleOut, RoleUpdate, StaffOut, UpdateStaffRequest,
)
from app.utils.generateId import generate_id

router = APIRouter()


def _forbid(detail: str):
    raise HTTPException(status_code=403, detail=detail)


def _check_grantable(ctx: StaffContext, keys: List[str]) -> List[str]:
    unknown = set(keys) - perms.ALL
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown permission: {sorted(unknown)[0]}")
    cleaned = perms.clean(keys)
    if not ctx.staff.is_super_admin and not set(cleaned) <= ctx.permissions:
        _forbid("You can only grant permissions you have yourself.")
    return cleaned


async def _role_or_404(db: AsyncSession, role_id: int) -> StaffRole:
    role = await db.get(StaffRole, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


async def _staff_or_404(db: AsyncSession, staff_id: str) -> Staff:
    staff = await db.get(Staff, staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return staff


def _guard_target(ctx: StaffContext, target: Staff) -> None:
    if target.is_super_admin and not ctx.staff.is_super_admin:
        _forbid("Only a super admin can change a super admin.")


# ── permissions ──────────────────────────────────────────────────────────────────────────────

@router.get("/permissions", response_model=List[PermissionOut])
async def list_permissions(ctx: StaffContext = Depends(require_permission("staff.view"))):
    return [p.__dict__ for p in perms.CATALOGUE]


# ── roles ────────────────────────────────────────────────────────────────────────────────────

async def _role_out(db: AsyncSession, role: StaffRole) -> dict:
    count = (await db.execute(select(func.count()).select_from(Staff).where(Staff.role_id == role.id))).scalar_one()
    return {**RoleOut.model_validate(role).model_dump(), "permissions": perms.clean(role.permissions), "staff_count": count}


@router.get("/roles", response_model=List[RoleOut])
async def list_roles(ctx: StaffContext = Depends(require_permission("staff.view")), db: AsyncSession = Depends(get_db)):
    counts = dict((await db.execute(select(Staff.role_id, func.count()).group_by(Staff.role_id))).all())
    roles = (await db.execute(select(StaffRole).order_by(StaffRole.name))).scalars().all()
    return [{**RoleOut.model_validate(r).model_dump(), "permissions": perms.clean(r.permissions),
             "staff_count": counts.get(r.id, 0)} for r in roles]


@router.post("/roles", response_model=RoleOut, status_code=201)
async def create_role(data: RoleIn, ctx: StaffContext = Depends(require_permission("roles.manage")),
                      db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    role = StaffRole(name=" ".join(data.name.split()), description=data.description,
                     permissions=_check_grantable(ctx, data.permissions))
    db.add(role)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="A role with that name already exists.")
    await service.audit(db, "role.created", ctx.id, client, "role", str(role.id), {"name": role.name, "permissions": role.permissions})
    await db.commit()
    return await _role_out(db, role)


@router.patch("/roles/{role_id}", response_model=RoleOut)
async def update_role(role_id: int, data: RoleUpdate, ctx: StaffContext = Depends(require_permission("roles.manage")),
                      db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    role = await _role_or_404(db, role_id)
    if not ctx.staff.is_super_admin and ctx.staff.role_id == role.id:
        _forbid("You can't edit your own role.")
    changes = {}
    if data.name is not None:
        role.name = " ".join(data.name.split())
        changes["name"] = role.name
    if data.description is not None:
        role.description = data.description
    if data.permissions is not None:
        new = _check_grantable(ctx, data.permissions)
        # A limited admin also can't strip permissions they don't hold (they couldn't add them back).
        removed = set(perms.clean(role.permissions)) - set(new)
        if not ctx.staff.is_super_admin and not removed <= ctx.permissions:
            _forbid("You can only change permissions you have yourself.")
        changes["permissions"] = {"before": perms.clean(role.permissions), "after": new}
        role.permissions = new
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="A role with that name already exists.")
    await service.audit(db, "role.updated", ctx.id, client, "role", str(role.id), changes)
    await db.commit()
    return await _role_out(db, role)


@router.delete("/roles/{role_id}")
async def delete_role(role_id: int, ctx: StaffContext = Depends(require_permission("roles.manage")),
                      db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    role = await _role_or_404(db, role_id)
    in_use = (await db.execute(select(func.count()).select_from(Staff).where(Staff.role_id == role.id))).scalar_one()
    if in_use:
        raise HTTPException(status_code=409, detail="Move the staff on this role to another role first.")
    await db.delete(role)
    await service.audit(db, "role.deleted", ctx.id, client, "role", str(role_id), {"name": role.name})
    await db.commit()
    return {"success": True, "message": "Role deleted"}


# ── staff ────────────────────────────────────────────────────────────────────────────────────

@router.get("/staff", response_model=List[StaffOut])
async def list_staff(status: Optional[StaffStatusEnum] = None, q: Optional[str] = Query(None, max_length=100),
                     ctx: StaffContext = Depends(require_permission("staff.view")), db: AsyncSession = Depends(get_db)):
    query = select(Staff).order_by(Staff.is_super_admin.desc(), Staff.created_at.desc())
    if status:
        query = query.where(Staff.status == status)
    if q:
        like = f"%{q.strip().lower()}%"
        query = query.where(func.lower(Staff.name).like(like) | Staff.email.like(like))
    return (await db.execute(query)).scalars().all()


@router.get("/staff/{staff_id}", response_model=StaffOut)
async def get_staff(staff_id: str, ctx: StaffContext = Depends(require_permission("staff.view")), db: AsyncSession = Depends(get_db)):
    return await _staff_or_404(db, staff_id)


@router.post("/staff", response_model=StaffOut, status_code=201)
async def invite_staff(data: InviteStaffRequest, ctx: StaffContext = Depends(require_permission("staff.manage")),
                       db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    role = await _role_or_404(db, data.role_id)
    _check_grantable(ctx, role.permissions or [])
    email = data.email.strip().lower()
    if await service.find_by_email(db, email):
        raise HTTPException(status_code=409, detail="Someone on the team already uses that email.")
    staff = Staff(id=generate_id(), email=email, name=data.name, status=StaffStatusEnum.invited,
                  role_id=role.id, created_by_id=ctx.id)
    db.add(staff)
    await db.flush()
    await db.refresh(staff, ["role"])
    token = await service.issue_action_token(db, staff, "invite")
    await service.audit(db, "staff.invited", ctx.id, client, "staff", staff.id, {"email": email, "role": role.name})
    await db.commit()
    service.send_invite(staff, ctx.staff, token)
    return staff


@router.patch("/staff/{staff_id}", response_model=StaffOut)
async def update_staff(staff_id: str, data: UpdateStaffRequest, ctx: StaffContext = Depends(require_permission("staff.manage")),
                       db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    target = await _staff_or_404(db, staff_id)
    _guard_target(ctx, target)
    changes = {}
    if data.name is not None:
        target.name = " ".join(data.name.split())
        changes["name"] = target.name
    if data.role_id is not None and data.role_id != target.role_id:
        if target.id == ctx.id:
            _forbid("You can't change your own role.")
        role = await _role_or_404(db, data.role_id)
        _check_grantable(ctx, role.permissions or [])
        changes["role"] = {"before": target.role.name if target.role else None, "after": role.name}
        target.role_id = role.id
    if data.status is not None and data.status != target.status:
        if target.id == ctx.id:
            _forbid("You can't change your own status.")
        if data.status == StaffStatusEnum.invited:
            raise HTTPException(status_code=400, detail="Use 'resend invite' instead.")
        if data.status == StaffStatusEnum.active and not target.password_hash:
            raise HTTPException(status_code=400, detail="This person hasn't accepted their invite yet.")
        changes["status"] = {"before": target.status.value, "after": data.status.value}
        target.status = data.status
        if data.status == StaffStatusEnum.suspended:
            await service.revoke_all_sessions(db, target.id, "suspended")
    await db.flush()
    await db.refresh(target, ["role"])
    if changes:
        await service.audit(db, "staff.updated", ctx.id, client, "staff", target.id, changes)
    await db.commit()
    return target


@router.post("/staff/{staff_id}/resend-invite")
async def resend_invite(staff_id: str, ctx: StaffContext = Depends(require_permission("staff.manage")),
                        db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    target = await _staff_or_404(db, staff_id)
    if target.status != StaffStatusEnum.invited:
        raise HTTPException(status_code=400, detail="This person has already accepted their invite.")
    token = await service.issue_action_token(db, target, "invite")
    await service.audit(db, "staff.invite_resent", ctx.id, client, "staff", target.id)
    await db.commit()
    service.send_invite(target, ctx.staff, token)
    return {"success": True, "message": "Invite sent again"}


@router.post("/staff/{staff_id}/revoke-sessions")
async def revoke_sessions(staff_id: str, ctx: StaffContext = Depends(require_permission("staff.manage")),
                          db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    target = await _staff_or_404(db, staff_id)
    _guard_target(ctx, target)
    await service.revoke_all_sessions(db, target.id, "revoked_by_admin", keep=ctx.session.id if target.id == ctx.id else None)
    await service.audit(db, "staff.sessions_revoked", ctx.id, client, "staff", target.id)
    await db.commit()
    return {"success": True, "message": "Signed out everywhere"}


@router.post("/staff/{staff_id}/reset-mfa")
async def reset_mfa(staff_id: str, ctx: StaffContext = Depends(require_permission("staff.manage")),
                    db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    """For someone who lost their phone: turns the authenticator app off, so codes go to their email again."""
    if not ctx.staff.is_super_admin:
        _forbid("Only a super admin can reset two-step verification.")
    target = await _staff_or_404(db, staff_id)
    if target.id == ctx.id:
        _forbid("Turn your own authenticator app off from Account security.")
    target.totp_enabled = False
    target.totp_secret_enc = None
    target.totp_pending_secret_enc = None
    target.totp_last_counter = None
    await service.revoke_all_sessions(db, target.id, "mfa_reset")
    await service.audit(db, "staff.mfa_reset", ctx.id, client, "staff", target.id)
    await db.commit()
    return {"success": True, "message": "Two-step verification reset. Codes will be emailed to them."}


# ── audit log ────────────────────────────────────────────────────────────────────────────────

@router.get("/audit-logs", response_model=List[AuditLogOut])
async def audit_logs(limit: int = Query(50, ge=1, le=200), before_id: Optional[int] = None,
                     staff_id: Optional[str] = None, action: Optional[str] = Query(None, max_length=60),
                     ctx: StaffContext = Depends(require_permission("audit.view")), db: AsyncSession = Depends(get_db)):
    query = (select(StaffAuditLog, Staff.name).outerjoin(Staff, Staff.id == StaffAuditLog.staff_id)
             .order_by(StaffAuditLog.id.desc()).limit(limit))
    if before_id:
        query = query.where(StaffAuditLog.id < before_id)
    if staff_id:
        query = query.where(StaffAuditLog.staff_id == staff_id)
    if action:
        query = query.where(StaffAuditLog.action.like(f"{action}%"))
    rows = (await db.execute(query)).all()
    return [{**AuditLogOut.model_validate(log).model_dump(), "staff_name": name} for log, name in rows]
