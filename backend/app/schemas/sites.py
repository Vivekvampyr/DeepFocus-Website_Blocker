from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class BlockedSiteCreate(BaseModel):
    domain: str = Field(min_length=3, max_length=255)

class BlockedSiteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    domain: str
    created_at: datetime