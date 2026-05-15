# backend/app/models.py
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from uuid import uuid4
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")

# User Model
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()), alias="_id")
    email: str
    hashed_password: str
    full_name: Optional[str] = None
    role: str = "user"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# Document Model
class Document(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()), alias="_id")
    user_id: str
    filename: str
    file_type: str  # pdf, audio, video
    file_path: str
    file_size: int
    extracted_text: Optional[str] = None
    transcript: Optional[str] = None
    summary: Optional[str] = None
    duration: Optional[float] = None
    status: str = "processing"  # processing, completed, failed
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Chunk Model (for vector search)
class Chunk(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()), alias="_id")
    document_id: str
    chunk_index: int
    text: str
    embedding: Optional[List[float]] = None  # Store embedding vector
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Chat History Model
class ChatHistory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()), alias="_id")
    user_id: str
    document_id: str
    question: str
    answer: str
    referenced_timestamp: Optional[float] = None
    referenced_text: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)