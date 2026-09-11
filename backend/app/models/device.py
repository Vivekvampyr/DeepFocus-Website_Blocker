from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base

class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    device_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    browser: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    operating_system: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    extension_version: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )