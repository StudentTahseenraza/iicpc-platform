# backend/app/schemas.py
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

# Auth schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[UUID] = None

# Document schemas
class DocumentUploadResponse(BaseModel):
    id: UUID
    filename: str
    file_type: str
    status: str
    message: str

class DocumentResponse(BaseModel):
    id: UUID
    filename: str
    file_type: str
    summary: Optional[str]
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# Chat schemas
class ChatRequest(BaseModel):
    document_id: UUID
    question: str

class TimestampInfo(BaseModel):
    timestamp: float
    text: str
    start_time: float
    end_time: float

class ChatResponse(BaseModel):
    answer: str
    referenced_timestamp: Optional[float]
    referenced_text: Optional[str]
    timestamps: List[TimestampInfo]

class SummarizeRequest(BaseModel):
    document_id: UUID

class SummarizeResponse(BaseModel):
    summary: str
    duration: Optional[float]

# Transcription schemas
class TranscriptionResponse(BaseModel):
    document_id: UUID
    transcript: str
    duration: float
    language: str