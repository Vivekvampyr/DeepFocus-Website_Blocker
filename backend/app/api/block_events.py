from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.block_event import BlockEvent
from ..models.device import Device
from ..models.user import User
from ..schemas.block_events import (BlockEventCreate, BlockEventResponse)
from .dependencies import get_current_user

router = APIRouter(
    prefix="/api/block-events",
    tags=["Block Events"],
)

@router.post(
    "",
    response_model=BlockEventResponse,
    status_code=201,
)
def create_block_event(
    data: BlockEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    device = None

    if data.device_id:
        device = (
            db.query(Device)
            .filter(
                Device.user_id == current_user.id,
                Device.device_id == data.device_id,
            )
            .first()
        )

        # Unknown device_id should not be associated
        # with another user's device.
        if not device:
            device = None

    domain = data.domain.strip().lower()

    event = BlockEvent(
        user_id=current_user.id,
        device_id=device.id if device else None,
        domain=domain,
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return event