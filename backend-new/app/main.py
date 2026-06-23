from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router
from app.core import mongo_db
from motor.motor_asyncio import AsyncIOMotorClient

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc"
)

import certifi

@app.on_event("startup")
async def startup_db_client():
    mongo_db.client = AsyncIOMotorClient(settings.MONGODB_URI, tlsCAFile=certifi.where())
    mongo_db.db = mongo_db.client["loni_ai_chat"]
    print("Connected to MongoDB")

@app.on_event("shutdown")
async def shutdown_db_client():
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
