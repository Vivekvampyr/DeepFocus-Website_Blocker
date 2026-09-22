import os
from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from .database import get_db, Base, engine
from .models.user import User
from .models.device import Device
from .models.blocked_site import BlockedSite
from .models.block_event import BlockEvent
from .models.password_reset_token import PasswordResetToken
from .api import auth
from .api import sites
from .api import sync
from .api import settings
from .api import devices
from .api import admin
from .api import block_events
from .api import admin_analytics

from fastapi.middleware.cors import CORSMiddleware

# Only run table creation when explicitly enabled or in local development;
# never run redundant DDL queries on every cold start in serverless.
auto_create = os.getenv("AUTO_CREATE_TABLES")
should_create = (
    auto_create.lower() in ("true", "1", "yes")
    if auto_create is not None
    else not bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
)

if should_create:
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"[Warning] Base.metadata.create_all: {e}")

app = FastAPI(
    title="DeepFocus API",
    description="Backend API for the DeepFocus browser extension",
    version="2.0.0",
)

app.include_router(auth.router)
app.include_router(sites.router)
app.include_router(sync.router)
app.include_router(settings.router)
app.include_router(devices.router)
app.include_router(admin.router)
app.include_router(block_events.router)
app.include_router(admin_analytics.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # Allows requests from specific domains
    allow_credentials=True,          # Allows cookies and authentication headers
    allow_methods=["*"],             # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],             # Allows all request headers
)

@app.get("/")
def root():
    return {
        "message": "DeepFocus API is running"
    }


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))

    return {
        "status": "ok",
        "database": "connected",
    }

@app.get("/users/count")
def users_count(db: Session = Depends(get_db)):
    count = db.query(User).count()
    return {
        "users": count
    }