# backend/app/tests/test_auth.py
import pytest
from httpx import AsyncClient
from app.main import app
from app.models import User
from app.database import AsyncSessionLocal

pytestmark = pytest.mark.asyncio

async def test_register_user_success():
    """Test successful user registration"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/api/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "SecurePass123",
                "full_name": "New Test User"
            }
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["full_name"] == "New Test User"
    assert "id" in data

async def test_register_duplicate_email():
    """Test registration with existing email"""
    # First registration
    async with AsyncClient(app=app, base_url="http://test") as ac:
        await ac.post(
            "/api/auth/register",
            json={
                "email": "duplicate@example.com",
                "password": "SecurePass123",
                "full_name": "First User"
            }
        )
        
        # Duplicate registration
        response = await ac.post(
            "/api/auth/register",
            json={
                "email": "duplicate@example.com",
                "password": "AnotherPass123",
                "full_name": "Second User"
            }
        )
    
    assert response.status_code == 400
    assert "Email already registered" in response.json()["detail"]

async def test_login_success():
    """Test successful login"""
    # Create user first
    async with AsyncClient(app=app, base_url="http://test") as ac:
        await ac.post(
            "/api/auth/register",
            json={
                "email": "login@example.com",
                "password": "LoginPass123",
                "full_name": "Login User"
            }
        )
        
        # Login
        response = await ac.post(
            "/api/auth/login",
            data={
                "username": "login@example.com",
                "password": "LoginPass123"
            }
        )
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

async def test_login_invalid_password():
    """Test login with invalid password"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        await ac.post(
            "/api/auth/register",
            json={
                "email": "invalid@example.com",
                "password": "CorrectPass123",
                "full_name": "Test User"
            }
        )
        
        response = await ac.post(
            "/api/auth/login",
            data={
                "username": "invalid@example.com",
                "password": "WrongPass123"
            }
        )
    
    assert response.status_code == 401
    assert "Incorrect" in response.json()["detail"]

async def test_login_nonexistent_user():
    """Test login with non-existent user"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/api/auth/login",
            data={
                "username": "nonexistent@example.com",
                "password": "AnyPass123"
            }
        )
    
    assert response.status_code == 401

async def test_get_current_user_info(auth_headers, test_user):
    """Test getting current user info"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get(
            "/api/auth/me",
            headers=auth_headers
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user.email
    assert data["id"] == str(test_user.id)

async def test_protected_route_without_token():
    """Test accessing protected route without authentication"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/auth/me")
    
    assert response.status_code == 403  # Missing credentials