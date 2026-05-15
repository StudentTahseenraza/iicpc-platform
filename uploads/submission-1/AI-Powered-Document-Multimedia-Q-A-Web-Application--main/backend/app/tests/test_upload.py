# backend/app/tests/test_upload.py
import pytest
from httpx import AsyncClient
from pathlib import Path
import os

pytestmark = pytest.mark.asyncio

async def test_upload_pdf_success(auth_headers, sample_pdf_file, test_user):
    """Test successful PDF upload"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        with open(sample_pdf_file, "rb") as f:
            response = await ac.post(
                "/api/upload/file",
                headers=auth_headers,
                files={"file": ("test.pdf", f, "application/pdf")}
            )
    
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "test.pdf"
    assert data["file_type"] == "pdf"
    assert data["status"] == "processing"
    assert "id" in data

async def test_upload_audio_success(auth_headers, sample_audio_file, test_user):
    """Test successful audio upload"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        with open(sample_audio_file, "rb") as f:
            response = await ac.post(
                "/api/upload/file",
                headers=auth_headers,
                files={"file": ("test.wav", f, "audio/wav")}
            )
    
    assert response.status_code == 200
    data = response.json()
    assert data["file_type"] == "wav"
    assert data["status"] == "processing"

async def test_upload_invalid_file_type(auth_headers):
    """Test upload with invalid file type"""
    async with AsyncClient(app=app, base_url="http/test") as ac:
        # Create a text file (not allowed)
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tmp:
            tmp.write(b"This is a text file")
            tmp_path = tmp.name
        
        try:
            with open(tmp_path, "rb") as f:
                response = await ac.post(
                    "/api/upload/file",
                    headers=auth_headers,
                    files={"file": ("invalid.txt", f, "text/plain")}
                )
            
            assert response.status_code == 400
            assert "not allowed" in response.json()["detail"].lower()
        finally:
            os.unlink(tmp_path)

async def test_upload_without_auth(sample_pdf_file):
    """Test upload without authentication"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        with open(sample_pdf_file, "rb") as f:
            response = await ac.post(
                "/api/upload/file",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
    
    assert response.status_code == 403

async def test_get_documents(auth_headers, test_user, sample_pdf_file):
    """Test getting user documents"""
    # Upload a document first
    async with AsyncClient(app=app, base_url="http://test") as ac:
        with open(sample_pdf_file, "rb") as f:
            await ac.post(
                "/api/upload/file",
                headers=auth_headers,
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        
        # Get documents
        response = await ac.get(
            "/api/documents",
            headers=auth_headers
        )
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

async def test_get_single_document(auth_headers, sample_pdf_file, test_user):
    """Test getting a specific document"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Upload document
        with open(sample_pdf_file, "rb") as f:
            upload_response = await ac.post(
                "/api/upload/file",
                headers=auth_headers,
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        
        document_id = upload_response.json()["id"]
        
        # Get document
        response = await ac.get(
            f"/api/documents/{document_id}",
            headers=auth_headers
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == document_id
    assert data["filename"] == "test.pdf"

async def test_delete_document(auth_headers, sample_pdf_file):
    """Test deleting a document"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Upload document
        with open(sample_pdf_file, "rb") as f:
            upload_response = await ac.post(
                "/api/upload/file",
                headers=auth_headers,
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        
        document_id = upload_response.json()["id"]
        
        # Delete document
        delete_response = await ac.delete(
            f"/api/documents/{document_id}",
            headers=auth_headers
        )
        
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = await ac.get(
            f"/api/documents/{document_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 404