from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from .database import get_db, Base, engine
from .models.user import User
from .models.device import Device
from .models.blocked_site import BlockedSite
from .api import auth
from .api import sites
from .api import sync
from .api import settings
from .api import devices

Base.metadata.create_all(bind=engine)

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