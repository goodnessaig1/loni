import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router
from app.core import mongo_db
from app.core.migrations import run_migrations
from motor.motor_asyncio import AsyncIOMotorClient
import firebase_admin
from firebase_admin import credentials
import json

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {
            "name": "driver-training",
            "description": (
                "Driver signup: pre-trip training modules, the aptitude test "
                "(random 10 questions, 3 attempts, answers never exposed), and "
                "the onboarding state machine that tells the app which screen "
                "to show. `POST /driver-training/start` begins the flow."
            ),
        },
        {
            "name": "admin-aptitude",
            "description": (
                "Admin-only management of the aptitude question bank - CRUD, "
                "per-question visibility toggle, re-seed, and the attempts log. "
                "These responses DO include the correct answer."
            ),
        },
        {
            "name": "rides",
            "description": (
                "Emergency ride dispatch. A mother calls `POST /rides/request`; "
                "the backend fans the request out to nearby online drivers as "
                "offers, first-accept-wins. State transitions (accepted, "
                "arrived, started, completed, cancelled) and the driver's live "
                "location are pushed over the same `/calls/ws` socket (with FCM "
                "as the backgrounded-app fallback). Google Maps powers routing, "
                "ETA and nearest-hospital lookup; falls back to straight-line "
                "estimates when `GOOGLE_MAPS_API_KEY` is unset."
            ),
        },
    ],
)

import certifi

@app.on_event("startup")
async def startup_db_client():
    # First, before any background job touches the new tables. A failure stops the deploy.
    await run_migrations()

    mongo_db.client =AsyncIOMotorClient(settings.MONGODB_URI, tlsCAFile=certifi.where())
    mongo_db.db = mongo_db.client["loni_ai_chat"]
    print("Connected to MongoDB")
    
    if settings.FIREBASE_SERVICE_ACCOUNT:
        try:
            if not firebase_admin._apps:
                cert_dict = json.loads(settings.FIREBASE_SERVICE_ACCOUNT)
                cred = credentials.Certificate(cert_dict)
                firebase_admin.initialize_app(cred)
                print("Firebase Admin initialized successfully.")
        except Exception as e:
            print(f"Error initializing Firebase Admin: {e}")

    from app.modules.community.router import start_view_flusher
    start_view_flusher()
    from app.modules.checkins.scheduler import start_checkin_scheduler
    start_checkin_scheduler()
    from app.modules.ai_chat.providers import describe as describe_ai
    print(describe_ai())
    from app.modules.users.partner_sync import start_partner_sweeper
    start_partner_sweeper()
    from app.core.timeouts import start_timeout_sweeper
    start_timeout_sweeper()
    from app.core.ws_manager import manager as ws_manager
    await ws_manager.start_relay(settings.REDIS_URL)
    if not settings.REDIS_URL and int(os.environ.get("WEB_CONCURRENCY", "1")) > 1:
        print("WARNING: several workers but no REDIS_URL - live events only reach users on the same worker.")

@app.on_event("shutdown")
async def shutdown_db_client():
    from app.modules.checkins.scheduler import stop_checkin_scheduler
    await stop_checkin_scheduler()
    from app.modules.users.partner_sync import stop_partner_sweeper
    await stop_partner_sweeper()
    from app.core.timeouts import stop_timeout_sweeper
    await stop_timeout_sweeper()
    from app.core.ws_manager import manager as ws_manager
    await ws_manager.stop_relay()
    from app.modules.community.router import stop_view_flusher
    await stop_view_flusher()
    mongo_db.client.close()
    print("Closed MongoDB connection")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = errors[0].get("msg") if errors else "Validation Error"
    return JSONResponse(
        status_code=400,
        content={"success": False, "message": msg}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": exc.detail}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal server error"}
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {"message": "Welcome to Loni Backend API"}
