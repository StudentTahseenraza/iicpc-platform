# backend/app/routers/auth_routes.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from uuid import uuid4
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

from app.database import get_db
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user
from app.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Pydantic models
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=4, max_length=72)
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

@router.post("/register", response_model=UserResponse)
async def register(user_data: UserRegister, db=Depends(get_db)):
    """Register new user"""
    try:
        # Check if user exists
        existing = await db.users.find_one({"email": user_data.email})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Hash password
        hashed_password = get_password_hash(user_data.password)
        
        # Create user
        user = {
            "_id": str(uuid4()),
            "email": user_data.email,
            "hashed_password": hashed_password,
            "full_name": user_data.full_name,
            "role": "user",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await db.users.insert_one(user)
        
        logger.info(f"User registered: {user_data.email}")
        
        return UserResponse(
            id=user["_id"],
            email=user["email"],
            full_name=user.get("full_name")
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )

@router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db=Depends(get_db)):
    """Login user - accepts form data"""
    try:
        # Find user by email
        user = await db.users.find_one({"email": form_data.username})
        
        if not user:
            logger.warning(f"Login failed: User not found - {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        # Verify password
        if not verify_password(form_data.password, user["hashed_password"]):
            logger.warning(f"Login failed: Invalid password for {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        # Create access token
        access_token = create_access_token(
            data={"sub": user["_id"]},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        logger.info(f"User logged in: {user['email']}")
        
        return TokenResponse(access_token=access_token, token_type="bearer")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )

@router.post("/login/json", response_model=TokenResponse)
async def login_json(login_data: UserLogin, db=Depends(get_db)):
    """Alternative JSON login endpoint"""
    try:
        user = await db.users.find_one({"email": login_data.email})
        
        if not user or not verify_password(login_data.password, user["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        access_token = create_access_token(
            data={"sub": user["_id"]},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        return TokenResponse(access_token=access_token, token_type="bearer")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"JSON login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        full_name=current_user.get("full_name")
    )