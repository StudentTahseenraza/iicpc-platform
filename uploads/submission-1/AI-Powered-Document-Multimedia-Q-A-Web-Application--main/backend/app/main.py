# backend/app/main.py
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection, get_db
from app.routers import upload, chat, documents, auth_routes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown"""
    # Startup
    logger.info("Starting up...")
    await connect_to_mongo()
    logger.info("Ready to accept requests")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    await close_mongo_connection()

app = FastAPI(
    title="AI Document & Multimedia Q&A API",
    description="MongoDB-powered AI Q&A system",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth_routes.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(upload.router, prefix="/api/upload", tags=["File Upload"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])

@app.get("/")
async def root():
    return {
        "message": "AI Document Q&A API with MongoDB",
        "status": "running",
        "database": "MongoDB Atlas"
    }

@app.get("/health")
async def health_check(db=Depends(get_db)):
    """Health check endpoint"""
    try:
        await db.command("ping")
        return {"status": "healthy", "database": "connected"}
    except:
        return {"status": "unhealthy", "database": "disconnected"}