from fastapi import APIRouter
from app.modules.auth.router import router as auth_router
from app.modules.health.router import router as health_router
from app.modules.users.router import router as users_router
from app.modules.ai_chat.router import router as ai_chat_router
from app.modules.admin.router import router as admin_router
from app.modules.notifications.router import router as notifications_router
from app.modules.calls.router import router as calls_router
from app.modules.calls.webhook_router import router as webhooks_router
from app.modules.calls.ws_router import router as calls_ws_router
from app.modules.driver_training.router import router as driver_training_router
from app.modules.driver_training.admin_router import router as driver_training_admin_router
from app.modules.rides.router import router as rides_router
from app.modules.community.router import router as community_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(health_router, prefix="/health", tags=["health"])
api_router.include_router(ai_chat_router, prefix="/ai-chat", tags=["ai-chat"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
api_router.include_router(calls_router, prefix="/calls", tags=["calls"])
api_router.include_router(calls_ws_router, prefix="/calls", tags=["calls-ws"])
api_router.include_router(webhooks_router, prefix="/livekit", tags=["webhooks"])
api_router.include_router(driver_training_router, prefix="/driver-training", tags=["driver-training"])
api_router.include_router(rides_router, prefix="/rides", tags=["rides"])
api_router.include_router(community_router, prefix="/community", tags=["community"])
api_router.include_router(
    driver_training_admin_router, prefix="/admin/aptitude", tags=["admin-aptitude"]
)
