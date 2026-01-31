"""
LiveKit Webhook Processing System
Handles webhook signature verification, event processing, and delivery logging
"""

import os
import json
import hmac
import hashlib
import secrets
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict

import httpx
import asyncpg
from fastapi import HTTPException, WebSocket, WebSocketDisconnect
from starlette.requests import Request

# Configure logging
logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================
WEBHOOK_SECRET = os.getenv("LIVEKIT_WEBHOOK_SECRET", "")
WEBHOOK_RETRY_ATTEMPTS = int(os.getenv("WEBHOOK_RETRY_ATTEMPTS", "3"))
WEBHOOK_RETRY_DELAY = int(os.getenv("WEBHOOK_RETRY_DELAY", "5"))  # seconds
WEBHOOK_TIMEOUT = int(os.getenv("WEBHOOK_TIMEOUT", "30"))  # seconds

# =============================================================================
# DATA MODELS
# =============================================================================

@dataclass
class WebhookEvent:
    """Represents a LiveKit webhook event"""
    id: str
    event_type: str
    room_sid: Optional[str] = None
    room_name: Optional[str] = None
    participant_sid: Optional[str] = None
    participant_identity: Optional[str] = None
    track_sid: Optional[str] = None
    egress_id: Optional[str] = None
    ingress_id: Optional[str] = None
    payload: Dict[str, Any] = None
    received_at: Optional[datetime] = None
    processed: bool = False
    
    def __post_init__(self):
        if self.payload is None:
            self.payload = {}
        if self.received_at is None:
            self.received_at = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        if self.received_at:
            data['received_at'] = self.received_at.isoformat()
        return data


@dataclass
class WebhookDelivery:
    """Represents a webhook delivery attempt"""
    id: str
    webhook_id: str
    event_type: str
    payload: Dict[str, Any]
    status: str  # pending, delivered, failed
    response_code: Optional[int] = None
    response_body: Optional[str] = None
    delivered_at: Optional[datetime] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    created_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        if self.delivered_at:
            data['delivered_at'] = self.delivered_at.isoformat()
        if self.created_at:
            data['created_at'] = self.created_at.isoformat()
        return data


# =============================================================================
# WEBSOCKET MANAGER FOR REAL-TIME UPDATES
# =============================================================================

