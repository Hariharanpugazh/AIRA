-- =============================================================================
-- Webhook Processing System Schema
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

-- =============================================================================
-- Webhook Event Statistics View
-- =============================================================================
CREATE OR REPLACE VIEW webhook_event_stats AS
SELECT 
    event_type,
    COUNT(*) as event_count,
    COUNT(*) FILTER (WHERE processed) as processed_count,
    COUNT(*) FILTER (WHERE NOT processed) as unprocessed_count,
    MAX(received_at) as last_received
FROM webhook_events
GROUP BY event_type;

-- =============================================================================
-- Webhook Delivery Statistics View
-- =============================================================================
CREATE OR REPLACE VIEW webhook_delivery_stats AS
SELECT 
    webhook_id,
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'delivered') as successful_deliveries,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_deliveries,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_deliveries,
    AVG(retry_count) as avg_retries,
    MAX(delivered_at) as last_delivered
FROM webhook_deliveries
GROUP BY webhook_id;
