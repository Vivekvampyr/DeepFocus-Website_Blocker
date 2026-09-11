from datetime import datetime
from pydantic import BaseModel, Field

class BlockEventCreate(BaseModel):
    domain: str = Field(
        min_length=3,
        max_length=255,
    )
    device_id: str | None = None

class BlockEventResponse(BaseModel):
    id: int
    domain: str
    created_at: datetime