from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.blocked_site import BlockedSite
from ..models.user import User
from ..schemas.sync import SyncResponse, SyncSite
from .dependencies import get_current_user

router = APIRouter(prefix="/api/sync", tags=["Sync"])

@router.get("", response_model=SyncResponse)
def get_sync_state(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sites = (
        db.query(BlockedSite)
        .filter(BlockedSite.user_id == current_user.id)
        .order_by(BlockedSite.domain.asc())
        .all()
    )

    return SyncResponse(
        blocked_sites=[
            SyncSite(
                id=site.id,
                domain=site.domain,
                created_at=site.created_at,
                updated_at=site.updated_at,
            )
            for site in sites
        ],
        # We'll add server-side is_active storage shortly.
        # For now preserve the existing extension behavior.
        is_active=True,
    )