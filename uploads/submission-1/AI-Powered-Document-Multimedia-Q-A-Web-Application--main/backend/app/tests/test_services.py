# backend/app/tests/test_services.py
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.services.file_processor import FileProcessor
from app.services.transcription import whisper_transcribe
from app.services.llm_service import llm_service

pytestmark = pytest.mark.asyncio

async def test_extract_text_from_pdf(sample_pdf_file):
    """Test PDF text extraction"""
    text = await FileProcessor.extract_text_from_pdf(sample_pdf_file)
    
    assert text is not None
    assert len(text) > 0
    assert "test PDF document" in text.lower()

async def test_get_media_duration(sample_audio_file):
    """Test media duration extraction"""
    duration = await FileProcessor.get_media_duration(sample_audio_file, "audio")
    
    assert duration > 0
    assert duration <= 3  # Should be around 2 seconds

@patch("app.services.transcription.whisper")
async def test_whisper_transcription(mock_whisper, sample_audio_file):
    """Test Whisper transcription service"""
    # Mock whisper model
    mock_model = MagicMock()
    mock_model.transcribe.return_value = {
        "text": "Mock transcription result"
    }
    mock_whisper.load_model.return_value = mock_model
    
    # Call function
    result = await whisper_transcribe(sample_audio_file)
    
    assert result == "Mock transcription result"

@patch("app.services.llm_service.Groq")
async def test_llm_generate_answer(mock_groq_class):
    """Test LLM answer generation"""
    # Mock Groq client
    mock_client = MagicMock()
    mock_completion = MagicMock()
    mock_completion.choices = [MagicMock()]
    mock_completion.choices[0].message.content = "Test answer from LLM"
    mock_client.chat.completions.create.return_value = mock_completion
    mock_groq_class.return_value = mock_client
    
    # Set API key
    import app.services.llm_service
    app.services.llm_service.settings.GROQ_API_KEY = "test_key"
    
    # Reinitialize service (will use mock)
    from app.services.llm_service import LLMService
    service = LLMService()
    service.client = mock_client
    
    answer = await service.generate_answer(
        "What is AI?", 
        "AI stands for Artificial Intelligence.", 
        stream=False
    )
    
    assert answer == "Test answer from LLM"

async def test_llm_generate_summary():
    """Test summary generation"""
    # This test will use real API if key is present, otherwise skip
    import os
    if not os.getenv("GROQ_API_KEY"):
        pytest.skip("GROQ_API_KEY not set")
    
    text = "This is a long text that needs to be summarized. It contains multiple sentences."
    summary = await llm_service.generate_summary(text)
    
    assert summary is not None
    assert len(summary) > 0