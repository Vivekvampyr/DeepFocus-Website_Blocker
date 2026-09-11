from pydantic import BaseModel

class BlockingSettingsUpdate(BaseModel):
    blocking_enabled: bool

class BlockingSettingsResponse(BaseModel):
    blocking_enabled: bool