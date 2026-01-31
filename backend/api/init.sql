-- =============================================================================
-- LiveKit Admin Database Schema
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Admin (single user)
CREATE TABLE IF NOT EXISTS admin (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) DEFAULT 'Admin',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert admin (admin@admin.com / Admin@2026)
INSERT INTO admin (email, password_hash, name)
VALUES ('admin@admin.com', crypt('Admin@2026', gen_salt('bf', 12)), 'Administrator')
ON CONFLICT (email) DO NOTHING;

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default project
INSERT INTO projects (name, description)
SELECT 'Default Project', 'Your first project'
WHERE NOT EXISTS (SELECT 1 FROM projects LIMIT 1);

-- AI Config
CREATE TABLE IF NOT EXISTS ai_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    stt_mode VARCHAR(50) DEFAULT 'hybrid',
    stt_provider VARCHAR(50) DEFAULT 'deepgram',
    tts_mode VARCHAR(50) DEFAULT 'hybrid',
    tts_provider VARCHAR(50) DEFAULT 'cartesia',
    llm_mode VARCHAR(50) DEFAULT 'hybrid',
    llm_provider VARCHAR(50) DEFAULT 'openai',
    api_keys JSONB DEFAULT '{}'::jsonb,
    UNIQUE(project_id)
);

-- Agents
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    voice VARCHAR(100) DEFAULT 'alloy',
    model VARCHAR(100) DEFAULT 'gpt-4o-mini',
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agents_project ON agents(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_config_project ON ai_config(project_id);

-- SIP Trunks
CREATE TABLE IF NOT EXISTS sip_trunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    trunk_type VARCHAR(50) DEFAULT 'inbound', -- inbound, outbound
    sip_server VARCHAR(255),
    username VARCHAR(255),
    password VARCHAR(255),
    numbers JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SIP Dispatch Rules
CREATE TABLE IF NOT EXISTS dispatch_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) DEFAULT 'direct', -- direct, individual
    trunk_id UUID REFERENCES sip_trunks(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Egress History
CREATE TABLE IF NOT EXISTS egresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    egress_id VARCHAR(255) NOT NULL, -- LiveKit ID
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    room_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    file_url TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Ingress
CREATE TABLE IF NOT EXISTS ingresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingress_id VARCHAR(255) NOT NULL, -- LiveKit ID
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255),
    stream_key VARCHAR(255),
    url VARCHAR(255),
    ingress_type VARCHAR(50) DEFAULT 'rtmp', -- rtmp, whip
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    key_prefix VARCHAR(10) NOT NULL,
    key_hash VARCHAR(255) NOT NULL, -- partial or hashed
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    url VARCHAR(255) NOT NULL,
    events JSONB DEFAULT '[]'::jsonb,
    secret VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team Members
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES admin(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'viewer',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- =============================================================================
-- RBAC SYSTEM TABLES
-- =============================================================================

-- Roles - Role definitions with permissions
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_system BOOLEAN DEFAULT FALSE, -- Cannot delete system roles
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Roles - User to role assignments
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES admin(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

-- Invitations - Pending team invitations with tokens
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    role_ids UUID[] DEFAULT '{}',
    invited_by UUID REFERENCES admin(id) ON DELETE SET NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by UUID REFERENCES admin(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, expired, revoked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Sessions - Track active sessions for audit
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL, -- Hash of JWT token for validation
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Audit Log - Security events tracking
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES admin(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- DEFAULT ROLES WITH PERMISSIONS
-- =============================================================================

-- Super Admin: All permissions
INSERT INTO roles (name, description, permissions, is_system)
VALUES (
    'Super Admin',
    'Full system access with all permissions',
    '[
        "room:list", "room:create", "room:delete", "room:view:details", "room:update:metadata",
        "participant:list", "participant:view", "participant:remove", "participant:mute", "participant:unmute",
        "track:view", "track:mute:self", "track:mute:admin", "track:publish", "track:subscribe",
        "egress:start", "egress:stop", "egress:list", "egress:view", "egress:delete",
        "ingress:create", "ingress:delete", "ingress:list", "ingress:view",
        "agent:deploy", "agent:update", "agent:terminate", "agent:logs:view", "agent:list", "agent:view",
        "sip:trunk:manage", "sip:dispatch:manage", "sip:call:manage",
        "project:settings:read", "project:settings:write", "admin:users:manage", "admin:roles:manage",
        "webhook:manage", "apikey:manage"
    ]'::jsonb,
    TRUE
)
ON CONFLICT (name) DO UPDATE SET 
    permissions = EXCLUDED.permissions,
    description = EXCLUDED.description;

-- Admin: All except user management
INSERT INTO roles (name, description, permissions, is_system)
VALUES (
    'Admin',
    'Administrative access without user management',
    '[
        "room:list", "room:create", "room:delete", "room:view:details", "room:update:metadata",
        "participant:list", "participant:view", "participant:remove", "participant:mute", "participant:unmute",
        "track:view", "track:mute:self", "track:mute:admin", "track:publish", "track:subscribe",
        "egress:start", "egress:stop", "egress:list", "egress:view", "egress:delete",
        "ingress:create", "ingress:delete", "ingress:list", "ingress:view",
        "agent:deploy", "agent:update", "agent:terminate", "agent:logs:view", "agent:list", "agent:view",
        "sip:trunk:manage", "sip:dispatch:manage", "sip:call:manage",
        "project:settings:read", "project:settings:write", "admin:roles:view",
        "webhook:manage", "apikey:manage"
    ]'::jsonb,
    TRUE
)
ON CONFLICT (name) DO UPDATE SET 
    permissions = EXCLUDED.permissions,
    description = EXCLUDED.description;

-- Editor: Room operations, egress operations, agent operations
INSERT INTO roles (name, description, permissions, is_system)
VALUES (
    'Editor',
    'Can manage rooms, egress, and agents',
    '[
        "room:list", "room:create", "room:view:details", "room:update:metadata",
        "participant:list", "participant:view", "participant:mute", "participant:unmute",
        "track:view", "track:mute:self", "track:publish", "track:subscribe",
        "egress:start", "egress:stop", "egress:list", "egress:view",
        "ingress:list", "ingress:view",
        "agent:deploy", "agent:update", "agent:terminate", "agent:logs:view", "agent:list", "agent:view",
        "project:settings:read"
    ]'::jsonb,
    TRUE
)
ON CONFLICT (name) DO UPDATE SET 
    permissions = EXCLUDED.permissions,
    description = EXCLUDED.description;

-- Viewer: Read-only access
INSERT INTO roles (name, description, permissions, is_system)
VALUES (
    'Viewer',
    'Read-only access to view resources',
    '[
        "room:list", "room:view:details",
        "participant:list", "participant:view",
        "track:view", "track:subscribe",
        "egress:list", "egress:view",
        "ingress:list", "ingress:view",
        "agent:list", "agent:view", "agent:logs:view",
        "project:settings:read"
    ]'::jsonb,
    TRUE
)
ON CONFLICT (name) DO UPDATE SET 
    permissions = EXCLUDED.permissions,
    description = EXCLUDED.description;

-- Support: Participant management only
INSERT INTO roles (name, description, permissions, is_system)
VALUES (
    'Support',
    'Can manage participants and view rooms',
    '[
        "room:list", "room:view:details",
        "participant:list", "participant:view", "participant:remove", "participant:mute", "participant:unmute",
        "track:view", "track:mute:admin",
        "project:settings:read"
    ]'::jsonb,
    TRUE
)
ON CONFLICT (name) DO UPDATE SET 
    permissions = EXCLUDED.permissions,
    description = EXCLUDED.description;

-- Assign Super Admin role to default admin user (if not already assigned)
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT 
    a.id,
    r.id,
    a.id
FROM admin a
CROSS JOIN roles r
WHERE a.email = 'admin@admin.com' AND r.name = 'Super Admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Existing indexes
CREATE INDEX IF NOT EXISTS idx_sip_trunks_project ON sip_trunks(project_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_project ON dispatch_rules(project_id);
CREATE INDEX IF NOT EXISTS idx_egresses_project ON egresses(project_id);
CREATE INDEX IF NOT EXISTS idx_ingresses_project ON ingresses(project_id);
CREATE INDEX IF NOT EXISTS idx_keys_project ON api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_project ON webhooks(project_id);

-- RBAC indexes
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires ON invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_email ON admin(email);
CREATE INDEX IF NOT EXISTS idx_admin_active ON admin(is_active);

-- GIN indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_roles_permissions ON roles USING GIN (permissions);

-- =============================================================================
-- WEBHOOK PROCESSING SYSTEM SCHEMA
-- =============================================================================

-- Table for storing received webhook events from LiveKit
CREATE TABLE IF NOT EXISTS webhook_events (
    id VARCHAR(255) PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    room_sid VARCHAR(255),
    room_name VARCHAR(255),
    participant_sid VARCHAR(255),
    participant_identity VARCHAR(255),
    track_sid VARCHAR(255),
    egress_id VARCHAR(255),
    ingress_id VARCHAR(255),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed BOOLEAN DEFAULT FALSE,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for webhook delivery logs (outbound webhooks)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id VARCHAR(255) PRIMARY KEY,
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'pending', -- pending, delivered, failed
    response_code INTEGER,
    response_body TEXT,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for webhook_events
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_room ON webhook_events(room_sid);
CREATE INDEX IF NOT EXISTS idx_webhook_events_participant ON webhook_events(participant_identity);
CREATE INDEX IF NOT EXISTS idx_webhook_events_egress ON webhook_events(egress_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_ingress ON webhook_events(ingress_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);

-- Indexes for webhook_deliveries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_type ON webhook_deliveries(event_type);
