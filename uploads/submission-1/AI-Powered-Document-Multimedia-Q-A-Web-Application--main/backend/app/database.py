# backend/app/database.py
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

mongodb = MongoDB()

# Export db directly for easy imports
db = None

async def connect_to_mongo():
    """Connect to MongoDB Atlas"""
    global db
    try:
        mongodb.client = AsyncIOMotorClient(settings.MONGODB_URL)
        mongodb.db = mongodb.client[settings.MONGODB_DB_NAME]
        db = mongodb.db  # Set global db reference
        
        # Test connection
        await mongodb.client.admin.command('ping')
        logger.info("✅ Connected to MongoDB Atlas successfully!")
        
        # Create indexes
        await create_indexes()
        
    except Exception as e:
        logger.error(f"❌ MongoDB connection failed: {str(e)}")
        raise

async def close_mongo_connection():
    """Close MongoDB connection"""
    if mongodb.client:
        mongodb.client.close()
        logger.info("MongoDB connection closed")

async def create_indexes():
    """Create indexes for faster queries"""
    try:
        # Users collection
        await mongodb.db.users.create_index("email", unique=True)
        await mongodb.db.users.create_index("created_at")
        
        # Documents collection
        await mongodb.db.documents.create_index("user_id")
        await mongodb.db.documents.create_index("created_at")
        await mongodb.db.documents.create_index([("user_id", 1), ("status", 1)])
        
        # Chunks collection
        await mongodb.db.chunks.create_index("document_id")
        await mongodb.db.chunks.create_index([("document_id", 1), ("chunk_index", 1)])
        
        # Chat history collection
        await mongodb.db.chat_history.create_index("user_id")
        await mongodb.db.chat_history.create_index("document_id")
        await mongodb.db.chat_history.create_index("created_at")
        
        logger.info("✅ MongoDB indexes created")
    except Exception as e:
        logger.warning(f"Index creation warning: {str(e)}")

def get_db():
    """Dependency to get database"""
    return mongodb.db