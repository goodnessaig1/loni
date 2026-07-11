from fastapi import APIRouter, Depends, HTTPException, status
from app.modules.notifications.schemas import DeviceCreate, DeviceResponse, PushNotificationTest, DeviceListResponse, DeviceInfo
from app.modules.notifications.service import NotificationService
from app.api.deps import get_current_user
from app.modules.users.models import User

router = APIRouter()

@router.post("/devices", response_model=DeviceResponse)
async def register_device(
    device_in: DeviceCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Register a user's device for push notifications.
    """
    user_id = str(current_user.id)
    await NotificationService.register_device(
        user_id=user_id,
        device_id=device_in.device_id,
        device_type=device_in.device_type,
        token=device_in.token
    )
    
    return DeviceResponse(success=True, message="Device registered successfully")

@router.post("/test", response_model=DeviceResponse)
async def test_push_notification(
    payload: PushNotificationTest,
    current_user: User = Depends(get_current_user)
):
    """
    Test sending a push notification to all devices registered by the authenticated user.
    """
    user_id = str(current_user.id)
    await NotificationService.notify_user(
        user_id=user_id,
        title=payload.title,
        body=payload.body,
        data=payload.data
    )
    
    return DeviceResponse(success=True, message="Test push notification dispatched")

@router.get("/devices", response_model=DeviceListResponse)
async def get_my_devices(current_user: User = Depends(get_current_user)):
    """
    Get all registered devices for the current authenticated user.
    """
    user_id = str(current_user.id)
    devices = await NotificationService.get_user_devices(user_id)
    
    device_list = [
        DeviceInfo(
            device_id=d.get("device_id", ""),
            device_type=d.get("device_type", ""),
            created_at=d.get("created_at"),
            updated_at=d.get("updated_at")
        )
        for d in devices
    ]
    
    return DeviceListResponse(success=True, devices=device_list)
