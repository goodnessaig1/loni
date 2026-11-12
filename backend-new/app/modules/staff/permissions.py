"""
The permission catalogue for the admin portal.

Permissions are code (an endpoint checks for one by name); roles are data (a super admin groups
permissions into roles in the portal). Adding a permission = add it here and check it on the endpoint.
Super admins hold every permission implicitly and are the only accounts that can't be created from the API.
"""
from dataclasses import dataclass
from typing import Dict, FrozenSet, List


@dataclass(frozen=True)
class Permission:
    key: str
    group: str
    label: str
    description: str


CATALOGUE: List[Permission] = [
    Permission("dashboard.view", "General", "View overview", "See the operations overview and its numbers."),
    Permission("users.view", "Users", "View users", "See mothers, partners and their accounts."),
    Permission("users.manage", "Users", "Manage users", "Suspend or reactivate user accounts."),
    Permission("nurses.view", "Nurses", "View nurses", "See nurse profiles and applications."),
    Permission("nurses.manage", "Nurses", "Approve nurses", "Approve, reject or suspend nurses."),
    Permission("drivers.view", "Drivers", "View drivers", "See driver profiles and applications."),
    Permission("drivers.manage", "Drivers", "Approve drivers", "Approve, reject or suspend drivers."),
    Permission("aptitude.manage", "Drivers", "Manage aptitude test", "Edit the driver aptitude question bank."),
    Permission("kyc.review", "Verification", "Review KYC", "Open identity and credential documents."),
    Permission("rides.view", "Operations", "View rides", "See emergency rides, live and past."),
    Permission("calls.view", "Operations", "View nurse calls", "See nurse call history and ratings."),
    Permission("payments.view", "Finance", "View payments", "See payments, payouts and subscriptions."),
    Permission("payments.manage", "Finance", "Manage payouts", "Retry or adjust payouts."),
    Permission("community.moderate", "Community", "Moderate community", "Hide posts and comments."),
    Permission("support.manage", "Support", "Handle support", "Read and answer support messages and incidents."),
    Permission("ai_safety.review", "Safety", "Review AI safety events", "Read flagged Loni AI conversations."),
    Permission("checkins.manage", "Safety", "Run check-ins", "Preview and trigger proactive check-ins."),
    Permission("analytics.view", "Analytics", "View analytics", "See platform analytics and revenue."),
    Permission("reports.export", "Analytics", "Export reports", "Download data exports."),
    Permission("audit.view", "System", "View audit log", "See who did what in the admin portal."),
    Permission("settings.manage", "System", "Manage settings", "Change platform settings."),
    Permission("staff.view", "Staff", "View staff", "See staff accounts and roles."),
    Permission("staff.manage", "Staff", "Manage staff", "Invite, suspend and change the role of staff."),
    Permission("roles.manage", "Staff", "Manage roles", "Create and edit roles and their permissions."),
]

BY_KEY: Dict[str, Permission] = {p.key: p for p in CATALOGUE}
ALL: FrozenSet[str] = frozenset(BY_KEY)

# Starting roles created by the super-admin bootstrap script; editable afterwards.
DEFAULT_ROLES = {
    "Operations Manager": (
        "Runs day-to-day operations: approvals, rides, calls and support.",
        ["dashboard.view", "users.view", "users.manage", "nurses.view", "nurses.manage", "drivers.view",
         "drivers.manage", "kyc.review", "rides.view", "calls.view", "community.moderate", "support.manage",
         "analytics.view", "staff.view"],
    ),
    "Verification Officer": (
        "Reviews nurse and driver applications and documents.",
        ["dashboard.view", "nurses.view", "nurses.manage", "drivers.view", "drivers.manage", "kyc.review"],
    ),
    "Support Agent": (
        "Answers support messages and watches rides and calls.",
        ["dashboard.view", "users.view", "rides.view", "calls.view", "support.manage"],
    ),
    "Analyst": (
        "Read-only access to numbers and exports.",
        ["dashboard.view", "analytics.view", "reports.export"],
    ),
}


def clean(keys) -> List[str]:
    """Known permissions only, de-duplicated, in catalogue order."""
    wanted = set(keys or [])
    return [p.key for p in CATALOGUE if p.key in wanted]
