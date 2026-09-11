from datetime import datetime
from pydantic import BaseModel

class UserStatusUpdate(BaseModel):
    is_active: bool

class AdminUserSummary(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool
    blocking_enabled: bool
    sync_version: int
    created_at: datetime