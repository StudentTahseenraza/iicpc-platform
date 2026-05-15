# backend/app/tests/test_embeddings.py
import pytest
from uuid import uuid4
from app.services.embeddings import vector_store
from app.utils.chunking import chunk_text_by_sentences, chunk_pdf_text

pytestmark = pytest.mark.asyncio

async def test_add_chunks_to_vector_store():
    """Test adding chunks to vector store"""
    document_id = uuid4()
    chunks = [
        "This is the first test chunk.",
        "This is the second test chunk with different content.",
        "A third chunk about artificial intelligence and machine learning."
    ]
    
    chunk_ids = await vector_store.add_document_chunks(document_id, chunks)
    
    assert len(chunk_ids) == len(chunks)
    assert vector_store.index.ntotal >= len(chunks)

async def test_search_similar_chunks():
    """Test searching for similar chunks"""
    document_id = uuid4()
    chunks = [
        "Python is a programming language for data science.",
        "JavaScript is used for web development.",
        "Machine learning algorithms require large datasets."
    ]
    
    await vector_store.add_document_chunks(document_id, chunks)
    
    results = await vector_store.search("What is Python used for?", top_k=2)
    
    assert len(results) > 0
    assert "python" in results[0]["text"].lower() or "programming" in results[0]["text"].lower()

async def test_search_with_document_filter():
    """Test searching with document ID filter"""
    doc1_id = uuid4()
    doc2_id = uuid4()
    
    chunks1 = ["Content from document one about topic A."]
    chunks2 = ["Content from document two about topic B."]
    
    await vector_store.add_document_chunks(doc1_id, chunks1)
    await vector_store.add_document_chunks(doc2_id, chunks2)
    
    results = await vector_store.search("topic A", document_id=doc1_id, top_k=1)
    
    assert len(results) > 0
    assert results[0]["document_id"] == str(doc1_id)

async def test_delete_document_from_vector_store():
    """Test removing document from vector store"""
    document_id = uuid4()
    chunks = ["Test content that will be deleted."]
    
    await vector_store.add_document_chunks(document_id, chunks)
    initial_count = vector_store.index.ntotal
    
    await vector_store.delete_document(document_id)
    new_count = vector_store.index.ntotal
    
    assert new_count < initial_count

def test_chunk_text_by_sentences():
    """Test sentence-based text chunking"""
    text = "First sentence. Second sentence! Third sentence? Fourth sentence."
    chunks = chunk_text_by_sentences(text, chunk_size=50, overlap=10)
    
    assert len(chunks) > 0
    assert isinstance(chunks, list)

def test_chunk_pdf_text():
    """Test PDF text chunking"""
    text = "Paragraph one.\n\nParagraph two with more content.\n\nParagraph three."
    chunks = chunk_pdf_text(text, chunk_size=100, overlap=20)
    
    assert len(chunks) > 0
    assert all(isinstance(chunk, str) for chunk in chunks)