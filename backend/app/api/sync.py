from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.blocked_site import BlockedSite
from ..models.user import User
from ..schemas.sync import (SyncRequest, SyncResponse, SyncSite)
from .dependencies import get_current_user

router = APIRouter(
    prefix="/api/sync",
    tags=["Sync"],
)

def build_sync_response(
    user: User,
    sites: list[BlockedSite],
) -> SyncResponse:
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
        blocking_enabled=user.blocking_enabled,
        sync_version=user.sync_version,
    )

@router.get(
    "",
    response_model=SyncResponse,
)
def get_sync_state(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sites = (
        db.query(BlockedSite)
        .filter(
            BlockedSite.user_id == current_user.id
        )
        .order_by(BlockedSite.domain.asc())
        .all()
    )

    return build_sync_response(
        current_user,
        sites,
    )


@router.post(
    "",
    response_model=SyncResponse,
)
def sync_state(
    data: SyncRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Reject stale clients.
    if data.sync_version != current_user.sync_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Sync conflict. Local state is outdated.",
                "server_sync_version": current_user.sync_version,
            },
        )

    normalized_domains = sorted(
        {
            domain.strip().lower()
            for domain in data.blocked_sites
            if domain.strip()
        }
    )

    existing_sites = (
        db.query(BlockedSite)
        .filter(
            BlockedSite.user_id == current_user.id
        )
        .all()
    )

    existing_by_domain = {
        site.domain: site
        for site in existing_sites
    }

    incoming_domains = set(normalized_domains)

    for domain in normalized_domains:
        if domain not in existing_by_domain:
            db.add(
                BlockedSite(
                    user_id=current_user.id,
                    domain=domain,
                )
            )

    for site in existing_sites:
        if site.domain not in incoming_domains:
            db.delete(site)

    current_user.blocking_enabled = data.blocking_enabled

    # One successful account-wide change = one new version.
    current_user.sync_version += 1

    db.commit()

    final_sites = (
        db.query(BlockedSite)
        .filter(
            BlockedSite.user_id == current_user.id
        )
        .order_by(BlockedSite.domain.asc())
        .all()
    )

    return build_sync_response(
        current_user,
        final_sites,
    )