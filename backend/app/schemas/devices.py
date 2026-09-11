from datetime import datetime
from pydantic import BaseModel

class DeviceRegisterRequest(BaseModel):
    device_id: str
    browser: str
    operating_system: str
    extension_version: str

class DeviceResponse(BaseModel):
    id: int
    device_id: str
    browser: str
    operating_system: str
    extension_version: str
    created_at: datetime
    last_seen: datetime