from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.blocked_site import BlockedSite
from ..models.user import User
from ..schemas.sites import (BlockedSiteCreate, BlockedSiteResponse)
from .dependencies import get_current_user

router = APIRouter(
    prefix="/api/sites",
    tags=["Blocked Sites"],
)

def normalize_domain(domain: str) -> str:
    domain = domain.strip().lower()

    if domain.startswith("http://"):
        domain = domain[7:]

    elif domain.startswith("https://"):
        domain = domain[8:]

    if domain.startswith("www."):
        domain = domain[4:]

    domain = domain.split("/", 1)[0]
    domain = domain.split("?", 1)[0]

    return domain


@router.get(
    "",
    response_model=list[BlockedSiteResponse],
)
def get_blocked_sites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(BlockedSite)
        .filter(BlockedSite.user_id == current_user.id)
        .order_by(BlockedSite.domain.asc())
        .all()
    )


@router.post(
    "",
    response_model=BlockedSiteResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_blocked_site(
    data: BlockedSiteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    domain = normalize_domain(data.domain)

    existing = (
        db.query(BlockedSite)
        .filter(
            BlockedSite.user_id == current_user.id,
            BlockedSite.domain == domain,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This site is already blocked.",
        )

    site = BlockedSite(
        user_id=current_user.id,
        domain=domain,
    )

    db.add(site)
    current_user.sync_version += 1
    db.commit()
    db.refresh(site)

    return site


@router.delete("/domain/{domain:path}")
def delete_blocked_site_by_domain(
    domain: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    normalized = normalize_domain(domain)

    site = (
        db.query(BlockedSite)
        .filter(
            BlockedSite.domain == normalized,
            BlockedSite.user_id == current_user.id,
        )
        .first()
    )

    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blocked site not found.",
        )

    db.delete(site)
    current_user.sync_version += 1
    db.commit()

    return {
        "message": "Blocked site removed.",
        "domain": normalized,
    }


@router.delete("/{site_id}")
def delete_blocked_site(
    site_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    site = (
        db.query(BlockedSite)
        .filter(
            BlockedSite.id == site_id,
            BlockedSite.user_id == current_user.id,
        )
        .first()
    )

    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blocked site not found.",
        )

    db.delete(site)
    current_user.sync_version += 1
    db.commit()

    return {
        "message": "Blocked site removed."
    }
