from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.blocked_site import BlockedSite
from ..models.device import Device
from ..models.user import User
from .admin_dependencies import require_admin
from ..schemas.admin import UserStatusUpdate
from sqlalchemy import func

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

@router.get("/users/search")
def search_users(
    q: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    search_term = q.strip().lower()

    if not search_term:
        return []

    users = (
        db.query(User)
        .filter(
            func.lower(User.email).contains(search_term)
        )
        .order_by(User.created_at.desc())
        .limit(50)
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
                "is_revoked": device.is_revoked,
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

@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    data: UserStatusUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    # Prevent an admin from accidentally disabling their own account.
    if user.id == admin.id and not data.is_active:
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own admin account.",
        )

    user.is_active = data.is_active

    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "email": user.email,
        "is_active": user.is_active,
    }

@router.get("/users/{user_id}/devices")
def get_user_devices(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    devices = (
        db.query(Device)
        .filter(Device.user_id == user_id)
        .order_by(Device.last_seen.desc())
        .all()
    )

    return [
        {
            "id": device.id,
            "device_id": device.device_id,
            "browser": device.browser,
            "operating_system": device.operating_system,
            "extension_version": device.extension_version,
            "is_revoked": device.is_revoked,
            "created_at": device.created_at,
            "last_seen": device.last_seen,
        }
        for device in devices
    ]

@router.get("/users/{user_id}/sites")
def get_user_sites(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    sites = (
        db.query(BlockedSite)
        .filter(BlockedSite.user_id == user_id)
        .order_by(BlockedSite.domain.asc())
        .all()
    )

    return [
        {
            "id": site.id,
            "domain": site.domain,
            "created_at": site.created_at,
            "updated_at": site.updated_at,
        }
        for site in sites
    ]

@router.delete("/users/{user_id}/sites/{site_id}")
def remove_user_blocked_site(
    user_id: int,
    site_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    site = (
        db.query(BlockedSite)
        .filter(
            BlockedSite.id == site_id,
            BlockedSite.user_id == user_id,
        )
        .first()
    )

    if not site:
        raise HTTPException(
            status_code=404,
            detail="Blocked site not found.",
        )

    domain = site.domain

    db.delete(site)

    # This is an account-wide change.
    # Other logged-in devices will detect the new version
    # during their next sync.
    user.sync_version += 1

    db.commit()

    return {
        "message": "Blocked site removed.",
        "domain": domain,
        "sync_version": user.sync_version,
    }

@router.delete("/users/{user_id}/devices/{device_id}")
def revoke_user_device(
    user_id: int,
    device_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    device = (
        db.query(Device)
        .filter(
            Device.id == device_id,
            Device.user_id == user_id,
        )
        .first()
    )

    if not device:
        raise HTTPException(
            status_code=404,
            detail="Device not found.",
        )

    device.is_revoked = True
    user.sync_version += 1
    db.commit()

    return {
        "message": "Device revoked.",
        "device_id": device_id,
        "is_revoked": True,
    }