from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

class DeviceCreate(BaseModel):
    device_id: str
    device_type: str
    token: str

class DeviceUnregister(BaseModel):
    # the FCM/APNs token, plus the iOS VoIP token when the app has one
    tokens: List[str]

class DeviceResponse(BaseModel):
    success: bool
    message: str

class PushNotificationTest(BaseModel):
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None

class DeviceInfo(BaseModel):
    device_id: str
    device_type: str
    created_at: datetime
    updated_at: datetime

class DeviceListResponse(BaseModel):
    success: bool
    devices: List[DeviceInfo]
