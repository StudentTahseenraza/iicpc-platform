# backend/app/services/embeddings.py
import requests
import numpy as np
from typing import List, Dict, Any
import logging

from app.config import settings

logger = logging.getLogger(__name__)

class FreeEmbeddingsService:
    """100% FREE Embeddings using Hugging Face Inference API"""
    
    def __init__(self):
        self.api_url = f"https://api-inference.huggingface.co/pipelines/feature-extraction/{settings.HF_EMBEDDING_MODEL}"
        self.headers = {}
        
        if settings.HUGGINGFACE_API_KEY:
            self.headers["Authorization"] = f"Bearer {settings.HUGGINGFACE_API_KEY}"
            logger.info("Hugging Face embeddings service initialized")
        else:
            logger.warning("HUGGINGFACE_API_KEY not set. Using local sentence-transformers fallback.")
            self._init_local()
    
    def _init_local(self):
        """Fallback to local sentence-transformers (still free)"""
        try:
            from sentence_transformers import SentenceTransformer
            self.local_model = SentenceTransformer('all-MiniLM-L6-v2')
            self.use_local = True
            logger.info("Using local sentence-transformers for embeddings")
        except ImportError:
            logger.error("sentence-transformers not installed")
            self.use_local = False
    
    async def encode(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for texts"""
        if self.use_local:
            # Local processing (free, no API needed)
            return self.local_model.encode(texts)
        
        # Use Hugging Face API
        try:
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json={"inputs": texts, "options": {"wait_for_model": True}}
            )
            
            if response.status_code == 200:
                embeddings = response.json()
                return np.array(embeddings)
            else:
                logger.error(f"HF API error: {response.status_code}")
                # Fallback to local
                if hasattr(self, 'local_model'):
                    return self.local_model.encode(texts)
                raise Exception("Embedding failed")
                
        except Exception as e:
            logger.error(f"Embedding error: {str(e)}")
            raise

# Global instance
embedding_service = FreeEmbeddingsService()