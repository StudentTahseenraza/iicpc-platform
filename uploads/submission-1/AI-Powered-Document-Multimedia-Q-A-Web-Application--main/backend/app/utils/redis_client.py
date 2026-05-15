# backend/app/utils/redis_client.py
import redis.asyncio as redis
from app.config import settings
import json
from typing import Optional, Any

class RedisClient:
    def __init__(self):
        self.redis = None
    
    async def connect(self):
        """Connect to Redis"""
        self.redis = await redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True
        )
    
    async def close(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.close()
    
    async def ping(self) -> bool:
        """Check Redis connection"""
        if not self.redis:
            await self.connect()
        return await self.redis.ping()
    
    async def set(self, key: str, value: Any, expire: int = 3600):
        """Set value with expiration"""
        if not self.redis:
            await self.connect()
        await self.redis.setex(key, expire, json.dumps(value))
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value"""
        if not self.redis:
            await self.connect()
        value = await self.redis.get(key)
        if value:
            return json.loads(value)
        return None
    
    async def delete(self, key: str):
        """Delete key"""
        if not self.redis:
            await self.connect()
        await self.redis.delete(key)

# Global Redis client instance
redis_client = RedisClient()