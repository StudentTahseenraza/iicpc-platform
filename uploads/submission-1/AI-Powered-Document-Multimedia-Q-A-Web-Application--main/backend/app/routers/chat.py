# backend/app/routers/chat.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime
from uuid import uuid4
import logging

from app.database import get_db
from app.auth import get_current_user
from app.services.llm_service import llm_service
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/ask")
async def ask_question(
    request: dict,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Ask a question about a document"""
    try:
        document_id = request.get("document_id")
        question = request.get("question")
        
        if not document_id or not question:
            raise HTTPException(status_code=400, detail="Missing document_id or question")
        
        # Verify document belongs to user
        document = await db.documents.find_one({
            "_id": document_id,
            "user_id": current_user["id"]
        })
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Search for relevant chunks
        search_results = await vector_store.search(
            question,
            document_id=document_id,
            top_k=5,
            db=db
        )
        
        # Build context
        if search_results:
            context = "\n\n".join([f"Excerpt {i+1}: {r['text']}" for i, r in enumerate(search_results)])
        else:
            context = document.get("extracted_text", "No content available.")
        
        # Generate answer (non-streaming)
        answer = await llm_service.generate_answer(question, context, stream=False)
        
        # Save to chat history
        chat_history = {
            "_id": str(uuid4()),
            "user_id": current_user["id"],
            "document_id": document_id,
            "question": question,
            "answer": answer,
            "created_at": datetime.utcnow()
        }
        await db.chat_history.insert_one(chat_history)
        
        return {
            "answer": answer,
            "referenced_timestamp": None,
            "referenced_text": None,
            "timestamps": []
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

@router.post("/ask-stream")
async def ask_question_stream(
    request: dict,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Ask a question with streaming response"""
    try:
        document_id = request.get("document_id")
        question = request.get("question")
        
        if not document_id or not question:
            raise HTTPException(status_code=400, detail="Missing document_id or question")
        
        # Verify document
        document = await db.documents.find_one({
            "_id": document_id,
            "user_id": current_user["id"]
        })
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Search for relevant chunks
        search_results = await vector_store.search(
            question, 
            document_id=document_id, 
            top_k=5, 
            db=db
        )
        
        if search_results:
            context = "\n\n".join([f"Excerpt {i+1}: {r['text']}" for i, r in enumerate(search_results)])
        else:
            context = document.get("extracted_text", "No content available.")
        
        # Get the async generator
        result = await llm_service.generate_answer(question, context, stream=True)
        
        # Result should be an async generator
        async def generate():
            try:
                async for chunk in result:
                    yield chunk
            except Exception as e:
                yield f"Error: {str(e)}"
        
        return StreamingResponse(generate(), media_type="text/plain")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Stream error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Stream error: {str(e)}")

@router.post("/summarize")
async def summarize_document(
    request: dict,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get document summary - generates if not exists"""
    try:
        document_id = request.get("document_id")
        
        if not document_id:
            raise HTTPException(status_code=400, detail="Missing document_id")
        
        document = await db.documents.find_one({
            "_id": document_id,
            "user_id": current_user["id"]
        })
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # If summary already exists, return it
        if document.get("summary"):
            return {"summary": document["summary"]}
        
        # If no extracted text, can't generate summary
        if not document.get("extracted_text"):
            return {"summary": "No content available for summarization. The document may still be processing or has no selectable text."}
        
        # Generate summary on demand
        logger.info(f"Generating summary for document {document_id}")
        summary = await llm_service.generate_summary(document["extracted_text"][:5000])
        
        # Save summary to database
        await db.documents.update_one(
            {"_id": document_id},
            {"$set": {"summary": summary}}
        )
        
        logger.info(f"Summary generated and saved: {len(summary)} chars")
        
        return {"summary": summary}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Summarize error: {str(e)}")
        return {"summary": f"Error generating summary: {str(e)}"}