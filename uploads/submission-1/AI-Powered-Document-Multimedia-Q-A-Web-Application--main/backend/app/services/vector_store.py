# backend/app/services/vector_store.py
import numpy as np
from typing import List, Dict, Any
from sklearn.metrics.pairwise import cosine_similarity
import hashlib
import json
import os
import logging
from uuid import UUID

logger = logging.getLogger(__name__)

class SimpleVectorStore:
    """Simple vector store using sklearn (No FAISS dependency)"""
    
    def __init__(self):
        self.documents = []
        self.index_path = "vectors.json"
        self._load_index()
    
    def _text_to_vector(self, text: str) -> np.ndarray:
        """Convert text to simple hash-based vector"""
        # Simple hash-based vector (512 dimensions)
        vector = np.zeros(512)
        words = text.split()[:100]  # Limit words
        
        for i, word in enumerate(words):
            hash_val = int(hashlib.md5(word.encode()).hexdigest(), 16)
            idx = hash_val % 512
            vector[idx] += 1
        
        # Normalize
        if np.linalg.norm(vector) > 0:
            vector = vector / np.linalg.norm(vector)
        
        return vector
    
    def _load_index(self):
        """Load vectors from JSON file"""
        if os.path.exists(self.index_path):
            try:
                with open(self.index_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.documents = data.get('documents', [])
                logger.info(f"Loaded {len(self.documents)} documents from index")
            except Exception as e:
                logger.error(f"Failed to load index: {str(e)}")
    
    def _save_index(self):
        """Save vectors to JSON file"""
        try:
            with open(self.index_path, 'w', encoding='utf-8') as f:
                json.dump({'documents': self.documents}, f)
            logger.info(f"Saved {len(self.documents)} documents to index")
        except Exception as e:
            logger.error(f"Failed to save index: {str(e)}")
    
    async def add_document_chunks(
        self, 
        document_id: UUID, 
        chunks: List[str], 
        timestamps: List = None,
        db = None
    ) -> List[int]:
        """Add chunks to vector store"""
        if not chunks:
            return []
        
        start_idx = len(self.documents)
        
        for i, chunk in enumerate(chunks):
            vector = self._text_to_vector(chunk)
            doc_info = {
                "document_id": str(document_id),
                "chunk_index": start_idx + i,
                "text": chunk,
                "vector": vector.tolist(),
                "start_time": timestamps[i][0] if timestamps and i < len(timestamps) else None,
                "end_time": timestamps[i][1] if timestamps and i < len(timestamps) else None
            }
            self.documents.append(doc_info)
        
        self._save_index()
        
        # Store in MongoDB if db is provided and not None
        if db is not None:
            try:
                for i, chunk in enumerate(chunks):
                    chunk_data = {
                        "document_id": str(document_id),
                        "chunk_index": start_idx + i,
                        "text": chunk,
                        "start_time": timestamps[i][0] if timestamps and i < len(timestamps) else None,
                        "end_time": timestamps[i][1] if timestamps and i < len(timestamps) else None,
                    }
                    await db.chunks.insert_one(chunk_data)
                logger.info(f"Saved {len(chunks)} chunks to MongoDB")
            except Exception as e:
                logger.warning(f"Could not save chunks to MongoDB: {str(e)}")
        
        return list(range(start_idx, start_idx + len(chunks)))
    
    async def search(
        self, 
        query: str, 
        document_id: UUID = None, 
        top_k: int = 5,
        db = None
    ) -> List[Dict[str, Any]]:
        """Search for relevant chunks using cosine similarity"""
        if not self.documents:
            return []
        
        # Get query vector
        query_vector = self._text_to_vector(query)
        
        # Calculate similarities
        similarities = []
        for doc in self.documents:
            if document_id is None or doc["document_id"] == str(document_id):
                doc_vector = np.array(doc["vector"])
                similarity = cosine_similarity([query_vector], [doc_vector])[0][0]
                similarities.append((similarity, doc))
        
        # Sort by similarity and get top_k
        similarities.sort(key=lambda x: x[0], reverse=True)
        top_results = similarities[:top_k]
        
        results = []
        for score, doc in top_results:
            results.append({
                "text": doc["text"],
                "score": float(score),
                "start_time": doc.get("start_time"),
                "end_time": doc.get("end_time"),
                "document_id": doc["document_id"]
            })
        
        return results
    
    async def delete_document(self, document_id: UUID, db=None):
        """Remove document from vector store"""
        self.documents = [d for d in self.documents if d["document_id"] != str(document_id)]
        self._save_index()
        
        if db is not None:
            await db.chunks.delete_many({"document_id": str(document_id)})

# Global instance
vector_store = SimpleVectorStore()