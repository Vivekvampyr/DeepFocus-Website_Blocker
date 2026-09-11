from datetime import datetime
from pydantic import BaseModel

class SyncSite(BaseModel):
    id: int
    domain: str
    created_at: datetime
    updated_at: datetime

class SyncResponse(BaseModel):
    blocked_sites: list[SyncSite]
    is_active: bool