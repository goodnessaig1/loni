"""
Create (or promote) an admin-portal super admin, and the starting staff roles.

The ONLY way to make a super admin: the API can't, so a stolen staff session can never create one.

    cd backend-new && source venv/bin/activate
    python app/scripts/create_super_admin.py --email you@lonimum.com --name "Your Name"
    # password is asked for (hidden), or read from SUPER_ADMIN_PASSWORD

Sign-in still needs the emailed code (printed to the server console when BREVO_API_KEY is unset).
"""
import argparse
import asyncio
import getpass
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(ROOT)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(ROOT, ".env"))

from sqlalchemy import select  # noqa: E402

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.modules.staff import permissions as perms  # noqa: E402
from app.modules.staff.models import Staff, StaffAuditLog, StaffRole, StaffStatusEnum  # noqa: E402
from app.modules.staff.security import now, password_problem  # noqa: E402
from app.utils.generateId import generate_id  # noqa: E402


async def ensure_default_roles(db) -> None:
    existing = set((await db.execute(select(StaffRole.name))).scalars().all())
    for name, (description, keys) in perms.DEFAULT_ROLES.items():
        if name not in existing:
            db.add(StaffRole(name=name, description=description, permissions=perms.clean(keys)))
            print(f"  + role {name}")


async def main(email: str, name: str, password: str) -> None:
    email = email.strip().lower()
    async with AsyncSessionLocal() as db:
        await ensure_default_roles(db)
        staff = (await db.execute(select(Staff).where(Staff.email == email))).scalar_one_or_none()
        if staff is None:
            staff = Staff(id=generate_id(), email=email, name=name)
            db.add(staff)
            action = "created"
        else:
            action = "promoted"
        staff.name = name or staff.name
        staff.password_hash = get_password_hash(password)
        staff.password_changed_at = now()
        staff.status = StaffStatusEnum.active
        staff.is_super_admin = True
        staff.failed_login_count = 0
        staff.locked_until = None
        db.add(StaffAuditLog(staff_id=None, action=f"super_admin.{action}", target_type="staff", target_id=staff.id,
                             details={"email": email, "via": "cli"}))
        await db.commit()
        print(f"Super admin {action}: {name} <{email}>")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", default=os.getenv("SUPER_ADMIN_EMAIL"))
    parser.add_argument("--name", default=os.getenv("SUPER_ADMIN_NAME", "LONI Super Admin"))
    args = parser.parse_args()
    if not args.email:
        sys.exit("Pass --email or set SUPER_ADMIN_EMAIL.")
    password = os.getenv("SUPER_ADMIN_PASSWORD") or getpass.getpass("Password (12+ chars, upper, lower, number): ")
    problem = password_problem(password, args.email)
    if problem:
        sys.exit(problem)
    asyncio.run(main(args.email, args.name, password))
