"""Redis utilities for Pub/Sub messaging."""
import json
import logging
from datetime import datetime
from typing import Optional
import redis.asyncio as redis
import redis

from app.core.config import settings

logger = logging.getLogger(__name__)

# Global Redis connection pools (async and sync)
_async_redis_pool: Optional[redis.ConnectionPool] = None
_async_redis_client: Optional[redis.Redis] = None
_sync_redis_pool: Optional[redis.ConnectionPool] = None
_sync_redis_client: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    """Get or create async Redis client."""
    global _async_redis_pool, _async_redis_client
    
    if _async_redis_client is None:
        # Create connection pool
        _async_redis_pool = redis.ConnectionPool(
            host=settings.REDIS_HOST,
            port=int(settings.REDIS_PORT),
            password=settings.REDIS_PASSWORD or None,
            decode_responses=True,
        )
        _async_redis_client = redis.Redis(connection_pool=_async_redis_pool)
        
        # Test connection
        try:
            await _async_redis_client.ping()
            logger.info("Connected to Redis (async)")
        except Exception as e:
            logger.error(f"Failed to connect to Redis (async): {e}")
            raise
    
    return _async_redis_client


def get_redis_sync() -> redis.Redis:
    """Get or create synchronous Redis client."""
    global _sync_redis_pool, _sync_redis_client
    
    if _sync_redis_client is None:
        # Create connection pool
        _sync_redis_pool = redis.ConnectionPool(
            host=settings.REDIS_HOST,
            port=int(settings.REDIS_PORT),
            password=settings.REDIS_PASSWORD or None,
            decode_responses=True,
        )
        _sync_redis_client = redis.Redis(connection_pool=_sync_redis_pool)
        
        # Test connection
        try:
            _sync_redis_client.ping()
            logger.info("Connected to Redis (sync)")
        except Exception as e:
            logger.error(f"Failed to connect to Redis (sync): {e}")
            raise
    
    return _sync_redis_client


async def close_redis():
    """Close Redis connections."""
    global _async_redis_client, _async_redis_pool, _sync_redis_client, _sync_redis_pool
    if _async_redis_client:
        await _async_redis_client.close()
        _async_redis_client = None
    if _async_redis_pool:
        await _async_redis_pool.disconnect()
        _async_redis_pool = None
    if _sync_redis_client:
        _sync_redis_client.close()
        _sync_redis_client = None
    if _sync_redis_pool:
        _sync_redis_pool.disconnect()
        _sync_redis_pool = None


async def publish_progress(job_id: int, message: dict):
    """Publish progress update to Redis channel (async)."""
    try:
        redis_client = await get_redis()
        channel = f"job:{job_id}:progress"
        payload = json.dumps(message)
        await redis_client.publish(channel, payload)
        logger.debug(f"Published to {channel}: {payload}")
    except Exception as e:
        logger.error(f"Failed to publish progress to Redis (async): {e}")


def publish_progress_sync(job_id: int, message: dict):
    """Publish progress update to Redis channel (synchronous)."""
    try:
        redis_client = get_redis_sync()
        channel = f"job:{job_id}:progress"
        payload = json.dumps(message)
        redis_client.publish(channel, payload)
        logger.debug(f"Published to {channel} (sync): {payload}")
    except Exception as e:
        logger.error(f"Failed to publish progress to Redis (sync): {e}")


def publish_job_event(job_id: int, event_type: str, data: dict):
    """Publish a global job lifecycle event to the 'job:events' channel.
    
    This fans out to all connected dashboard WebSocket clients.
    """
    try:
        redis_client = get_redis_sync()
        payload = json.dumps({
            "type": event_type,
            "job_id": job_id,
            **data,
            "timestamp": str(datetime.utcnow()),
        })
        redis_client.publish("job:events", payload)
        logger.debug(f"Published global job event: {payload}")
    except Exception as e:
        logger.error(f"Failed to publish job event: {e}")


async def subscribe_to_progress(job_id: int):
    """Subscribe to progress updates for a job (async)."""
    try:
        redis_client = await get_redis()
        channel = f"job:{job_id}:progress"
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(channel)
        logger.info(f"Subscribed to {channel}")
        return pubsub
    except Exception as e:
        logger.error(f"Failed to subscribe to Redis progress channel: {e}")
        raise