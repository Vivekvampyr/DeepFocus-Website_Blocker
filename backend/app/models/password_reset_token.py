from sqlalchemy import Column, Integer, ForeignKey, String, DateTime, Boolean
from datetime import datetime
from app.database import Base

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    token = Column(String(255), unique=True, nullable=False)

    expires_at = Column(DateTime, nullable=False)

    used = Column(Boolean, default=False)

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )