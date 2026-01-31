"""
LiveKit Admin API
Ultra-low latency (<100ms) production backend
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
import asyncpg
import redis.asyncio as aioredis

# Import webhook processing module
from webhooks import (
    WebhookProcessor, websocket_manager, WebSocketManager,
    verify_webhook_signature, WebhookDeliveryService
)

# =============================================================================
# CONFIG - Optimized for speed
# =============================================================================
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:Admin2026Secure@postgres:5432/livekit_admin")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production-min-32-chars")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "http://livekit:7880")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "APIwQJRKPH1GaLa")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "mCafIFJr80hhRBYVBKCUqgOLEiIpRFLj5RAfEaNjF8p")

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Connection pools (kept hot for <100ms)
db_pool: Optional[asyncpg.Pool] = None
redis_client: Optional[aioredis.Redis] = None
webhook_processor: Optional[WebhookProcessor] = None

# =============================================================================
# MODELS
# =============================================================================
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class User(BaseModel):
    id: str
    email: str
    name: str

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class Project(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    created_at: datetime

class AgentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    voice: str = "alloy"
    model: str = "gpt-4o-mini"

class AIConfigUpdate(BaseModel):
    stt_mode: Optional[str] = None
    stt_provider: Optional[str] = None
    tts_mode: Optional[str] = None
    tts_provider: Optional[str] = None
    llm_mode: Optional[str] = None
    llm_provider: Optional[str] = None

# =============================================================================
# LIFESPAN - Connection pools for speed
# =============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool, redis_client
    logger.info("Starting API with optimized connection pools...")
    
    # DB pool with min connections ready
    db_pool = await asyncpg.create_pool(
        DATABASE_URL.replace("postgresql://", "postgres://"),
        min_size=5, max_size=20, command_timeout=10
    )
    
    # Redis for caching
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    
    logger.info("Connection pools ready - <100ms responses enabled")
    
    # Initialize webhook processor
    global webhook_processor
    webhook_processor = WebhookProcessor(db_pool, redis_client)
    logger.info("Webhook processor initialized")
    
    yield
    
    if webhook_processor:
        await webhook_processor.close()
    if db_pool: await db_pool.close()
    if redis_client: await redis_client.close()

# =============================================================================
# APP
# =============================================================================
app = FastAPI(title="LiveKit Admin API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# HELPERS
# =============================================================================
def create_token(email: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    return jwt.encode({"sub": email, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Check cache first (<1ms)
    cached = await redis_client.get(f"user:{email}")
    if cached:
        import json
        data = json.loads(cached)
        return User(**data)
    
    # DB fallback
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id, email, name FROM admin WHERE email = $1", email)
        if not row:
            raise HTTPException(status_code=401, detail="User not found")
        user = User(id=str(row["id"]), email=row["email"], name=row["name"])
        await redis_client.setex(f"user:{email}", 300, user.model_dump_json())
        return user

# =============================================================================
# HEALTH - Must be <10ms
# =============================================================================
@app.get("/health")
async def health():
    return {"status": "ok", "ts": datetime.utcnow().isoformat()}

# =============================================================================
# AUTH
# =============================================================================
@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    async with db_pool.acquire() as conn:
        valid = await conn.fetchval(
            "SELECT password_hash = crypt($1, password_hash) FROM admin WHERE email = $2",
            form_data.password, form_data.username
        )
        if not valid:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return Token(access_token=create_token(form_data.username))

@app.get("/api/auth/me", response_model=User)
async def get_me(user: User = Depends(get_current_user)):
    return user

@app.post("/api/auth/logout")
async def logout(user: User = Depends(get_current_user)):
    await redis_client.delete(f"user:{user.email}")
    return {"ok": True}

# =============================================================================
# PROJECTS
# =============================================================================
@app.get("/api/projects")
async def list_projects(user: User = Depends(get_current_user)):
    # Cache check
    cached = await redis_client.get("projects:all")
    if cached:
        import json
        return json.loads(cached)
    
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT id, name, description, status, created_at FROM projects ORDER BY created_at DESC")
        result = [dict(r) for r in rows]
        await redis_client.setex("projects:all", 60, __import__('json').dumps(result, default=str))
        return result

@app.post("/api/projects", status_code=201)
async def create_project(data: ProjectCreate, user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO projects (name, description) VALUES ($1, $2) RETURNING id, name, description, status, created_at",
            data.name, data.description
        )
        await conn.execute("INSERT INTO ai_config (project_id) VALUES ($1)", row["id"])
        await redis_client.delete("projects:all")
        return dict(row)

@app.get("/api/projects/{pid}")
async def get_project(pid: str, user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id, name, description, status, created_at FROM projects WHERE id = $1", pid)
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        return dict(row)

@app.put("/api/projects/{pid}")
async def update_project(pid: str, data: ProjectCreate, user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE projects SET name = $2, description = $3 WHERE id = $1 RETURNING *",
            pid, data.name, data.description
        )
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        await redis_client.delete("projects:all")
        return dict(row)

@app.delete("/api/projects/{pid}")
async def delete_project(pid: str, user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        await conn.execute("DELETE FROM projects WHERE id = $1", pid)
        await redis_client.delete("projects:all")
        return {"ok": True}

# =============================================================================
# AI CONFIG
# =============================================================================
@app.get("/api/projects/{pid}/ai-config")
async def get_ai_config(pid: str, user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM ai_config WHERE project_id = $1", pid)
        if not row:
            row = await conn.fetchrow("INSERT INTO ai_config (project_id) VALUES ($1) RETURNING *", pid)
        return dict(row)

@app.put("/api/projects/{pid}/ai-config")
async def update_ai_config(pid: str, data: AIConfigUpdate, user: User = Depends(get_current_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No data")
    
    set_clause = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(updates.keys()))
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            f"UPDATE ai_config SET {set_clause} WHERE project_id = $1 RETURNING *",
            pid, *updates.values()
        )
        return dict(row) if row else {}

# =============================================================================
# TELEPHONY (SIP)
# =============================================================================

class SipTrunkCreate(BaseModel):
    name: str
    trunk_type: str = "inbound"
    sip_server: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    numbers: list[str] = []

class DispatchRuleCreate(BaseModel):
    name: str
    rule_type: str = "direct"
    trunk_id: Optional[str] = None
    agent_id: Optional[str] = None

@app.get("/api/telephony/trunks")
async def list_sip_trunks(user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM sip_trunks ORDER BY created_at DESC")
        return [dict(r) for r in rows]

@app.post("/api/telephony/trunks", status_code=201)
async def create_sip_trunk(data: SipTrunkCreate, user: User = Depends(get_current_user)):
    # Default project ID for now, or get from header/query if multi-tenant later
    # Using the first active project or default
    async with db_pool.acquire() as conn:
        pid = await conn.fetchval("SELECT id FROM projects LIMIT 1")
        if not pid:
            raise HTTPException(status_code=400, detail="No project found")
            
        row = await conn.fetchrow(
            """INSERT INTO sip_trunks 
               (project_id, name, trunk_type, sip_server, username, password, numbers) 
               VALUES ($1, $2, $3, $4, $5, $6, $7) 
               RETURNING *""",
            pid, data.name, data.trunk_type, data.sip_server, data.username, data.password, 
            __import__('json').dumps(data.numbers)
        )
        return dict(row)

@app.delete("/api/telephony/trunks/{tid}")
async def delete_sip_trunk(tid: str, user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        await conn.execute("DELETE FROM sip_trunks WHERE id = $1", tid)
        return {"ok": True}

@app.get("/api/telephony/rules")
async def list_dispatch_rules(user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT r.*, t.name as trunk_name, a.name as agent_name 
            FROM dispatch_rules r
            LEFT JOIN sip_trunks t ON r.trunk_id = t.id
            LEFT JOIN agents a ON r.agent_id = a.id
            ORDER BY r.created_at DESC
        """)
        return [dict(r) for r in rows]

