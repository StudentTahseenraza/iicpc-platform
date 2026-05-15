# backend/app/routers/documents.py
from fastapi import APIRouter, Depends, HTTPException
from typing import List
from datetime import datetime

from app.database import get_db
from app.auth import get_current_user
from app.services.vector_store import vector_store

router = APIRouter()

@router.get("/")
async def get_user_documents(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Get all documents for current user"""
    
    cursor = db.documents.find(
        {"user_id": current_user["id"]}
    ).sort("created_at", -1)
    
    documents = await cursor.to_list(None)
    
    # Convert ObjectId to string
    for doc in documents:
        doc["id"] = doc["_id"]
        del doc["_id"]
    
    return documents

@router.get("/debug/summary/{document_id}")
async def debug_summary(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Debug summary generation"""
    
    document = await db.documents.find_one({
        "_id": document_id,
        "user_id": current_user["id"]
    })
    
    if not document:
        return {"error": "Document not found"}
    
    return {
        "document_id": document_id,
        "filename": document.get("filename"),
        "status": document.get("status"),
        "has_summary": "summary" in document,
        "summary_value": document.get("summary"),
        "has_extracted_text": "extracted_text" in document,
        "extracted_text_length": len(document.get("extracted_text", "")),
        "extracted_text_preview": document.get("extracted_text", "")[:300]
    }

@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Delete document"""
    
    document = await db.documents.find_one({
        "_id": document_id,
        "user_id": current_user["id"]
    })
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete from vector store
    await vector_store.delete_document(document_id, db)
    
    # Delete chunks
    await db.chunks.delete_many({"document_id": document_id})
    
    # Delete document
    await db.documents.delete_one({"_id": document_id})
    
    return {"message": "Document deleted successfully"}