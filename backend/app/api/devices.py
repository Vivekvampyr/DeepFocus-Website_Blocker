from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.device import Device
from ..models.user import User
from ..schemas.devices import (DeviceRegisterRequest, DeviceResponse)
from .dependencies import get_current_user

router = APIRouter(
    prefix="/api/devices",
    tags=["Devices"],
)

@router.post(
    "/register",
    response_model=DeviceResponse,
)

def register_device(
    data: DeviceRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    device = (
        db.query(Device)
        .filter(
            Device.user_id == current_user.id,
            Device.device_id == data.device_id,
        )
        .first()
    )

    if device and device.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This device has been revoked.",
        )

    now = datetime.now(timezone.utc)

    if device:
        device.browser = data.browser
        device.operating_system = data.operating_system
        device.extension_version = data.extension_version
        device.last_seen = now
    else:
        device = Device(
            user_id=current_user.id,
            device_id=data.device_id,
            browser=data.browser,
            operating_system=data.operating_system,
            extension_version=data.extension_version,
            last_seen=now,
        )

        db.add(device)

    db.commit()
    db.refresh(device)
    return device

@router.get(
    "",
    response_model=list[DeviceResponse],
)
def get_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Device)
        .filter(Device.user_id == current_user.id)
        .order_by(Device.last_seen.desc())
        .all()
    )