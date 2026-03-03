-- Fix LiveKit Ingress, Egress, and SIP tracking
-- This migration adds missing fields required for proper tracking

-- ============================================
-- INGRESS TABLE FIXES
-- ============================================

-- Add missing fields to ingress table for proper tracking
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "participant_identity" TEXT;
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "participant_name" TEXT;
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "resource_id" TEXT;
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "room_id" TEXT;
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "reusable" BOOLEAN DEFAULT false;
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'endpoint_inactive';
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(6);
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "ended_at" TIMESTAMP(6);
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "error" TEXT;
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "audio_codec" TEXT;
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "video_codec" TEXT;
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "audio_bitrate" INTEGER;
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "video_bitrate" INTEGER;
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "video_resolution" TEXT;
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "track_count" INTEGER DEFAULT 0;
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "track_sids" TEXT;
ALTER TABLE "ingress" ADD COLUMN IF NOT EXISTS "user_id" TEXT;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS "idx_ingress_status" ON "ingress"("status");
CREATE INDEX IF NOT EXISTS "idx_ingress_participant_identity" ON "ingress"("participant_identity");
CREATE INDEX IF NOT EXISTS "idx_ingress_resource_id" ON "ingress"("resource_id");
CREATE INDEX IF NOT EXISTS "idx_ingress_user_id" ON "ingress"("user_id");
CREATE INDEX IF NOT EXISTS "idx_ingress_started_at" ON "ingress"("started_at");

-- ============================================
-- EGRESS TABLE FIXES
-- ============================================

-- Add missing fields to egress table for proper tracking
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "egress_id" TEXT;
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "room_id" TEXT;
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "source_type" TEXT DEFAULT 'room_composite';
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "status_detail" TEXT;
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(6);
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "ended_at" TIMESTAMP(6);
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "error_code" TEXT;
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "error_message" TEXT;
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "file_results" TEXT; -- JSON string
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "stream_results" TEXT; -- JSON string
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "segment_results" TEXT; -- JSON string
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "image_results" TEXT; -- JSON string
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "layout" TEXT;
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "audio_only" BOOLEAN DEFAULT false;
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "video_only" BOOLEAN DEFAULT false;
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "participant_identity" TEXT;
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "track_id" TEXT;
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "web_url" TEXT;
ALTER TABLE "egress" ADD COLUMN IF NOT EXISTS "user_id" TEXT;

-- Add unique constraint on egress_id if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'egress_egress_id_key'
    ) THEN
        ALTER TABLE "egress" ADD CONSTRAINT "egress_egress_id_key" UNIQUE ("egress_id");
    END IF;
EXCEPTION WHEN duplicate_table THEN
    NULL;
END $$;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS "idx_egress_egress_id" ON "egress"("egress_id");
CREATE INDEX IF NOT EXISTS "idx_egress_room_id" ON "egress"("room_id");
CREATE INDEX IF NOT EXISTS "idx_egress_source_type" ON "egress"("source_type");
CREATE INDEX IF NOT EXISTS "idx_egress_participant_identity" ON "egress"("participant_identity");
CREATE INDEX IF NOT EXISTS "idx_egress_track_id" ON "egress"("track_id");
CREATE INDEX IF NOT EXISTS "idx_egress_user_id" ON "egress"("user_id");
CREATE INDEX IF NOT EXISTS "idx_egress_started_at" ON "egress"("started_at");
CREATE INDEX IF NOT EXISTS "idx_egress_status_detail" ON "egress"("status_detail");

-- ============================================
-- CALL LOGS TABLE FIXES
-- ============================================

-- Add missing fields to call_logs table for proper tracking
ALTER TABLE "call_logs" ADD COLUMN IF NOT EXISTS "sip_call_id" TEXT;
ALTER TABLE "call_logs" ADD COLUMN IF NOT EXISTS "participant_identity" TEXT;
ALTER TABLE "call_logs" ADD COLUMN IF NOT EXISTS "room_sid" TEXT;
ALTER TABLE "call_logs" ADD COLUMN IF NOT EXISTS "from_sip_uri" TEXT;
ALTER TABLE "call_logs" ADD COLUMN IF NOT EXISTS "to_sip_uri" TEXT;
ALTER TABLE "call_logs" ADD COLUMN IF NOT EXISTS "hangup_cause" TEXT;
ALTER TABLE "call_logs" ADD COLUMN IF NOT EXISTS "hangup_source" TEXT;
ALTER TABLE "call_logs" ADD COLUMN IF NOT EXISTS "recording_url" TEXT;
ALTER TABLE "call_logs" ADD COLUMN IF NOT EXISTS "recording_duration" INTEGER;
ALTER TABLE "call_logs" ADD COLUMN IF NOT EXISTS "user_id" TEXT;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS "idx_call_logs_sip_call_id" ON "call_logs"("sip_call_id");
CREATE INDEX IF NOT EXISTS "idx_call_logs_participant_identity" ON "call_logs"("participant_identity");
CREATE INDEX IF NOT EXISTS "idx_call_logs_room_sid" ON "call_logs"("room_sid");
CREATE INDEX IF NOT EXISTS "idx_call_logs_user_id" ON "call_logs"("user_id");
CREATE INDEX IF NOT EXISTS "idx_call_logs_status" ON "call_logs"("status");

-- ============================================
-- WEBHOOK EVENTS TABLE FIXES
-- ============================================

-- Add fields to webhook_events for better tracking
ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "session_id" TEXT;
ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "room_name" TEXT;
ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "participant_identity" TEXT;
ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "egress_id" TEXT;
ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "ingress_id" TEXT;
ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "call_id" TEXT;
ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "sip_call_id" TEXT;

-- Add indexes
CREATE INDEX IF NOT EXISTS "idx_webhook_events_session_id" ON "webhook_events"("session_id");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_room_name" ON "webhook_events"("room_name");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_egress_id" ON "webhook_events"("egress_id");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_ingress_id" ON "webhook_events"("ingress_id");
