# backend/app/services/file_processor.py
import os
import shutil
from typing import Tuple, Optional
from pathlib import Path
from fastapi import UploadFile, HTTPException
import pypdf
from moviepy.editor import VideoFileClip, AudioFileClip
import logging

from app.config import settings

logger = logging.getLogger(__name__)

class FileProcessor:
    @staticmethod
    async def save_upload_file(upload_file: UploadFile, user_id: str) -> Tuple[str, str]:
        """Save uploaded file to disk"""
        file_extension = Path(upload_file.filename).suffix.lower()
        if file_extension not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type {file_extension} not allowed. Allowed: {settings.ALLOWED_EXTENSIONS}"
            )
        
        user_dir = os.path.join(settings.UPLOAD_DIR, str(user_id))
        os.makedirs(user_dir, exist_ok=True)
        
        file_path = os.path.join(user_dir, upload_file.filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)
        
        file_size = os.path.getsize(file_path)
        if file_size > settings.MAX_FILE_SIZE:
            os.remove(file_path)
            raise HTTPException(status_code=400, detail="File size exceeds limit")
        
        return file_path, file_extension[1:]
    
    @staticmethod
    async def extract_text_from_pdf(file_path: str) -> str:
        """Extract text from PDF file"""
        try:
            text = ""
            with open(file_path, 'rb') as file:
                pdf_reader = pypdf.PdfReader(file)
                for page in pdf_reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text
            return text if text else "No text could be extracted from PDF."
        except Exception as e:
            logger.error(f"Error extracting PDF text: {str(e)}")
            return f"Error extracting text: {str(e)}"
    
    @staticmethod
    async def get_media_duration(file_path: str) -> float:
        """Get duration of audio/video file"""
        try:
            if file_path.endswith(('.mp3', '.wav', '.m4a')):
                clip = AudioFileClip(file_path)
            else:
                clip = VideoFileClip(file_path)
            
            duration = clip.duration
            clip.close()
            return duration
        except Exception as e:
            logger.error(f"Error getting duration: {str(e)}")
            return 0.0
    
    @staticmethod
    async def process_file(file_path: str, file_type: str) -> Tuple[str, Optional[str], Optional[float]]:
        """Process file based on type (NO WHISPER)"""
        extracted_text = None
        duration = None
        
        try:
            if file_type == "pdf":
                extracted_text = await FileProcessor.extract_text_from_pdf(file_path)
                
            elif file_type in ["audio", "video", "mp3", "wav", "mp4", "webm", "m4a"]:
                duration = await FileProcessor.get_media_duration(file_path)
                extracted_text = f"Media file: {os.path.basename(file_path)}\nDuration: {duration:.2f} seconds\n\nNote: Audio/Video files are supported for playback. Ask questions about the content if you have a transcript."
            
            return extracted_text, None, duration
            
        except Exception as e:
            logger.error(f"Error processing file: {str(e)}")
            raise HTTPException(status_code=500, detail=f"File processing failed: {str(e)}")