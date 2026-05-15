# backend/app/utils/chunking.py
from typing import List, Tuple
import re

def chunk_text_by_sentences(text: str, chunk_size: int = 500, overlap: int = 100) -> List[str]:
    """Chunk text by sentences with overlap"""
    if not text:
        return []
    
    # Split by sentences
    sentences = re.split(r'(?<=[.!?])\s+', text)
    
    chunks = []
    current_chunk = []
    current_length = 0
    
    for sentence in sentences:
        sentence_length = len(sentence)
        
        if current_length + sentence_length <= chunk_size:
            current_chunk.append(sentence)
            current_length += sentence_length
        else:
            # Save current chunk
            if current_chunk:
                chunks.append(' '.join(current_chunk))
            
            # Start new chunk with overlap
            overlap_sentences = []
            overlap_length = 0
            
            # Add previous sentences for overlap
            for prev_sentence in reversed(current_chunk):
                if overlap_length + len(prev_sentence) <= overlap:
                    overlap_sentences.insert(0, prev_sentence)
                    overlap_length += len(prev_sentence)
                else:
                    break
            
            current_chunk = overlap_sentences + [sentence]
            current_length = overlap_length + sentence_length
    
    # Add last chunk
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    
    return chunks

def chunk_transcript_with_timestamps(
    segments: List[dict], 
    chunk_duration: int = 60
) -> Tuple[List[str], List[Tuple[float, float]]]:
    """Chunk transcript with timestamps"""
    chunks = []
    timestamps = []
    
    current_chunk = []
    current_text = []
    current_start = None
    current_end = None
    current_duration = 0
    
    for segment in segments:
        if current_start is None:
            current_start = segment["start"]
        
        segment_duration = segment["end"] - segment["start"]
        
        if current_duration + segment_duration <= chunk_duration:
            current_text.append(segment["text"])
            current_end = segment["end"]
            current_duration += segment_duration
        else:
            # Save current chunk
            if current_text:
                chunks.append(' '.join(current_text))
                timestamps.append((current_start, current_end))
            
            # Start new chunk
            current_text = [segment["text"]]
            current_start = segment["start"]
            current_end = segment["end"]
            current_duration = segment_duration
    
    # Add last chunk
    if current_text:
        chunks.append(' '.join(current_text))
        timestamps.append((current_start, current_end))
    
    return chunks, timestamps

def chunk_pdf_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Chunk PDF text with overlap"""
    # Split by paragraphs first
    paragraphs = text.split('\n\n')
    
    chunks = []
    current_chunk = []
    current_length = 0
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        
        para_length = len(para)
        
        if current_length + para_length <= chunk_size:
            current_chunk.append(para)
            current_length += para_length
        else:
            # Save current chunk
            if current_chunk:
                chunks.append('\n\n'.join(current_chunk))
            
            # Check if single paragraph exceeds chunk size
            if para_length > chunk_size:
                # Split paragraph into smaller chunks
                sub_chunks = chunk_text_by_sentences(para, chunk_size, overlap)
                chunks.extend(sub_chunks)
                current_chunk = []
                current_length = 0
            else:
                current_chunk = [para]
                current_length = para_length
    
    # Add last chunk
    if current_chunk:
        chunks.append('\n\n'.join(current_chunk))
    
    return chunks