class WebSocketManager:
    """Manages WebSocket connections for real-time dashboard updates"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_metadata: Dict[WebSocket, Dict[str, Any]] = {}
    
    async def connect(self, websocket: WebSocket, client_type: str = "dashboard"):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_metadata[websocket] = {
            "connected_at": datetime.utcnow(),
            "client_type": client_type,
            "client_ip": websocket.client.host if websocket.client else None
        }
        logger.info(f"WebSocket connected: {client_type} from {websocket.client.host if websocket.client else 'unknown'}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.connection_metadata:
            del self.connection_metadata[websocket]
        logger.info("WebSocket disconnected")
    
    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast a message to all connected clients"""
        if not self.active_connections:
            return
        
        json_message = json.dumps(message, default=str)
        disconnected = []
        
        for connection in self.active_connections:
            try:
                await connection.send_text(json_message)
            except Exception as e:
                logger.warning(f"Failed to send WebSocket message: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn)
    
    async def send_to_client(self, websocket: WebSocket, message: Dict[str, Any]):
        """Send a message to a specific client"""
        try:
            await websocket.send_text(json.dumps(message, default=str))
        except Exception as e:
            logger.warning(f"Failed to send WebSocket message to client: {e}")
            self.disconnect(websocket)
    
    def get_connection_count(self) -> int:
        """Get the number of active connections"""
        return len(self.active_connections)


# Global WebSocket manager instance
websocket_manager = WebSocketManager()


# =============================================================================
# WEBHOOK SIGNATURE VERIFICATION
# =============================================================================

def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """
    Verify LiveKit webhook signature using HMAC-SHA256
    
    LiveKit sends the signature in the format: "sha256=<hex_hash>"
    """
    if not signature or not secret:
        logger.error("Missing signature or secret")
        return False
    
    # Extract the hash from the signature header
    if signature.startswith("sha256="):
        expected_sig = signature[7:]  # Remove "sha256=" prefix
    else:
        expected_sig = signature
    
    # Calculate HMAC-SHA256
    computed_sig = hmac.new(
        secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(computed_sig, expected_sig)


def extract_event_id(payload: Dict[str, Any]) -> str:
    """Extract or generate a unique event ID from the payload"""
    # LiveKit events should have an id field
    if 'id' in payload:
        return payload['id']
    # Fallback: generate from event type and timestamp
    event_type = payload.get('event', 'unknown')
    timestamp = payload.get('createdAt', datetime.utcnow().isoformat())
    return f"{event_type}-{timestamp}"


def parse_livekit_event(payload: Dict[str, Any]) -> WebhookEvent:
    """Parse a LiveKit webhook payload into a WebhookEvent"""
    event_type = payload.get('event', 'unknown')
    
    # Extract common fields
    event = WebhookEvent(
        id=extract_event_id(payload),
        event_type=event_type,
        payload=payload
    )
    
    # Extract room information
    if 'room' in payload:
        room = payload['room']
        event.room_sid = room.get('sid')
        event.room_name = room.get('name')
    
    # Extract participant information
    if 'participant' in payload:
        participant = payload['participant']
        event.participant_sid = participant.get('sid')
        event.participant_identity = participant.get('identity')
    
    # Extract track information
    if 'track' in payload:
        track = payload['track']
        event.track_sid = track.get('sid')
    
    # Extract egress information
    if 'egressInfo' in payload:
        egress = payload['egressInfo']
        event.egress_id = egress.get('egressId')
    elif 'egress_id' in payload:
        event.egress_id = payload['egress_id']
    
    # Extract ingress information
    if 'ingressInfo' in payload:
        ingress = payload['ingressInfo']
        event.ingress_id = ingress.get('ingressId')
    elif 'ingress_id' in payload:
        event.ingress_id = payload['ingress_id']
    
    return event


# =============================================================================
# EVENT HANDLERS
# =============================================================================

class EventHandler:
    """Handles LiveKit webhook events"""
    
    def __init__(self, db_pool: asyncpg.Pool, redis_client=None):
        self.db_pool = db_pool
        self.redis_client = redis_client
    
    async def handle_event(self, event: WebhookEvent) -> bool:
        """Route event to appropriate handler"""
        handlers = {
            'room_started': self.handle_room_started,
            'room_finished': self.handle_room_finished,
            'participant_joined': self.handle_participant_joined,
            'participant_left': self.handle_participant_left,
            'track_published': self.handle_track_published,
            'track_unpublished': self.handle_track_unpublished,
            'egress_started': self.handle_egress_started,
            'egress_ended': self.handle_egress_ended,
            'ingress_started': self.handle_ingress_started,
            'ingress_ended': self.handle_ingress_ended,
        }
        
        handler = handlers.get(event.event_type)
        if handler:
            try:
                await handler(event)
                event.processed = True
                logger.info(f"Successfully handled {event.event_type} event: {event.id}")
                return True
            except Exception as e:
                logger.error(f"Error handling {event.event_type} event: {e}")
                return False
        else:
            logger.warning(f"Unknown event type: {event.event_type}")
            return True  # Still mark as processed to avoid retries
    
    async def handle_room_started(self, event: WebhookEvent):
        """Handle room_started event"""
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO webhook_events 
                    (id, event_type, room_sid, room_name, payload, processed)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   ON CONFLICT (id) DO NOTHING""",
                event.id, event.event_type, event.room_sid, 
                event.room_name, json.dumps(event.payload), True
            )
        
        # Broadcast to WebSocket clients
        await websocket_manager.broadcast({
            "type": "room_started",
            "event": event.to_dict()
        })
    
    async def handle_room_finished(self, event: WebhookEvent):
        """Handle room_finished event"""
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO webhook_events 
                    (id, event_type, room_sid, room_name, payload, processed)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   ON CONFLICT (id) DO NOTHING""",
                event.id, event.event_type, event.room_sid,
                event.room_name, json.dumps(event.payload), True
            )
        
        await websocket_manager.broadcast({
            "type": "room_finished",
            "event": event.to_dict()
        })
    
    async def handle_participant_joined(self, event: WebhookEvent):
        """Handle participant_joined event"""
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO webhook_events 
                    (id, event_type, room_sid, room_name, 
                     participant_sid, participant_identity, payload, processed)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                   ON CONFLICT (id) DO NOTHING""",
                event.id, event.event_type, event.room_sid, event.room_name,
                event.participant_sid, event.participant_identity,
                json.dumps(event.payload), True
            )
        
        await websocket_manager.broadcast({
            "type": "participant_joined",
            "event": event.to_dict()
        })
    
    async def handle_participant_left(self, event: WebhookEvent):
        """Handle participant_left event"""
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO webhook_events 
                    (id, event_type, room_sid, room_name, 
                     participant_sid, participant_identity, payload, processed)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                   ON CONFLICT (id) DO NOTHING""",
                event.id, event.event_type, event.room_sid, event.room_name,
                event.participant_sid, event.participant_identity,
                json.dumps(event.payload), True
            )
        
        await websocket_manager.broadcast({
            "type": "participant_left",
            "event": event.to_dict()
        })
    
    async def handle_track_published(self, event: WebhookEvent):
        """Handle track_published event"""
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO webhook_events 
                    (id, event_type, room_sid, room_name, 
                     participant_sid, participant_identity, track_sid, payload, processed)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                   ON CONFLICT (id) DO NOTHING""",
                event.id, event.event_type, event.room_sid, event.room_name,
                event.participant_sid, event.participant_identity, event.track_sid,
                json.dumps(event.payload), True
            )
        
        await websocket_manager.broadcast({
            "type": "track_published",
            "event": event.to_dict()
        })
    
    async def handle_track_unpublished(self, event: WebhookEvent):
        """Handle track_unpublished event"""
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO webhook_events 
                    (id, event_type, room_sid, room_name, 
                     participant_sid, participant_identity, track_sid, payload, processed)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                   ON CONFLICT (id) DO NOTHING""",
                event.id, event.event_type, event.room_sid, event.room_name,
                event.participant_sid, event.participant_identity, event.track_sid,
                json.dumps(event.payload), True
            )
        
        await websocket_manager.broadcast({
            "type": "track_unpublished",
            "event": event.to_dict()
        })
    
    async def handle_egress_started(self, event: WebhookEvent):
        """Handle egress_started event"""
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO webhook_events 
                    (id, event_type, room_sid, room_name, egress_id, payload, processed)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT (id) DO NOTHING""",
                event.id, event.event_type, event.room_sid, event.room_name,
                event.egress_id, json.dumps(event.payload), True
            )
            
            # Update egress status in egresses table
            if event.egress_id:
                await conn.execute(
                    "UPDATE egresses SET status = 'active' WHERE egress_id = $1",
                    event.egress_id
                )
        
        await websocket_manager.broadcast({
            "type": "egress_started",
            "event": event.to_dict()
        })
    
    async def handle_egress_ended(self, event: WebhookEvent):
        """Handle egress_ended event"""
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO webhook_events 
                    (id, event_type, room_sid, room_name, egress_id, payload, processed)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT (id) DO NOTHING""",
                event.id, event.event_type, event.room_sid, event.room_name,
                event.egress_id, json.dumps(event.payload), True
            )
            
            # Update egress status in egresses table
            if event.egress_id:
                await conn.execute(
                    "UPDATE egresses SET status = 'ended', ended_at = NOW() WHERE egress_id = $1",
                    event.egress_id
                )
        
        await websocket_manager.broadcast({
            "type": "egress_ended",
            "event": event.to_dict()
        })
    
    async def handle_ingress_started(self, event: WebhookEvent):
        """Handle ingress_started event"""
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO webhook_events 
                    (id, event_type, room_sid, room_name, ingress_id, payload, processed)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT (id) DO NOTHING""",
                event.id, event.event_type, event.room_sid, event.room_name,
                event.ingress_id, json.dumps(event.payload), True
            )
            
            # Update ingress status
            if event.ingress_id:
                await conn.execute(
                    "UPDATE ingresses SET status = 'active' WHERE ingress_id = $1",
                    event.ingress_id
                )
        
        await websocket_manager.broadcast({
            "type": "ingress_started",
            "event": event.to_dict()
        })
    
    async def handle_ingress_ended(self, event: WebhookEvent):
        """Handle ingress_ended event"""
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO webhook_events 
                    (id, event_type, room_sid, room_name, ingress_id, payload, processed)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT (id) DO NOTHING""",
                event.id, event.event_type, event.room_sid, event.room_name,
                event.ingress_id, json.dumps(event.payload), True
            )
            
            # Update ingress status
            if event.ingress_id:
                await conn.execute(
                    "UPDATE ingresses SET status = 'ended' WHERE ingress_id = $1",
                    event.ingress_id
                )
        
        await websocket_manager.broadcast({
            "type": "ingress_ended",
            "event": event.to_dict()
        })


