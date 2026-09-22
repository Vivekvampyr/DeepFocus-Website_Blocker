import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool, QueuePool

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set in .env")

# Common connect arguments for PostgreSQL
connect_args = {
    "sslmode": "require",
    "connect_timeout": 10,
}

# In serverless environments (e.g., Vercel, AWS Lambda), each function container is ephemeral.
# Maintaining persistent connection pools across serverless instances causes connection exhaustion on Supabase/PgBouncer.
# NullPool ensures connections are opened only when requested and closed immediately when the session ends.
is_serverless = bool(
    os.getenv("VERCEL")
    or os.getenv("AWS_LAMBDA_FUNCTION_NAME")
    or os.getenv("DB_POOL_TYPE", "").lower() == "nullpool"
)

if is_serverless:
    engine = create_engine(
        DATABASE_URL,
        poolclass=NullPool,
        connect_args=connect_args,
    )
else:
    # For local development or persistent servers (e.g., Uvicorn):
    # Use QueuePool with healthy pooling parameters to handle concurrent requests smoothly
    # without running into "QueuePool limit reached" or holding excess idle connections.
    pool_size = int(os.getenv("DB_POOL_SIZE", "5"))
    max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "10"))
    pool_timeout = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    pool_recycle = int(os.getenv("DB_POOL_RECYCLE", "300"))

    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_pre_ping=True,
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_timeout=pool_timeout,
        pool_recycle=pool_recycle,
        connect_args=connect_args,
    )

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()