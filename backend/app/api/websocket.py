"""WebSocket router for real-time communication."""

import asyncio
import json
import logging
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.core.redis import get_redis, subscribe_to_progress, close_redis

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accept and store a new connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Remove a connection."""
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send a message to a specific client."""
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        """Broadcast a message to all connected clients."""
        for connection in self.active_connections:
            await connection.send_text(message)


manager = ConnectionManager()


async def redis_listener(websocket: WebSocket, job_id: str):
    """Listen to Redis Pub/Sub for job progress updates."""
    try:
        redis_client = await get_redis()
        channel = f"job:{job_id}:progress"
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(channel)
        logger.info(f"Subscribed to Redis channel: {channel}")
        
        # Listen for messages
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"]
                logger.debug(f"Received from Redis channel {channel}: {data}")
                # Broadcast to all connected clients for this job
                await manager.broadcast(data)
    except Exception as e:
        logger.error(f"Error in Redis listener: {e}")
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
        except:
            pass


@router.websocket("/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time communication."""
    await manager.connect(websocket)
    # Extract job_id from client_id if it's in format "job_{job_id}"
    job_id = None
    if client_id.startswith("job_"):
        try:
            job_id = client_id.split("_")[1]
        except (IndexError, ValueError):
            job_id = None
    
    # Start Redis listener task if we have a job_id
    listener_task = None
    if job_id:
        listener_task = asyncio.create_task(redis_listener(websocket, job_id))
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            try:
                # Try to parse as JSON for structured messages
                message = json.loads(data)
                # Handle different message types
                msg_type = message.get("type", "unknown")
                if msg_type == "ping":
                    await manager.send_personal_message(json.dumps({"type": "pong"}), websocket)
                else:
                    # Echo back the message for now
                    await manager.send_personal_message(json.dumps({"type": "echo", "data": message}), websocket)
            except json.JSONDecodeError:
                # If not JSON, treat as plain text
                await manager.send_personal_message(f"Message received: {data}", websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        # Notify others that a client left
        await manager.broadcast(json.dumps({"type": "system", "message": f"Client {client_id} disconnected"}))
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
    finally:
        # Cancel the Redis listener task when connection closes
        if listener_task:
            listener_task.cancel()
            try:
                await listener_task
            except asyncio.CancelledError:
                pass