import os
import secrets
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from jose import jwt
from ..api.dependencies import get_current_user

from ..database import get_db
from ..schemas.auth import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
)
from ..schemas.password_reset_tokens import ForgotPasswordRequest, ResetPasswordRequest
from ..services.auth_service import (
    create_user,
    get_password_hash,
    get_user_by_email,
    verify_password,
)
from ..models.password_reset_token import PasswordResetToken
from ..services.email_service import send_password_reset_email
from ..models.user import User

load_dotenv()

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60")
)
FRONTEND_URL = os.getenv("FRONTEND_URL")


def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    existing_user = get_user_by_email(db, data.email)

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = create_user(
        db=db,
        email=data.email,
        password=data.password,
    )

    return {
        "id": user.id,
        "email": user.email,
    }


@router.post(
    "/login",
    response_model=LoginResponse,
)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    user = get_user_by_email(db, data.email)

    if not user or not verify_password(
        data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is inactive.",
        )

    access_token = create_access_token(user.id, user.role)

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }

@router.post("/forgot-password")
def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    user = get_user_by_email(db, data.email)

    # Always return the same response whether the
    # account exists or not.
    if not user:
        return {
            "message": (
                "If an account exists, a password reset "
                "link has been sent."
            )
        }

    # Invalidate any previous unused reset tokens
    # for this user.
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used.is_(False),
    ).update(
        {
            PasswordResetToken.used: True,
        },
        synchronize_session=False,
    )

    token = secrets.token_urlsafe(48)

    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(hours=1),
    )

    db.add(reset_token)
    db.commit()

    if not FRONTEND_URL:
        raise HTTPException(
            status_code=500,
            detail="Password reset is not configured.",
        )

    reset_url = (
        f"{FRONTEND_URL.rstrip('/')}"
        f"/reset-password#token={token}"
    )

    try:
        send_password_reset_email(
            email=user.email,
            reset_url=reset_url,
        )
    except Exception as error:
        # Do not reveal email delivery failures
        # or account existence to the client.
        print(
            "[DeepFocus] Failed to send password reset email:"
        )
        print(f"Type: {type(error).__name__}")
        print(f"Error: {error!r}")

    return {
        "message": (
            "If an account exists, a password reset "
            "link has been sent."
        )
    }

@router.post("/reset-password")
def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    reset_token = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token == data.token,
            PasswordResetToken.used.is_(False),
        )
        .first()
    )

    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset link.",
        )

    if reset_token.expires_at < datetime.utcnow():
        reset_token.used = True
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset link.",
        )

    user = db.get(User, reset_token.user_id)

    if not user:
        reset_token.used = True
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset link.",
        )

    user.password_hash = get_password_hash(data.new_password)

    # Mark this token as consumed.
    reset_token.used = True

    # Invalidate every other unused reset token
    # belonging to this account.
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.id != reset_token.id,
        PasswordResetToken.used.is_(False),
    ).update(
        {
            PasswordResetToken.used: True,
        },
        synchronize_session=False,
    )

    db.commit()

    return {
        "message": "Password reset successfully.",
    }



@router.get("/me")
def get_me(
    current_user=Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
    }