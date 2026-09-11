from datetime import datetime
from pydantic import BaseModel

class SyncSite(BaseModel):
    id: int
    domain: str
    created_at: datetime
    updated_at: datetime

class SyncResponse(BaseModel):
    blocked_sites: list[SyncSite]
    blocking_enabled: bool
    sync_version: int

class SyncRequest(BaseModel):
    blocked_sites: list[str]
    blocking_enabled: bool
    sync_version: int