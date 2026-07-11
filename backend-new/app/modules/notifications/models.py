from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class DeviceDB(BaseModel):
    user_id: str
    device_id: str
    device_type: str
    token: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
