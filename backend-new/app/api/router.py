from fastapi import APIRouter
from app.modules.auth.router import router as auth_router
from app.modules.health.router import router as health_router
from app.modules.users.router import router as users_router
from app.modules.ai_chat.router import router as ai_chat_router
from app.modules.admin.router import router as admin_router
from app.modules.admin.overview import router as admin_overview_router
from app.modules.admin.accounts import router as admin_accounts_router
from app.modules.admin.notifications import router as admin_notifications_router
from app.modules.admin.ops import router as admin_ops_router
from app.modules.admin.community import router as admin_community_router
from app.modules.admin.analytics import router as admin_analytics_router
from app.modules.staff.auth_router import router as staff_auth_router
from app.modules.staff.router import router as staff_router
from app.modules.notifications.router import router as notifications_router
from app.modules.calls.router import router as calls_router
from app.modules.calls.webhook_router import router as webhooks_router
from app.modules.calls.ws_router import router as calls_ws_router
from app.modules.driver_training.router import router as driver_training_router
from app.modules.driver_training.admin_router import router as driver_training_admin_router
from app.modules.rides.router import router as rides_router
from app.modules.community.router import router as community_router
from app.modules.subscriptions.router import router as subscriptions_router
from app.modules.care.router import router as care_router
from app.modules.checkins.router import router as checkins_router
from app.modules.account.router import router as account_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(health_router, prefix="/health", tags=["health"])
api_router.include_router(ai_chat_router, prefix="/ai-chat", tags=["ai-chat"])
api_router.include_router(staff_auth_router, prefix="/admin/auth", tags=["admin-auth"])
api_router.include_router(staff_router, prefix="/admin", tags=["admin-staff"])
api_router.include_router(admin_overview_router, prefix="/admin", tags=["admin"])
api_router.include_router(admin_accounts_router, prefix="/admin", tags=["admin-accounts"])
api_router.include_router(admin_notifications_router, prefix="/admin", tags=["admin-notifications"])
api_router.include_router(admin_ops_router, prefix="/admin", tags=["admin-operations"])
api_router.include_router(admin_community_router, prefix="/admin", tags=["admin-community"])
api_router.include_router(admin_analytics_router, prefix="/admin", tags=["admin-analytics"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
api_router.include_router(calls_router, prefix="/calls", tags=["calls"])
api_router.include_router(calls_ws_router, prefix="/calls", tags=["calls-ws"])
api_router.include_router(webhooks_router, prefix="/livekit", tags=["webhooks"])
api_router.include_router(driver_training_router, prefix="/driver-training", tags=["driver-training"])
api_router.include_router(rides_router, prefix="/rides", tags=["rides"])
api_router.include_router(community_router, prefix="/community", tags=["community"])
api_router.include_router(subscriptions_router, prefix="/subscriptions", tags=["subscriptions"])
api_router.include_router(care_router, prefix="/care", tags=["care"])
api_router.include_router(checkins_router, prefix="/checkins", tags=["checkins"])
api_router.include_router(account_router, prefix="/account", tags=["account"])
api_router.include_router(
    driver_training_admin_router, prefix="/admin/aptitude", tags=["admin-aptitude"]
)
