from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.block_event import BlockEvent
from ..models.device import Device
from ..models.user import User
from .admin_dependencies import require_admin

router = APIRouter(
    prefix="/api/admin/analytics",
    tags=["Admin Analytics"],
)


def today_start_utc():
    now = datetime.now(timezone.utc)

    return now.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )


@router.get("/overview")
def get_analytics_overview(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    today_start = today_start_utc()

    total_block_attempts = (
        db.query(BlockEvent).count()
    )

    today_attempts = (
        db.query(BlockEvent)
        .filter(
            BlockEvent.created_at >= today_start
        )
        .count()
    )

    return {
        "total_block_attempts":
            total_block_attempts,
        "today_block_attempts":
            today_attempts,
    }


@router.get("/most-blocked")
def get_most_blocked_sites(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            BlockEvent.domain,
            func.count(BlockEvent.id).label("attempts"),
        )
        .group_by(BlockEvent.domain)
        .order_by(
            func.count(BlockEvent.id).desc()
        )
        .limit(10)
        .all()
    )

    return [
        {
            "domain": domain,
            "attempts": attempts,
        }
        for domain, attempts in rows
    ]


@router.get("/by-user")
def get_attempts_by_user(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            User.id,
            User.email,
            func.count(BlockEvent.id).label(
                "attempts"
            ),
        )
        .outerjoin(
            BlockEvent,
            BlockEvent.user_id == User.id,
        )
        .group_by(
            User.id,
            User.email,
        )
        .order_by(
            func.count(BlockEvent.id).desc()
        )
        .limit(50)
        .all()
    )

    return [
        {
            "user_id": user_id,
            "email": email,
            "attempts": attempts,
        }
        for user_id, email, attempts in rows
    ]


@router.get("/by-device")
def get_attempts_by_device(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            Device.id,
            Device.browser,
            Device.operating_system,
            User.email,
            func.count(BlockEvent.id).label(
                "attempts"
            ),
        )
        .join(
            User,
            User.id == Device.user_id,
        )
        .outerjoin(
            BlockEvent,
            BlockEvent.device_id == Device.id,
        )
        .group_by(
            Device.id,
            Device.browser,
            Device.operating_system,
            User.email,
        )
        .order_by(
            func.count(BlockEvent.id).desc()
        )
        .limit(50)
        .all()
    )

    return [
        {
            "device_id": device_id,
            "browser": browser,
            "operating_system":
                operating_system,
            "email": email,
            "attempts": attempts,
        }
        for (
            device_id,
            browser,
            operating_system,
            email,
            attempts,
        ) in rows
    ]