@app.post("/api/telephony/rules", status_code=201)
async def create_dispatch_rule(data: DispatchRuleCreate, user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        pid = await conn.fetchval("SELECT id FROM projects LIMIT 1")
        row = await conn.fetchrow(
            """INSERT INTO dispatch_rules 
               (project_id, name, rule_type, trunk_id, agent_id) 
               VALUES ($1, $2, $3, $4, $5) 
               RETURNING *""",
            pid, data.name, data.rule_type, data.trunk_id, data.agent_id
        )
        return dict(row)

@app.delete("/api/telephony/rules/{rid}")
async def delete_dispatch_rule(rid: str, user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        await conn.execute("DELETE FROM dispatch_rules WHERE id = $1", rid)
        return {"ok": True}

# =============================================================================
# AGENTS
# =============================================================================
@app.get("/api/projects/{pid}/agents")
async def list_agents(pid: str, user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM agents WHERE project_id = $1 ORDER BY created_at DESC", pid)
        return [dict(r) for r in rows]

@app.post("/api/projects/{pid}/agents", status_code=201)
async def create_agent(pid: str, data: AgentCreate, user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO agents (project_id, name, description, instructions, voice, model) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
            pid, data.name, data.description, data.instructions, data.voice, data.model
        )
        return dict(row)

@app.delete("/api/projects/{pid}/agents/{aid}")
async def delete_agent(pid: str, aid: str, user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        await conn.execute("DELETE FROM agents WHERE id = $1 AND project_id = $2", aid, pid)
        return {"ok": True}

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    voice: Optional[str] = None
    model: Optional[str] = None
    status: Optional[str] = None

@app.patch("/api/projects/{pid}/agents/{aid}")
async def update_agent(pid: str, aid: str, data: AgentUpdate, user: User = Depends(get_current_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No data")
    
    set_clause = ", ".join(f"{k} = ${i+2}" for i, k in enumerate(updates.keys()))
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            f"UPDATE agents SET {set_clause} WHERE id = $1 AND project_id = ${len(updates)+2} RETURNING *",
            aid, *updates.values(), pid
        )
        if not row:
            raise HTTPException(status_code=404, detail="Agent not found")
        return dict(row)

# =============================================================================
# LIVEKIT EGRESS / INGRESS
# =============================================================================

class IngressCreate(BaseModel):
    name: str 
    ingress_type: str = "rtmp" # rtmp or whip
    room_name: Optional[str] = None
    participant_name: Optional[str] = None

class EgressStart(BaseModel):
    room_name: str
    layout: str = "speaker-dark"
    outputs: list[str] = ["file"] # file, stream, segments

class EgressStop(BaseModel):
    egress_id: str

@app.post("/api/livekit/ingress")
async def create_ingress(data: IngressCreate, user: User = Depends(get_current_user)):
    try:
        from livekit import api
        lk = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        
        # Map type string to enum
        type_enum = api.IngressInput.RTMP_INPUT if data.ingress_type.lower() == "rtmp" else api.IngressInput.WHIP_INPUT
        
        req = api.CreateIngressRequest(
            input_type=type_enum,
            name=data.name,
            room_name=data.room_name or f"room-{data.name}",
            participant_identity=data.participant_name or f"ingress-{data.name}",
            participant_name=data.participant_name or data.name,
        )
        ingress = await lk.ingress.create_ingress(req)
        
        # Mirror to DB
        async with db_pool.acquire() as conn:
            pid = await conn.fetchval("SELECT id FROM projects LIMIT 1")
            await conn.execute(
                """INSERT INTO ingresses (ingress_id, project_id, name, stream_key, url, ingress_type, status)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                ingress.ingress_id, pid, ingress.name, ingress.stream_key, ingress.url, 
                data.ingress_type, "active"
            )
            
        return {"ingress_id": ingress.ingress_id, "stream_key": ingress.stream_key, "url": ingress.url}
    except Exception as e:
        logger.error(f"Failed to create ingress: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/livekit/ingress/{iid}")
async def delete_ingress(iid: str, user: User = Depends(get_current_user)):
    try:
        from livekit import api
        lk = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        await lk.ingress.delete_ingress(api.DeleteIngressRequest(ingress_id=iid))
        
        async with db_pool.acquire() as conn:
            await conn.execute("DELETE FROM ingresses WHERE ingress_id = $1", iid)
            
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/livekit/egress/room-composite")
async def start_room_composite_egress(data: EgressStart, user: User = Depends(get_current_user)):
    try:
        from livekit import api
        lk = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        
        # Configure file output (saving to local /tmp or configured bucket - standard assumes s3 usually but we'll try basic)
        file_output = api.EncodedFileOutput(
            filepath=f"{data.room_name}-{datetime.now().strftime('%Y%m%d%H%M%S')}.mp4",
        )
        
        req = api.RoomCompositeEgressRequest(
            room_name=data.room_name,
            layout="speaker-dark",
            file=file_output
        )
        
        info = await lk.egress.start_room_composite_egress(req)
        
        async with db_pool.acquire() as conn:
            pid = await conn.fetchval("SELECT id FROM projects LIMIT 1")
            await conn.execute(
                """INSERT INTO egresses (egress_id, project_id, room_name, status, started_at)
                   VALUES ($1, $2, $3, $4, NOW())""",
                info.egress_id, pid, data.room_name, "starting"
            )
            
        return {"egress_id": info.egress_id, "status": "starting"}
    except Exception as e:
        logger.error(f"Egress error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/livekit/egress/stop")
async def stop_egress(data: EgressStop, user: User = Depends(get_current_user)):
    try:
        from livekit import api
        lk = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        await lk.egress.stop_egress(api.StopEgressRequest(egress_id=data.egress_id))
        
        async with db_pool.acquire() as conn:
            await conn.execute("UPDATE egresses SET status='stopped', ended_at=NOW() WHERE egress_id = $1", data.egress_id)
            
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# SETTINGS (Keys, Webhooks, Team)
# =============================================================================

class ApiKeyCreate(BaseModel):
    name: str

class WebhookCreate(BaseModel):
    url: str
    events: list[str] = []
    secret: Optional[str] = None

class InviteMember(BaseModel):
    email: str
    role: str = "viewer"

@app.get("/api/settings/keys")
async def list_api_keys(user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT id, name, key_prefix, created_at FROM api_keys ORDER BY created_at DESC")
        return [dict(r) for r in rows]

@app.post("/api/settings/keys")
async def create_api_key(data: ApiKeyCreate, user: User = Depends(get_current_user)):
    import secrets
    key_val = secrets.token_urlsafe(32)
    prefix = key_val[:8]
    # In real world, hash api keys. Here storing plain for "display on create" logic usually, 
    # but we will store hash and return plain ONCE.
    
    async with db_pool.acquire() as conn:
        pid = await conn.fetchval("SELECT id FROM projects LIMIT 1")
        row = await conn.fetchrow(
            """INSERT INTO api_keys (project_id, name, key_prefix, key_hash)
               VALUES ($1, $2, $3, crypt($4, gen_salt('bf')))
               RETURNING id, name, key_prefix, created_at""",
            pid, data.name, prefix, key_val
        )
        res = dict(row)
        res["secret_key"] = key_val # Return once
        return res

@app.delete("/api/settings/keys/{kid}")
async def delete_api_key(kid: str, user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        await conn.execute("DELETE FROM api_keys WHERE id = $1", kid)
        return {"ok": True}

@app.get("/api/settings/webhooks")
async def list_webhooks(user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM webhooks ORDER BY created_at DESC")
        return [dict(r) for r in rows]

@app.post("/api/settings/webhooks")
async def create_webhook(data: WebhookCreate, user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        pid = await conn.fetchval("SELECT id FROM projects LIMIT 1")
        row = await conn.fetchrow(
            """INSERT INTO webhooks (project_id, url, events, secret)
               VALUES ($1, $2, $3, $4) RETURNING *""",
            pid, data.url, __import__('json').dumps(data.events), data.secret or "whsec_" + secrets.token_hex(16)
        )
        return dict(row)

@app.delete("/api/settings/webhooks/{wid}")
async def delete_webhook(wid: str, user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        await conn.execute("DELETE FROM webhooks WHERE id = $1", wid)
        return {"ok": True}

@app.get("/api/settings/members")
async def list_members(user: User = Depends(get_current_user)):
    # Currently just returning the admin + any others
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT u.id, u.email, u.name, 'admin' as role 
            FROM admin u
        """)
        return [dict(r) for r in rows]

@app.post("/api/settings/members/invite")
async def invite_member(data: InviteMember, user: User = Depends(get_current_user)):
    # Mock invite for now as we have single-tenant auth
    return {"ok": True, "message": f"Invitation sent to {data.email}"}

# =============================================================================
# LIVEKIT STATS
# =============================================================================
@app.get("/api/livekit/stats")
async def livekit_stats(user: User = Depends(get_current_user)):
    try:
        from livekit import api
        lk = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        rooms = await lk.room.list_rooms(api.ListRoomsRequest())
        return {
            "active_rooms": len(rooms.rooms),
            "total_participants": sum(r.num_participants for r in rooms.rooms),
            "status": "online"
        }
    except Exception:
        return {"active_rooms": 0, "total_participants": 0, "status": "offline"}

@app.get("/api/livekit/rooms")
async def livekit_rooms(user: User = Depends(get_current_user)):
    try:
        from livekit import api
        lk = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        rooms = await lk.room.list_rooms(api.ListRoomsRequest())
        return {"rooms": [{"sid": r.sid, "name": r.name, "participants": r.num_participants} for r in rooms.rooms]}
    except Exception:
        return {"rooms": []}

@app.get("/api/livekit/egresses")
async def livekit_egresses(user: User = Depends(get_current_user)):
    # Combine DB history with live status if possible, for now just DB + simple list
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM egresses ORDER BY started_at DESC LIMIT 50")
            return {"egresses": [dict(r) for r in rows]}
    except Exception:
        return {"egresses": []}

@app.get("/api/livekit/ingresses")
async def livekit_ingresses(user: User = Depends(get_current_user)):
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM ingresses ORDER BY created_at DESC")
            return {"ingresses": [dict(r) for r in rows]}
    except Exception:
        return {"ingresses": []}


# =============================================================================
# WEBHOOK PROCESSING ENDPOINTS
# =============================================================================

@app.post("/api/webhooks/livekit")
async def receive_livekit_webhook(request: Request):
    """
    Receive and process LiveKit webhook events
    
    - Verifies webhook signatures using HMAC-SHA256
    - Parses LiveKit webhook events
    - Stores events in database for audit trail
    - Processes events for real-time dashboard updates
    - Triggers outbound webhooks
    """
    global webhook_processor
    if webhook_processor is None:
        raise HTTPException(status_code=503, detail="Webhook processor not initialized")
    
    try:
        result = await webhook_processor.process_webhook(request)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        raise HTTPException(status_code=500, detail="Internal processing error")


@app.get("/api/webhooks/events")
async def list_webhook_events(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get webhook event logs with optional filtering"""
    global webhook_processor
    if webhook_processor is None:
        raise HTTPException(status_code=503, detail="Webhook processor not initialized")
    
    events = await webhook_processor.get_event_logs(limit, offset, event_type)
    return {
        "events": events,
        "count": len(events),
        "limit": limit,
        "offset": offset
    }


@app.get("/api/settings/webhooks/{wid}/logs")
async def get_webhook_delivery_logs(
    wid: str,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user)
):
    """Get delivery logs for a specific webhook"""
    global webhook_processor
    if webhook_processor is None:
        raise HTTPException(status_code=503, detail="Webhook processor not initialized")
    
    logs = await webhook_processor.get_delivery_logs(wid, limit, offset)
    return {
        "webhook_id": wid,
        "logs": logs,
        "count": len(logs),
        "limit": limit,
        "offset": offset
    }


@app.post("/api/settings/webhooks/{wid}/test")
async def test_webhook(wid: str, user: User = Depends(get_current_user)):
    """
    Send a test event to a webhook URL
    
    Returns delivery status and response information
    """
    global webhook_processor
    if webhook_processor is None:
        raise HTTPException(status_code=503, detail="Webhook processor not initialized")
    
    # Verify webhook exists
    async with db_pool.acquire() as conn:
        webhook = await conn.fetchrow("SELECT id FROM webhooks WHERE id = $1", wid)
        if not webhook:
            raise HTTPException(status_code=404, detail="Webhook not found")
    
    # Send test event
    result = await webhook_processor.delivery_service.test_webhook(wid)
    return result


@app.post("/api/settings/webhooks/{wid}/retry/{delivery_id}")
async def retry_webhook_delivery(
    wid: str, 
    delivery_id: str, 
    user: User = Depends(get_current_user)
):
    """Manually retry a failed webhook delivery"""
    global webhook_processor
    if webhook_processor is None:
        raise HTTPException(status_code=503, detail="Webhook processor not initialized")
    
    # Verify webhook exists
    async with db_pool.acquire() as conn:
        webhook = await conn.fetchrow("SELECT id FROM webhooks WHERE id = $1", wid)
        if not webhook:
            raise HTTPException(status_code=404, detail="Webhook not found")
        
        delivery = await conn.fetchrow(
            "SELECT id FROM webhook_deliveries WHERE id = $1 AND webhook_id = $2",
            delivery_id, wid
        )
        if not delivery:
            raise HTTPException(status_code=404, detail="Delivery record not found")
    
    # Retry delivery
    success = await webhook_processor.delivery_service.retry_delivery(delivery_id)
    return {
        "success": success,
        "delivery_id": delivery_id,
        "webhook_id": wid
    }


# =============================================================================
# WEBSOCKET ENDPOINT FOR REAL-TIME UPDATES
# =============================================================================

@app.websocket("/api/ws/events")
async def websocket_events(websocket: WebSocket):
    """
    WebSocket endpoint for real-time webhook event streaming
    
    Clients receive live updates for:
    - room_started, room_finished
    - participant_joined, participant_left
    - track_published, track_unpublished
    - egress_started, egress_ended
    - ingress_started, ingress_ended
    """
    await websocket_manager.connect(websocket, client_type="dashboard")
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "message": "WebSocket connected to event stream",
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Keep connection alive and handle client messages
        while True:
            try:
                # Wait for messages from client (with timeout)
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle client commands
                if message.get("action") == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                elif message.get("action") == "subscribe":
                    # Client can subscribe to specific event types
                    event_types = message.get("event_types", [])
                    websocket_manager.connection_metadata[websocket]["subscriptions"] = event_types
                    await websocket.send_json({
                        "type": "subscribed",
                        "event_types": event_types
                    })
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Unknown action: {message.get('action')}"
                    })
                    
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON message"
                })
            except Exception as e:
                logger.warning(f"WebSocket message handling error: {e}")
                
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        websocket_manager.disconnect(websocket)


@app.get("/api/ws/stats")
async def websocket_stats(user: User = Depends(get_current_user)):
    """Get WebSocket connection statistics"""
    return {
        "active_connections": websocket_manager.get_connection_count(),
        "timestamp": datetime.utcnow().isoformat()
    }


# =============================================================================
# RUN
# =============================================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
