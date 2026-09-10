from passlib.context import CryptContext
from sqlalchemy.orm import Session

from ..models.user import User

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    return pwd_context.verify(
        plain_password,
        hashed_password,
    )


def get_user_by_email(
    db: Session,
    email: str,
) -> User | None:
    return (
        db.query(User)
        .filter(User.email == email.lower())
        .first()
    )


def create_user(
    db: Session,
    email: str,
    password: str,
) -> User:
    user = User(
        email=email.lower(),
        password_hash=get_password_hash(password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user