# backend/app/routers/upload.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from datetime import datetime
from uuid import uuid4
import logging

from app.database import get_db
from app.auth import get_current_user
from app.services.file_processor import FileProcessor
from app.services.vector_store import vector_store
from app.services.llm_service import llm_service
from app.utils.chunking import chunk_pdf_text

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/file")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Upload PDF, audio, or video file"""
    
    # Save file
    file_path, file_type = await FileProcessor.save_upload_file(file, current_user["id"])
    
    # Create document in MongoDB
    document = {
        "_id": str(uuid4()),
        "user_id": current_user["id"],
        "filename": file.filename,
        "file_type": file_type,
        "file_path": file_path,
        "file_size": file.size,
        "status": "processing",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.documents.insert_one(document)
    
    # Process in background
    background_tasks.add_task(
        process_uploaded_file,
        document["_id"],
        file_path,
        file_type,
        current_user["id"]
    )
    
    return {
        "id": document["_id"],
        "filename": file.filename,
        "file_type": file_type,
        "status": "processing",
        "message": "File uploaded successfully"
    }

async def process_uploaded_file(document_id: str, file_path: str, file_type: str, user_id: str):
    """Background task to process file"""
    from app.database import mongodb
    
    db = mongodb.db
    
    try:
        logger.info(f"📄 Processing document {document_id} of type {file_type}")
        
        # Process file
        extracted_text, transcript, duration = await FileProcessor.process_file(file_path, file_type)
        
        logger.info(f"📝 Extracted text length: {len(extracted_text) if extracted_text else 0} chars")
        
        if not extracted_text or len(extracted_text) < 50:
            logger.warning(f"⚠️ Very little text extracted from {document_id}")
        
        # Create chunks for PDF only
        chunks = []
        if file_type == "pdf" and extracted_text:
            chunks = chunk_pdf_text(extracted_text)
            logger.info(f"📦 Created {len(chunks)} chunks for vector search")
            
            if chunks:
                timestamps = [(None, None)] * len(chunks)
                # Fix: Explicitly check if db is not None
                if db is not None:
                    await vector_store.add_document_chunks(document_id, chunks, timestamps, db)
                else:
                    await vector_store.add_document_chunks(document_id, chunks, timestamps)
        
        # Generate summary if there's enough text
        summary = None
        if extracted_text and len(extracted_text) > 100:
            logger.info(f"🤖 Generating summary for {document_id}...")
            try:
                summary = await llm_service.generate_summary(extracted_text[:5000])
                logger.info(f"✅ Summary generated: {len(summary) if summary else 0} chars")
            except Exception as e:
                logger.error(f"❌ Summary generation failed: {str(e)}")
        else:
            logger.warning(f"⚠️ Not enough text to generate summary: {len(extracted_text) if extracted_text else 0} chars")
        
        # Update document - use $set directly
        update_data = {
            "extracted_text": extracted_text,
            "duration": duration,
            "status": "completed",
            "updated_at": datetime.utcnow()
        }
        if summary:
            update_data["summary"] = summary
        
        await db.documents.update_one(
            {"_id": document_id},
            {"$set": update_data}
        )
        
        logger.info(f"✅ Successfully processed document {document_id}")
        logger.info(f"📊 Summary saved: {'Yes' if summary else 'No'}")
        
    except Exception as e:
        logger.error(f"❌ Failed to process document {document_id}: {str(e)}")
        await db.documents.update_one(
            {"_id": document_id},
            {"$set": {
                "status": "failed",
                "error": str(e),
                "updated_at": datetime.utcnow()
            }}
        )