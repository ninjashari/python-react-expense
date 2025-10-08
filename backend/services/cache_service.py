import json
import redis
import pickle
from typing import Any, Optional, Union, Dict, List
from datetime import timedelta
import os
import logging
from functools import wraps

logger = logging.getLogger(__name__)

class CacheService:
    """Redis-based caching service for improved read performance"""
    
    def __init__(self):
        self.redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.redis_client = None
        self.enabled = os.getenv('CACHE_ENABLED', 'true').lower() == 'true'
        self._connect()
    
    def _connect(self):
        """Initialize Redis connection"""
        if not self.enabled:
            logger.info("Caching is disabled")
            return
            
        try:
            self.redis_client = redis.from_url(
                self.redis_url,
                decode_responses=False,  # We'll handle encoding ourselves
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            # Test connection
            self.redis_client.ping()
            logger.info("Successfully connected to Redis")
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}. Caching will be disabled.")
            self.enabled = False
            self.redis_client = None
    
    def is_available(self) -> bool:
        """Check if cache is available"""
        if not self.enabled or not self.redis_client:
            return False
        try:
            self.redis_client.ping()
            return True
        except:
            return False
    
    def _serialize(self, data: Any) -> bytes:
        """Serialize data for storage"""
        return pickle.dumps(data)
    
    def _deserialize(self, data: bytes) -> Any:
        """Deserialize data from storage"""
        if data is None:
            return None
        return pickle.loads(data)
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.is_available():
            return None
        
        try:
            data = self.redis_client.get(key)
            return self._deserialize(data)
        except Exception as e:
            logger.warning(f"Cache get error for key {key}: {e}")
            return None
    
    def set(self, key: str, value: Any, expire: Optional[Union[int, timedelta]] = None) -> bool:
        """Set value in cache with optional expiration"""
        if not self.is_available():
            return False
        
        try:
            serialized_data = self._serialize(value)
            if expire:
                if isinstance(expire, timedelta):
                    expire = int(expire.total_seconds())
                return self.redis_client.setex(key, expire, serialized_data)
            else:
                return self.redis_client.set(key, serialized_data)
        except Exception as e:
            logger.warning(f"Cache set error for key {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if not self.is_available():
            return False
        
        try:
            return bool(self.redis_client.delete(key))
        except Exception as e:
            logger.warning(f"Cache delete error for key {key}: {e}")
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        if not self.is_available():
            return 0
        
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                return self.redis_client.delete(*keys)
            return 0
        except Exception as e:
            logger.warning(f"Cache delete pattern error for pattern {pattern}: {e}")
            return 0
    
    def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        if not self.is_available():
            return False
        
        try:
            return bool(self.redis_client.exists(key))
        except Exception as e:
            logger.warning(f"Cache exists error for key {key}: {e}")
            return False
    
    def clear_user_cache(self, user_id: str) -> int:
        """Clear all cache entries for a specific user"""
        pattern = f"user:{user_id}:*"
        return self.delete_pattern(pattern)
    
    def clear_all_cache(self) -> bool:
        """Clear all cache entries (use with caution)"""
        if not self.is_available():
            return False
        
        try:
            return self.redis_client.flushdb()
        except Exception as e:
            logger.warning(f"Cache clear all error: {e}")
            return False

# Global cache instance
cache_service = CacheService()

def cache_key(*args, **kwargs) -> str:
    """Generate a cache key from arguments"""
    key_parts = []
    for arg in args:
        if isinstance(arg, (str, int, float)):
            key_parts.append(str(arg))
        else:
            key_parts.append(str(hash(str(arg))))
    
    for k, v in sorted(kwargs.items()):
        if v is not None:
            key_parts.append(f"{k}:{v}")
    
    return ":".join(key_parts)

def cached(expire: Optional[Union[int, timedelta]] = timedelta(minutes=15), 
          key_prefix: str = ""):
    """Decorator for caching function results"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key_str = f"{key_prefix}:{func.__name__}:{cache_key(*args, **kwargs)}"
            
            # Try to get from cache first
            cached_result = cache_service.get(cache_key_str)
            if cached_result is not None:
                logger.debug(f"Cache hit for key: {cache_key_str}")
                return cached_result
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            if result is not None:
                cache_service.set(cache_key_str, result, expire)
                logger.debug(f"Cache set for key: {cache_key_str}")
            
            return result
        return wrapper
    return decorator

# Cache invalidation helpers
class CacheInvalidator:
    """Helper class for cache invalidation patterns"""
    
    @staticmethod
    def invalidate_user_transactions(user_id: str):
        """Invalidate transaction-related cache for a user"""
        patterns = [
            f"user:{user_id}:transactions:*",
            f"user:{user_id}:transaction_summary:*",
            f"user:{user_id}:reports:*"
        ]
        
        total_deleted = 0
        for pattern in patterns:
            total_deleted += cache_service.delete_pattern(pattern)
        
        logger.info(f"Invalidated {total_deleted} transaction cache entries for user {user_id}")
    
    @staticmethod
    def invalidate_user_accounts(user_id: str):
        """Invalidate account-related cache for a user"""
        patterns = [
            f"user:{user_id}:accounts:*",
            f"user:{user_id}:account:*"
        ]
        
        total_deleted = 0
        for pattern in patterns:
            total_deleted += cache_service.delete_pattern(pattern)
        
        logger.info(f"Invalidated {total_deleted} account cache entries for user {user_id}")
    
    @staticmethod
    def invalidate_user_references(user_id: str):
        """Invalidate payee and category cache for a user"""
        patterns = [
            f"user:{user_id}:payees:*",
            f"user:{user_id}:categories:*"
        ]
        
        total_deleted = 0
        for pattern in patterns:
            total_deleted += cache_service.delete_pattern(pattern)
        
        logger.info(f"Invalidated {total_deleted} reference cache entries for user {user_id}")
    
    @staticmethod
    def invalidate_all_user_cache(user_id: str):
        """Invalidate all cache for a user"""
        total_deleted = cache_service.clear_user_cache(user_id)
        logger.info(f"Invalidated {total_deleted} total cache entries for user {user_id}")