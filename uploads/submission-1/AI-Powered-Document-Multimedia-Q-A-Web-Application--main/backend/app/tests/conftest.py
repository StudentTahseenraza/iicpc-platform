# backend/app/tests/conftest.py
import pytest
from typing import Generator, AsyncGenerator
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
import asyncio
from datetime import datetime
import tempfile
import os
import shutil

from app.main import app
from app.database import Base, get_db
from app.config import settings
from app.models import User, Document
from app.auth import create_access_token, get_password_hash

# Test database URL (SQLite in memory)
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

# Create test engine
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    poolclass=NullPool
)

TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def override_get_db() -> AsyncGenerator:
    """Override database dependency for testing"""
    async with TestSessionLocal() as session:
        yield session

# Override database dependency
app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(autouse=True, scope="function")
async def setup_database():
    """Setup test database before each test"""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
def client() -> Generator:
    """Return test client"""
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
async def test_user(db: AsyncSession) -> User:
    """Create test user"""
    user = User(
        email="test@example.com",
        hashed_password=get_password_hash("testpassword123"),
        full_name="Test User"
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@pytest.fixture
def test_user_token(test_user: User) -> str:
    """Generate JWT token for test user"""
    token = create_access_token(data={"sub": str(test_user.id)})
    return token

@pytest.fixture
def auth_headers(test_user_token: str) -> dict:
    """Return authorization headers"""
    return {"Authorization": f"Bearer {test_user_token}"}

@pytest.fixture
def sample_pdf_file():
    """Create sample PDF file for testing"""
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    
    temp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    c = canvas.Canvas(temp_pdf.name, pagesize=letter)
    c.drawString(100, 750, "This is a test PDF document for AI Q&A testing.")
    c.drawString(100, 700, "The quick brown fox jumps over the lazy dog.")
    c.drawString(100, 650, "Artificial Intelligence is transforming how we interact with documents.")
    c.save()
    
    yield temp_pdf.name
    os.unlink(temp_pdf.name)

@pytest.fixture
def sample_audio_file():
    """Create sample audio file for testing"""
    import numpy as np
    import scipy.io.wavfile as wav
    
    temp_audio = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    sample_rate = 16000
    duration = 2  # seconds
    t = np.linspace(0, duration, int(sample_rate * duration))
    # Generate sine wave
    audio_data = np.sin(2 * np.pi * 440 * t).astype(np.float32)
    
    wav.write(temp_audio.name, sample_rate, audio_data)
    
    yield temp_audio.name
    os.unlink(temp_audio.name)

@pytest.fixture
def mock_groq_response():
    """Mock Groq API response"""
    return {
        "choices": [{
            "message": {
                "content": "This is a mock AI response for testing purposes."
            }
        }]
    }

@pytest.fixture
def mock_whisper_response():
    """Mock Whisper transcription response"""
    return {
        "text": "This is a mock transcription of the audio file for testing.",
        "segments": [
            {"text": "This is a mock", "start": 0.0, "end": 2.5},
            {"text": "transcription of the audio", "start": 2.5, "end": 5.0},
            {"text": "file for testing.", "start": 5.0, "end": 7.5}
        ],
        "language": "en"
    }