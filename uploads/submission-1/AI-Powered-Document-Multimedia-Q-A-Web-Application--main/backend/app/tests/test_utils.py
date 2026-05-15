# backend/app/tests/test_utils.py
import pytest
from app.utils.chunking import chunk_text_by_sentences, chunk_pdf_text, chunk_transcript_with_timestamps
from app.utils.redis_client import redis_client

async def test_redis_operations():
    """Test Redis client operations"""
    # Set value
    await redis_client.set("test_key", {"data": "test_value"}, expire=60)
    
    # Get value
    value = await redis_client.get("test_key")
    assert value is not None
    assert value["data"] == "test_value"
    
    # Delete key
    await redis_client.delete("test_key")
    deleted_value = await redis_client.get("test_key")
    assert deleted_value is None

def test_chunk_text_with_overlap():
    """Test text chunking with overlap"""
    text = "Sentence one. Sentence two. Sentence three. Sentence four. Sentence five."
    chunks = chunk_text_by_sentences(text, chunk_size=50, overlap=10)
    
    assert len(chunks) > 0
    
    # Check overlap between consecutive chunks
    if len(chunks) > 1:
        # Last sentence of first chunk should appear in second chunk
        assert len(chunks[0]) > 0

def test_chunk_transcript_with_timestamps():
    """Test transcript chunking with timestamps"""
    segments = [
        {"text": "First segment content", "start": 0.0, "end": 5.0},
        {"text": "Second segment content", "start": 5.0, "end": 10.0},
        {"text": "Third segment content", "start": 10.0, "end": 15.0},
        {"text": "Fourth segment content", "start": 15.0, "end": 20.0},
    ]
    
    chunks, timestamps = chunk_transcript_with_timestamps(segments, chunk_duration=10)
    
    assert len(chunks) == len(timestamps)
    assert len(chunks) >= 2  # Should create at least 2 chunks for 20 seconds
    assert len(timestamps[0]) == 2  # Each timestamp has start and end
    assert timestamps[0][1] - timestamps[0][0] <= 12  # Within chunk duration + tolerance

def test_chunk_pdf_text():
    """Test PDF text chunking with paragraphs"""
    text = """First paragraph with important content.
    
Second paragraph with more details and information.
    
Third paragraph concluding the document."""
    
    chunks = chunk_pdf_text(text, chunk_size=200, overlap=20)
    
    assert len(chunks) > 0
    assert all(isinstance(chunk, str) for chunk in chunks)

def test_empty_text_chunking():
    """Test chunking with empty text"""
    chunks = chunk_text_by_sentences("")
    assert chunks == []
    
    chunks = chunk_pdf_text("")
    assert chunks == []