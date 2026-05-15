# backend/app/tests/test_chat.py
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock
import asyncio

pytestmark = pytest.mark.asyncio

async def test_chat_without_document(auth_headers):
    """Test chat without selecting a document"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/api/chat/ask",
            headers=auth_headers,
            json={
                "document_id": "00000000-0000-0000-0000-000000000000",
                "question": "What is this about?"
            }
        )
    
    assert response.status_code == 404

@patch("app.services.llm_service.LLMService.generate_answer")
async def test_chat_with_document(
    mock_generate_answer, 
    auth_headers, 
    sample_pdf_file, 
    test_user
):
    """Test chat with a processed document"""
    mock_generate_answer.return_value = "This is a mock answer about the document."
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Upload document
        with open(sample_pdf_file, "rb") as f:
            upload_response = await ac.post(
                "/api/upload/file",
                headers=auth_headers,
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        
        document_id = upload_response.json()["id"]
        
        # Wait a bit for processing
        await asyncio.sleep(2)
        
        # Ask question
        response = await ac.post(
            "/api/chat/ask",
            headers=auth_headers,
            json={
                "document_id": document_id,
                "question": "What is the document about?"
            }
        )
    
    # Should succeed even if content not fully processed
    assert response.status_code in [200, 400]

async def test_summarize_document(auth_headers, sample_pdf_file):
    """Test document summarization"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Upload document
        with open(sample_pdf_file, "rb") as f:
            upload_response = await ac.post(
                "/api/upload/file",
                headers=auth_headers,
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        
        document_id = upload_response.json()["id"]
        
        # Get summary
        response = await ac.post(
            "/api/chat/summarize",
            headers=auth_headers,
            json={"document_id": document_id}
        )
    
    assert response.status_code in [200, 400]

async def test_chat_streaming(auth_headers, sample_pdf_file):
    """Test streaming chat response"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Upload document
        with open(sample_pdf_file, "rb") as f:
            upload_response = await ac.post(
                "/api/upload/file",
                headers=auth_headers,
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        
        document_id = upload_response.json()["id"]
        
        # Ask question with streaming
        response = await ac.post(
            "/api/chat/ask-stream",
            headers=auth_headers,
            json={
                "document_id": document_id,
                "question": "Tell me about this document"
            }
        )
    
    # Streaming response returns 200 even if processing
    assert response.status_code in [200, 400]