from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..schemas.settings import (BlockingSettingsResponse, BlockingSettingsUpdate)
from .dependencies import get_current_user

router = APIRouter(
    prefix="/api/settings",
    tags=["Settings"],
)

@router.get(
    "/blocking",
    response_model=BlockingSettingsResponse,
)
def get_blocking_settings(
    current_user: User = Depends(get_current_user),
):
    return {
        "blocking_enabled": current_user.blocking_enabled,
    }


@router.patch(
    "/blocking",
    response_model=BlockingSettingsResponse,
)
def update_blocking_settings(
    data: BlockingSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.blocking_enabled = data.blocking_enabled
    current_user.sync_version += 1
    db.commit()
    db.refresh(current_user)

    return {
        "blocking_enabled": current_user.blocking_enabled,
    }