# =============================================================================
# WEBHOOK DELIVERY SERVICE
# =============================================================================

class WebhookDeliveryService:
    """Handles webhook delivery to configured endpoints"""
    
    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool
        self.http_client = httpx.AsyncClient(timeout=WEBHOOK_TIMEOUT)
    
    async def close(self):
        """Close the HTTP client"""
        await self.http_client.aclose()
    
    async def create_delivery(self, webhook_id: str, event_type: str, 
                              payload: Dict[str, Any]) -> str:
        """Create a new delivery record"""
        delivery_id = secrets.token_urlsafe(16)
        
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO webhook_deliveries 
                    (id, webhook_id, event_type, payload, status, retry_count)
                   VALUES ($1, $2, $3, $4, $5, $6)""",
                delivery_id, webhook_id, event_type, json.dumps(payload), 
                'pending', 0
            )
        
        return delivery_id
    
    async def deliver_webhook(self, webhook_id: str, delivery_id: str) -> bool:
        """Deliver a webhook to its endpoint"""
        async with self.db_pool.acquire() as conn:
            # Get webhook details
            webhook = await conn.fetchrow(
                "SELECT url, secret FROM webhooks WHERE id = $1",
                webhook_id
            )
            
            if not webhook:
                logger.error(f"Webhook {webhook_id} not found")
                return False
            
            # Get delivery details
            delivery = await conn.fetchrow(
                "SELECT event_type, payload FROM webhook_deliveries WHERE id = $1",
                delivery_id
            )
            
            if not delivery:
                logger.error(f"Delivery {delivery_id} not found")
                return False
            
            url = webhook['url']
            secret = webhook['secret'] or ''
            payload = json.loads(delivery['payload'])
            
            # Sign the payload
            payload_bytes = json.dumps(payload).encode('utf-8')
            signature = hmac.new(
                secret.encode('utf-8'),
                payload_bytes,
                hashlib.sha256
            ).hexdigest()
            
            headers = {
                'Content-Type': 'application/json',
                'X-Webhook-Signature': f'sha256={signature}',
                'X-Webhook-ID': webhook_id,
                'X-Delivery-ID': delivery_id,
                'X-Event-Type': delivery['event_type'],
                'User-Agent': 'LiveKit-Webhook/1.0'
            }
            
            try:
                response = await self.http_client.post(
                    url,
                    json=payload,
                    headers=headers
                )
                
                # Update delivery status
                await conn.execute(
                    """UPDATE webhook_deliveries 
                       SET status = $1, response_code = $2, response_body = $3, 
                           delivered_at = NOW()
                       WHERE id = $4""",
                    'delivered' if response.status_code < 400 else 'failed',
                    response.status_code,
                    response.text[:1000],  # Limit response body size
                    delivery_id
                )
                
                success = response.status_code < 400
                if success:
                    logger.info(f"Webhook {webhook_id} delivered successfully: {response.status_code}")
                else:
                    logger.warning(f"Webhook {webhook_id} delivery failed: {response.status_code}")
                
                return success
                
            except httpx.TimeoutException:
                await self._update_delivery_error(delivery_id, "Request timeout")
                logger.error(f"Webhook {webhook_id} delivery timeout")
                return False
            except httpx.ConnectError as e:
                await self._update_delivery_error(delivery_id, f"Connection error: {str(e)}")
                logger.error(f"Webhook {webhook_id} connection error: {e}")
                return False
            except Exception as e:
                await self._update_delivery_error(delivery_id, str(e))
                logger.error(f"Webhook {webhook_id} delivery error: {e}")
                return False
    
    async def _update_delivery_error(self, delivery_id: str, error_message: str):
        """Update delivery record with error"""
        async with self.db_pool.acquire() as conn:
            await conn.execute(
                """UPDATE webhook_deliveries 
                   SET status = 'failed', error_message = $1, delivered_at = NOW()
                   WHERE id = $2""",
                error_message[:500], delivery_id
            )
    
    async def retry_delivery(self, delivery_id: str) -> bool:
        """Retry a failed delivery"""
        async with self.db_pool.acquire() as conn:
            delivery = await conn.fetchrow(
                """SELECT webhook_id, retry_count FROM webhook_deliveries 
                   WHERE id = $1""",
                delivery_id
            )
            
            if not delivery:
                return False
            
            if delivery['retry_count'] >= WEBHOOK_RETRY_ATTEMPTS:
                logger.warning(f"Delivery {delivery_id} exceeded max retries")
                return False
            
            # Increment retry count
            await conn.execute(
                "UPDATE webhook_deliveries SET retry_count = retry_count + 1 WHERE id = $1",
                delivery_id
            )
            
            return await self.deliver_webhook(delivery['webhook_id'], delivery_id)
    
    async def test_webhook(self, webhook_id: str) -> Dict[str, Any]:
        """Send a test event to a webhook endpoint"""
        test_payload = {
            "event": "test_event",
            "id": f"test-{secrets.token_hex(8)}",
            "createdAt": datetime.utcnow().isoformat(),
            "webhookId": webhook_id,
            "message": "This is a test webhook event"
        }
        
        delivery_id = await self.create_delivery(
            webhook_id, 'test_event', test_payload
        )
        
        success = await self.deliver_webhook(webhook_id, delivery_id)
        
        # Get the delivery result
        async with self.db_pool.acquire() as conn:
            delivery = await conn.fetchrow(
                """SELECT status, response_code, error_message, delivered_at
                   FROM webhook_deliveries WHERE id = $1""",
                delivery_id
            )
        
        return {
            "success": success,
            "delivery_id": delivery_id,
            "status": delivery['status'],
            "response_code": delivery['response_code'],
            "error_message": delivery['error_message'],
            "delivered_at": delivery['delivered_at'].isoformat() if delivery['delivered_at'] else None
        }


# =============================================================================
# MAIN WEBHOOK PROCESSOR
# =============================================================================

class WebhookProcessor:
    """Main webhook processing coordinator"""
    
    def __init__(self, db_pool: asyncpg.Pool, redis_client=None):
        self.db_pool = db_pool
        self.redis_client = redis_client
        self.event_handler = EventHandler(db_pool, redis_client)
        self.delivery_service = WebhookDeliveryService(db_pool)
    
    async def close(self):
        """Cleanup resources"""
        await self.delivery_service.close()
    
    async def process_webhook(self, request: Request) -> Dict[str, Any]:
        """
        Process an incoming webhook request
        
        1. Verify signature
        2. Check idempotency
        3. Parse and handle event
        4. Trigger outbound webhooks
        """
        # Get the raw body
        body = await request.body()
        
        # Get signature from header
        signature = request.headers.get('X-Webhook-Signature', '')
        if not signature:
            # Try LiveKit's alternative header format
            signature = request.headers.get('Livekit-Webhook-Signature', '')
        
        # Verify signature (skip if no secret configured)
        if WEBHOOK_SECRET and not verify_webhook_signature(body, signature, WEBHOOK_SECRET):
            logger.error("Invalid webhook signature")
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        # Parse JSON payload
        try:
            payload = json.loads(body)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON payload: {e}")
            raise HTTPException(status_code=400, detail="Invalid JSON")
        
        # Parse event
        event = parse_livekit_event(payload)
        
        # Check idempotency - skip if already processed
        async with self.db_pool.acquire() as conn:
            existing = await conn.fetchval(
                "SELECT 1 FROM webhook_events WHERE id = $1",
                event.id
            )
            if existing:
                logger.info(f"Event {event.id} already processed, skipping")
                return {"status": "success", "message": "Already processed", "event_id": event.id}
        
        # Handle the event
        success = await self.event_handler.handle_event(event)
        
        # Trigger outbound webhooks for this event
        await self._trigger_outbound_webhooks(event)
        
        if success:
            return {
                "status": "success", 
                "event_id": event.id,
                "event_type": event.event_type
            }
        else:
            return {
                "status": "partial_success",
                "event_id": event.id,
                "event_type": event.event_type,
                "message": "Event stored but processing failed"
            }
    
    async def _trigger_outbound_webhooks(self, event: WebhookEvent):
        """Trigger configured webhooks for this event"""
        async with self.db_pool.acquire() as conn:
            # Get all webhooks that want this event type
            webhooks = await conn.fetch(
                """SELECT id FROM webhooks 
                   WHERE events @> $1::jsonb OR events = '[]'::jsonb""",
                json.dumps([event.event_type])
            )
        
        for webhook in webhooks:
            try:
                delivery_id = await self.delivery_service.create_delivery(
                    webhook['id'], event.event_type, event.payload
                )
                # Deliver asynchronously (don't wait)
                import asyncio
                asyncio.create_task(
                    self.delivery_service.deliver_webhook(webhook['id'], delivery_id)
                )
            except Exception as e:
                logger.error(f"Failed to trigger webhook {webhook['id']}: {e}")
    
    async def get_event_logs(self, limit: int = 100, offset: int = 0,
                             event_type: Optional[str] = None) -> List[Dict]:
        """Get webhook event logs"""
        async with self.db_pool.acquire() as conn:
            if event_type:
                rows = await conn.fetch(
                    """SELECT * FROM webhook_events 
                       WHERE event_type = $1
                       ORDER BY received_at DESC LIMIT $2 OFFSET $3""",
                    event_type, limit, offset
                )
            else:
                rows = await conn.fetch(
                    """SELECT * FROM webhook_events 
                       ORDER BY received_at DESC LIMIT $1 OFFSET $2""",
                    limit, offset
                )
            return [dict(r) for r in rows]
    
    async def get_delivery_logs(self, webhook_id: Optional[str] = None,
                                 limit: int = 100, offset: int = 0) -> List[Dict]:
        """Get webhook delivery logs"""
        async with self.db_pool.acquire() as conn:
            if webhook_id:
                rows = await conn.fetch(
                    """SELECT * FROM webhook_deliveries 
                       WHERE webhook_id = $1
                       ORDER BY created_at DESC LIMIT $2 OFFSET $3""",
                    webhook_id, limit, offset
                )
            else:
                rows = await conn.fetch(
                    """SELECT * FROM webhook_deliveries 
                       ORDER BY created_at DESC LIMIT $1 OFFSET $2""",
                    limit, offset
                )
            return [dict(r) for r in rows]
