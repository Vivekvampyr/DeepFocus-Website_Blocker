from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.blocked_site import BlockedSite
from ..models.device import Device
from ..models.user import User
from .admin_dependencies import require_admin

router = APIRouter(prefix="/api/admin", tags=["Admin"])

@router.get("/dashboard")
def get_dashboard(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    total_users = db.query(User).count()

    active_users = (
        db.query(User)
        .filter(User.is_active.is_(True))
        .count()
    )

    total_devices = db.query(Device).count()

    total_blocked_sites = (
        db.query(BlockedSite).count()
    )

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_devices": total_devices,
        "total_blocked_sites": total_blocked_sites,
    }

@router.get("/users")
def get_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .order_by(User.created_at.desc())
        .all()
    )

    return [
        {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "blocking_enabled": user.blocking_enabled,
            "sync_version": user.sync_version,
            "created_at": user.created_at,
        }
        for user in users
    ]

@router.get("/users/{user_id}")
def get_user_details(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)

    if not user:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    devices = (
        db.query(Device)
        .filter(Device.user_id == user.id)
        .order_by(Device.last_seen.desc())
        .all()
    )

    blocked_sites = (
        db.query(BlockedSite)
        .filter(BlockedSite.user_id == user.id)
        .order_by(BlockedSite.domain.asc())
        .all()
    )

    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "blocking_enabled": user.blocking_enabled,
            "sync_version": user.sync_version,
            "created_at": user.created_at,
        },
        "devices": [
            {
                "id": device.id,
                "device_id": device.device_id,
                "browser": device.browser,
                "operating_system": device.operating_system,
                "extension_version": device.extension_version,
                "created_at": device.created_at,
                "last_seen": device.last_seen,
            }
            for device in devices
        ],
        "blocked_sites": [
            {
                "id": site.id,
                "domain": site.domain,
                "created_at": site.created_at,
                "updated_at": site.updated_at,
            }
            for site in blocked_sites
        ],
    }