import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { WebhookReceiver, type WebhookEvent } from "livekit-server-sdk";
import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { broadcastEvent } from "@/app/api/sse/route";

import { extractProjectIdFromRoom, getCountryFromIp } from "@/lib/server/session-utils";

function verifyHmacSignature(signature: string, body: string) {
  const hmac = createHmac("sha256", serverEnv.LIVEKIT_API_SECRET);
  hmac.update(body);
  const expected = `sha256=${hmac.digest("base64")}`;

  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

// Helper to safely extract string from webhook payload
function getString(obj: unknown, key: string): string {
  if (obj && typeof obj === "object" && key in obj) {
    const val = (obj as Record<string, unknown>)[key];
    return typeof val === "string" ? val : "";
  }
  return "";
}

// Helper to safely extract nested object from webhook payload
function getObject(obj: unknown, key: string): Record<string, unknown> | null {
  if (obj && typeof obj === "object" && key in obj) {
    const val = (obj as Record<string, unknown>)[key];
    return typeof val === "object" && val !== null ? val as Record<string, unknown> : null;
  }
  return null;
}

// Helper to safely extract array from webhook payload
function getArray(obj: unknown, key: string): unknown[] {
  if (obj && typeof obj === "object" && key in obj) {
    const val = (obj as Record<string, unknown>)[key];
    return Array.isArray(val) ? val : [];
  }
  return [];
}

// Extract egress results from webhook payload
function extractEgressResults(egress: Record<string, unknown>) {
  const results: {
    fileResults?: Array<{ filename?: string; location?: string; duration?: number; size?: number }>;
    streamResults?: Array<{ url?: string; duration?: number; status?: string }>;
    segmentResults?: Array<{ playlistName?: string; duration?: number; size?: number }>;
    imageResults?: Array<{ filename?: string; location?: string; capturedAt?: number }>;
  } = {};

  // File results
  const fileResults = getArray(egress, "fileResults");
  if (fileResults.length > 0) {
    results.fileResults = fileResults.map((f: unknown) => ({
      filename: getString(f as Record<string, unknown>, "filename"),
      location: getString(f as Record<string, unknown>, "location"),
      duration: (f as Record<string, unknown>).duration as number | undefined,
      size: (f as Record<string, unknown>).size as number | undefined,
    }));
  }

  // Stream results
  const streamResults = getArray(egress, "streamResults");
  if (streamResults.length > 0) {
    results.streamResults = streamResults.map((s: unknown) => ({
      url: getString(s as Record<string, unknown>, "url"),
      duration: (s as Record<string, unknown>).duration as number | undefined,
      status: getString(s as Record<string, unknown>, "status"),
    }));
  }

  // Segment results (HLS)
  const segmentResults = getArray(egress, "segmentResults");
  if (segmentResults.length > 0) {
    results.segmentResults = segmentResults.map((s: unknown) => ({
      playlistName: getString(s as Record<string, unknown>, "playlistName"),
      duration: (s as Record<string, unknown>).duration as number | undefined,
      size: (s as Record<string, unknown>).size as number | undefined,
    }));
  }

  // Image results
  const imageResults = getArray(egress, "imageResults");
  if (imageResults.length > 0) {
    results.imageResults = imageResults.map((i: unknown) => ({
      filename: getString(i as Record<string, unknown>, "filename"),
      location: getString(i as Record<string, unknown>, "location"),
      capturedAt: (i as Record<string, unknown>).capturedAt as number | undefined,
    }));
  }

  return results;
}

// Extract ingress state from webhook payload
function extractIngressState(ingress: Record<string, unknown>) {
  const state = getObject(ingress, "state");
  if (!state) return null;

  return {
    status: getString(state, "status"),
    error: getString(state, "error"),
    roomId: getString(state, "roomId"),
    startedAt: (state.startedAt as number) || null,
    endedAt: (state.endedAt as number) || null,
    resourceId: getString(state, "resourceId"),
    tracks: getArray(state, "tracks").map((t: unknown) => getString(t as Record<string, unknown>, "sid")),
    audioCodec: getString(state, "audioCodec"),
    videoCodec: getString(state, "videoCodec"),
    audioBitrate: (state.audioBitrate as number) || null,
    videoBitrate: (state.videoBitrate as number) || null,
    videoResolution: state.videoHeight && state.videoWidth
      ? `${state.videoWidth}x${state.videoHeight}`
      : null,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const authHeader = request.headers.get("authorization") || undefined;
  const signature = request.headers.get("x-livekit-signature");

  let payload: Record<string, unknown> = {};

  try {
    if (authHeader) {
      const receiver = new WebhookReceiver(
        serverEnv.LIVEKIT_API_KEY,
        serverEnv.LIVEKIT_API_SECRET,
      );
      payload = await receiver.receive(body, authHeader) as unknown as Record<string, unknown>;
    } else if (signature) {
      const ok = verifyHmacSignature(signature, body);
      if (!ok) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      payload = JSON.parse(body) as Record<string, unknown>;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch (error) {
    console.error("[Webhook] Authentication failed:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventType = String(payload.event || "unknown");
  const eventId = randomUUID();

  // Extract common tracking fields
  const room = getObject(payload, "room");
  const roomName = room ? getString(room, "name") : "";
  const roomSid = room ? getString(room, "sid") : "";
  const projectId = roomName ? extractProjectIdFromRoom(roomName) : null;

  const participant = getObject(payload, "participant");
  const participantIdentity = participant ? getString(participant, "identity") : "";

  const egress = getObject(payload, "egress");
  const egressId = egress ? getString(egress, "egressId") : "";

  const ingress = getObject(payload, "ingress");
  const ingressId = ingress ? getString(ingress, "ingressId") : "";

  // Store webhook event with tracking fields
  await query(
    `
      INSERT INTO webhook_events (
        id, event_type, payload, processed, delivery_attempts, created_at,
        session_id, room_name, participant_identity, egress_id, ingress_id
      )
      VALUES ($1, $2, $3, false, 0, NOW(), $4, $5, $6, $7, $8)
    `,
    [eventId, eventType, body, roomSid, roomName, participantIdentity, egressId, ingressId],
  );

  try {
    switch (eventType) {
      // ==================== ROOM EVENTS ====================
      case "room_started": {
        if (roomName && roomSid) {
          await query(
            `
              INSERT INTO sessions (
                sid, room_name, status, start_time, project_id, created_at
              )
              VALUES ($1, $2, 'active', NOW(), $3, NOW())
              ON CONFLICT (sid) DO UPDATE
              SET status = 'active', start_time = NOW(), end_time = NULL
            `,
            [roomSid, roomName, projectId],
          );

          // Broadcast SSE event
          broadcastEvent("room_started", { roomSid, roomName, projectId, eventId }, projectId || undefined);
        }
        break;
      }

      case "room_finished": {
        if (roomName) {
          await query(
            `
              UPDATE sessions
              SET status = 'finished',
                  end_time = NOW(),
                  active_participants = 0,
                  duration = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - start_time))::int)
              WHERE room_name = $1 AND status = 'active'
            `,
            [roomName],
          );

          // Broadcast SSE event
          broadcastEvent("room_finished", { roomName, projectId, eventId }, projectId || undefined);
        }
        break;
      }

      // ==================== PARTICIPANT EVENTS ====================
      case "participant_joined": {
        if (roomSid && participantIdentity) {
          const clientInfo = getObject(participant, "client") || {};
          const platform = getString(clientInfo, "os").toLowerCase();
          const browser = getString(clientInfo, "browser").toLowerCase();
          const address = getString(clientInfo, "address");
          const country = address ? await getCountryFromIp(address) : null;
          const participantSid = getString(participant, "sid");

          // Check if this is a SIP participant
          const isSip = participantIdentity.startsWith("sip-") || getString(participant, "kind") === "SIP";
          const sipCallId = getString(participant, "sipCallId");

          await query(
            `
              INSERT INTO participant_records(
                id, session_id, identity, status, joined_at, platform, browser, project_id, country
              )
              VALUES($1, $2, $3, 'active', NOW(), $4, $5, $6, $7)
              ON CONFLICT DO NOTHING
            `,
            [randomUUID(), roomSid, participantIdentity, platform, browser, projectId, country],
          );

          await query(
            `
              UPDATE sessions
              SET total_participants = total_participants + 1,
                  active_participants = active_participants + 1
              WHERE sid = $1
            `,
            [roomSid],
          );

          // Track Agent Room Entry
          if (participantIdentity.startsWith("agent_")) {
            const agentRow = await query<{ id: string }>(
              "SELECT id FROM agents WHERE agent_id = $1 LIMIT 1",
              [participantIdentity]
            );
            if (agentRow.rows[0]) {
              const attributes = getObject(participant, "attributes") || {};
              const instanceId = getString(attributes, "AGENT_INSTANCE_ID");

              let internalInstanceId: string | null = null;
              if (instanceId) {
                const instRes = await query<{ id: string }>("SELECT id FROM agent_instances WHERE instance_id = $1 LIMIT 1", [instanceId]);
                internalInstanceId = instRes.rows[0]?.id || null;
              }

              await query(
                `
                  INSERT INTO agent_rooms (
                    id, agent_id, instance_id, room_name, joined_at, created_at
                  )
                  VALUES ($1, $2, $3, $4, NOW(), NOW())
                `,
                [randomUUID(), agentRow.rows[0].id, internalInstanceId, roomName]
              );
            }
          }

          // Update call logs for SIP participants
          if (isSip || sipCallId) {
            const callId = sipCallId || participantIdentity;
            await query(
              `
                UPDATE call_logs
                SET status = 'active',
                    room_sid = $1,
                    participant_identity = $2
                WHERE (sip_call_id = $3 OR call_id = $3 OR participant_identity = $2)
                  AND status IN ('ringing', 'connecting')
              `,
              [roomSid, participantIdentity, callId]
            );
          }
        }
        break;
      }

      case "participant_left": {
        if (roomSid && participantIdentity) {
          const duration = participant ? (participant.duration as number) || 0 : 0;

          await query(
            `
              UPDATE participant_records
              SET status = 'left', left_at = NOW(), duration = $3
              WHERE session_id = $1 AND identity = $2 AND status = 'active'
            `,
            [roomSid, participantIdentity, duration],
          );

          await query(
            `
              UPDATE sessions
              SET active_participants = GREATEST(0, active_participants - 1)
              WHERE sid = $1
            `,
            [roomSid],
          );

          // Track Agent Room Exit
          if (participantIdentity.startsWith("agent_")) {
            const agentRow = await query<{ id: string }>(
              "SELECT id FROM agents WHERE agent_id = $1 LIMIT 1",
              [participantIdentity]
            );
            if (agentRow.rows[0]) {
              await query(
                `
                  UPDATE agent_rooms
                  SET left_at = NOW()
                  WHERE agent_id = $1 AND room_name = $2 AND left_at IS NULL
                `,
                [agentRow.rows[0].id, roomName]
              );
            }
          }

          // Update call logs for SIP participants
          const isSip = participantIdentity.startsWith("sip-") || getString(participant, "kind") === "SIP";
          if (isSip) {
            await query(
              `
                UPDATE call_logs
                SET status = 'ended',
                    ended_at = NOW(),
                    duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::int)
                WHERE participant_identity = $1
                  AND status IN ('active', 'ringing')
              `,
              [participantIdentity]
            );
          }
        }
        break;
      }

      // ==================== EGRESS EVENTS ====================
      case "egress_started": {
        if (egressId && egress) {
          const egressRoomName = getString(egress, "roomName") || roomName;
          const egressProjectId = egressRoomName ? extractProjectIdFromRoom(egressRoomName) : projectId;
          const status = getString(egress, "status");
          const egressType = getString(egress, "egressType");
          const roomId = getString(egress, "roomId");
          const startedAt = (egress.startedAt as number) || Date.now();

          // Determine source type
          let sourceType = "room_composite";
          let participantIdentity = "";
          let trackId = "";
          let webUrl = "";

          if (egress.web) {
            sourceType = "web";
            webUrl = getString(egress.web as Record<string, unknown>, "url");
          } else if (egress.track) {
            sourceType = "track";
            trackId = getString(egress.track as Record<string, unknown>, "trackId");
          } else if (egress.trackComposite) {
            sourceType = "track_composite";
            participantIdentity = getString(egress.trackComposite as Record<string, unknown>, "participantIdentity");
          } else if (egress.participant) {
            sourceType = "participant";
            participantIdentity = getString(egress.participant as Record<string, unknown>, "participantIdentity");
          }

          await query(
            `
              INSERT INTO egress (
                id, egress_id, name, egress_type, source_type, room_name, room_id,
                is_active, status_detail, started_at, project_id,
                participant_identity, track_id, web_url
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, to_timestamp($9 / 1000.0), $10, $11, $12, $13)
              ON CONFLICT (egress_id) DO UPDATE
              SET is_active = true,
                  status_detail = $8,
                  started_at = to_timestamp($9 / 1000.0),
                  updated_at = NOW()
            `,
            [
              randomUUID(), egressId, getString(egress, "egressName") || egressId,
              egressType, sourceType, egressRoomName, roomId,
              status, startedAt, egressProjectId,
              participantIdentity, trackId, webUrl
            ],
          );

          // Broadcast SSE event
          broadcastEvent("egress_started", {
            egressId, roomName: egressRoomName, egressType, sourceType, status, projectId: egressProjectId
          }, egressProjectId || undefined);
        }
        break;
      }

      case "egress_updated": {
        if (egressId && egress) {
          const status = getString(egress, "status");
          const updatedAt = (egress.updatedAt as number) || Date.now();

          await query(
            `
              UPDATE egress
              SET status_detail = $1,
                  updated_at = to_timestamp($2 / 1000.0)
              WHERE egress_id = $3
            `,
            [status, updatedAt, egressId],
          );
        }
        break;
      }

      case "egress_ended": {
        if (egressId && egress) {
          const status = getString(egress, "status");
          const endedAt = (egress.endedAt as number) || Date.now();
          const error = getString(egress, "error");
          const errorCode = getString(egress, "errorCode");

          // Extract all output results
          const results = extractEgressResults(egress);

          // Get primary output URL
          let outputUrl = "";
          if (results.fileResults && results.fileResults.length > 0) {
            outputUrl = results.fileResults[0].location || results.fileResults[0].filename || "";
          } else if (results.streamResults && results.streamResults.length > 0) {
            outputUrl = results.streamResults[0].url || "";
          } else if (results.segmentResults && results.segmentResults.length > 0) {
            outputUrl = results.segmentResults[0].playlistName || "";
          }

          await query(
            `
              UPDATE egress
              SET is_active = false,
                  status_detail = $1,
                  ended_at = to_timestamp($2 / 1000.0),
                  error_message = $3,
                  error_code = $4,
                  output_url = $5,
                  file_results = $6,
                  stream_results = $7,
                  segment_results = $8,
                  image_results = $9,
                  updated_at = NOW()
              WHERE egress_id = $10
            `,
            [
              status, endedAt, error, errorCode, outputUrl,
              results.fileResults ? JSON.stringify(results.fileResults) : null,
              results.streamResults ? JSON.stringify(results.streamResults) : null,
              results.segmentResults ? JSON.stringify(results.segmentResults) : null,
              results.imageResults ? JSON.stringify(results.imageResults) : null,
              egressId
            ],
          );

          // Broadcast SSE event for completed recording
          broadcastEvent("egress_ended", {
            egressId,
            status,
            outputUrl,
            fileResults: results.fileResults,
            error,
            projectId
          }, projectId || undefined);
        }
        break;
      }

      // ==================== INGRESS EVENTS ====================
      case "ingress_started": {
        if (ingressId && ingress) {
          const ingressRoomName = getString(ingress, "roomName") || roomName;
          const ingressProjectId = ingressRoomName ? extractProjectIdFromRoom(ingressRoomName) : projectId;
          const inputType = getString(ingress, "inputType");
          const name = getString(ingress, "name");
          const streamKey = getString(ingress, "streamKey");
          const url = getString(ingress, "url");
          const participantIdentity = getString(ingress, "participantIdentity");
          const participantName = getString(ingress, "participantName");
          const reusable = (ingress.reusable as boolean) || false;
          const roomId = getString(ingress, "roomId");
          const resourceId = getString(ingress, "resourceId");

          // Extract state info if available
          const state = extractIngressState(ingress);

          await query(
            `
              INSERT INTO ingress (
                id, name, input_type, room_name, stream_key, url,
                participant_identity, participant_name, reusable,
                room_id, resource_id, status, started_at, project_id,
                is_enabled, error, track_count, track_sids
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                      to_timestamp($13 / 1000.0), $14, true, $15, $16, $17)
              ON CONFLICT (id) DO UPDATE
              SET status = $12,
                  started_at = COALESCE(ingress.started_at, to_timestamp($13 / 1000.0)),
                  room_id = $10,
                  resource_id = $11,
                  updated_at = NOW()
            `,
            [
              ingressId, name || ingressId, inputType, ingressRoomName, streamKey, url,
              participantIdentity, participantName, reusable,
              roomId || roomSid, resourceId,
              state?.status || "endpoint_publishing",
              state?.startedAt || Date.now(),
              ingressProjectId,
              state?.error || null,
              state?.tracks?.length || 0,
              state?.tracks ? JSON.stringify(state.tracks) : null
            ],
          );
        }
        break;
      }

      case "ingress_ended": {
        if (ingressId && ingress) {
          const state = extractIngressState(ingress);
          const endedAt = state?.endedAt || Date.now();

          await query(
            `
              UPDATE ingress
              SET status = $1,
                  ended_at = to_timestamp($2 / 1000.0),
                  error = $3,
                  track_count = $4,
                  updated_at = NOW()
              WHERE id = $5
            `,
            [
              state?.status || "endpoint_complete",
              endedAt,
              state?.error || null,
              state?.tracks?.length || 0,
              ingressId
            ],
          );
        }
        break;
      }

      // ==================== TRACK EVENTS (for ingress media stats) ====================
      case "track_published": {
        const track = getObject(payload, "track");
        if (track && ingressId) {
          const mimeType = getString(track, "mimeType");
          const isVideo = mimeType.startsWith("video/");
          const isAudio = mimeType.startsWith("audio/");

          await query(
            `
              UPDATE ingress
              SET ${isVideo ? "video_codec" : isAudio ? "audio_codec" : "input_type"} = $1,
                  track_count = track_count + 1
              WHERE id = $2
            `,
            [mimeType, ingressId]
          );
        }
        break;
      }

      // ==================== DEFAULT ====================
      default: {
        console.log(`[Webhook] Unhandled event type: ${eventType}`);
      }
    }

    // Update analytics for participant events
    if (eventType === "participant_joined" || eventType === "participant_left") {
      const delta = eventType === "participant_joined" ? 1 : -1;
      const latest = await query<{ total_participants: number | null }>(
        `
          SELECT total_participants
          FROM analytics_snapshots
          ORDER BY timestamp DESC
          LIMIT 1
        `,
      );
      const current = latest.rows[0]?.total_participants || 0;
      const totalParticipants = Math.max(0, current + delta);
      const activeRooms = await query<{ count: string }>(
        "SELECT COUNT(DISTINCT room_name)::text AS count FROM sessions WHERE status = 'active'",
      );

      await query(
        `
          INSERT INTO analytics_snapshots(
            id, timestamp, active_rooms, total_participants
          )
          VALUES($1, NOW(), $2, $3)
        `,
        [randomUUID(), Number(activeRooms.rows[0]?.count || 0), totalParticipants],
      );
    }

    // Mark webhook as processed
    await query(
      `
        UPDATE webhook_events
        SET processed = true, delivery_attempts = 1
        WHERE id = $1
      `,
      [eventId],
    );
  } catch (error) {
    console.error(`[Webhook] Error processing ${eventType}:`, error);
    await query(
      `
        UPDATE webhook_events
        SET
          processed = false,
          delivery_attempts = delivery_attempts + 1,
          last_error = $2
        WHERE id = $1
      `,
      [eventId, error instanceof Error ? error.message : "processing_error"],
    );
  }

  return new NextResponse(null, { status: 200 });
}
