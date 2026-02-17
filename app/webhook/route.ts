import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { WebhookReceiver } from "livekit-server-sdk";
import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";

function projectIdFromRoom(roomName: string) {
  if (!roomName.startsWith("prj-")) return null;
  const rest = roomName.slice(4);
  const dash = rest.indexOf("-");
  if (dash <= 0) return null;
  return rest.slice(0, dash);
}

function verifyHmacSignature(signature: string, body: string) {
  const hmac = createHmac("sha256", serverEnv.LIVEKIT_API_SECRET);
  hmac.update(body);
  const expected = `sha256=${hmac.digest("base64")}`;

  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const authHeader = request.headers.get("authorization") || undefined;
  const signature = request.headers.get("x-livekit-signature");

  try {
    if (authHeader) {
      const receiver = new WebhookReceiver(
        serverEnv.LIVEKIT_API_KEY,
        serverEnv.LIVEKIT_API_SECRET,
      );
      await receiver.receive(body, authHeader);
    } else if (signature) {
      const ok = verifyHmacSignature(signature, body);
      if (!ok) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const eventType = String(payload.event || "unknown");
  const eventId = randomUUID();
  await query(
    `
      INSERT INTO webhook_events (
        id, event_type, payload, processed, delivery_attempts, created_at
      )
      VALUES ($1, $2, $3, false, 0, NOW())
    `,
    [eventId, eventType, body],
  );

  try {
    if (eventType === "room_started") {
      const room = (payload.room || {}) as Record<string, unknown>;
      const roomName = String(room.name || "");
      const sid = String(room.sid || "");
      if (roomName && sid) {
        const projectId = projectIdFromRoom(roomName);
        await query(
          `
            INSERT INTO sessions (
              sid, room_name, status, start_time, project_id, created_at
            )
            VALUES ($1, $2, 'active', NOW(), $3, NOW())
            ON CONFLICT (sid) DO UPDATE
            SET status = 'active', start_time = NOW()
          `,
          [sid, roomName, projectId],
        );
      }
    } else if (eventType === "room_finished") {
      const room = (payload.room || {}) as Record<string, unknown>;
      const roomName = String(room.name || "");
      if (roomName) {
        await query(
          `
            UPDATE sessions
            SET status = 'finished', 
                end_time = NOW(),
                active_participants = 0
            WHERE room_name = $1 AND status = 'active'
          `,
          [roomName],
        );
      }
    } else if (eventType.startsWith("egress_")) {
      const egress = (payload.egress || {}) as Record<string, unknown>;
      const roomName = String(egress.roomName || "");
      const projectId = projectIdFromRoom(roomName);
      const egressId = String(egress.egressId || "");
      const status = String(egress.status || "");
      const type = String(egress.outputType || "unknown");
      const url = String((egress as any).file?.location || (egress as any).stream?.url || "");

      if (egressId) {
        if (eventType === "egress_started") {
          await query(
            `
              INSERT INTO egress (
                id, name, egress_type, room_name, output_type, output_url, is_active, project_id, created_at, updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, true, $7, NOW(), NOW())
              ON CONFLICT (id) DO UPDATE
              SET is_active = true, updated_at = NOW()
            `,
            [egressId, egressId, status, roomName, type, url, projectId],
          );
        } else if (eventType === "egress_ended") {
          await query(
            `
              UPDATE egress
              SET is_active = false, output_url = $2, updated_at = NOW()
              WHERE id = $1
            `,
            [egressId, url],
          );
        }
      }
    } else if (eventType.startsWith("ingress_")) {
      const ingress = (payload.ingress || {}) as Record<string, unknown>;
      const roomName = String(ingress.roomName || "");
      const projectId = projectIdFromRoom(roomName);
      const ingressId = String(ingress.ingressId || "");
      const name = String(ingress.name || "");
      const type = String(ingress.inputType || "unknown");
      const url = String(ingress.url || "");
      const streamKey = String(ingress.streamKey || "");

      if (ingressId) {
        await query(
          `
            INSERT INTO ingress (
              id, name, input_type, room_name, stream_key, url, is_enabled, project_id, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, true, $7, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE
            SET updated_at = NOW()
          `,
          [ingressId, name || ingressId, type, roomName, streamKey, url, projectId],
        );
      }
    } else if (eventType === "participant_joined" || eventType === "participant_left") {
      const participant = (payload.participant || {}) as Record<string, unknown>;
      const room = (payload.room || {}) as Record<string, unknown>;
      const roomName = String(room.name || "");
      const sessionId = String(room.sid || "");
      const identity = String(participant.identity || "");

      if (eventType === "participant_joined") {
        if (sessionId && identity) {
          const clientInfo = (participant.client || {}) as Record<string, unknown>;
          const platform = String(clientInfo.os || "unknown").toLowerCase();
          const browser = String(clientInfo.browser || "unknown").toLowerCase();
          const projectId = projectIdFromRoom(roomName);

          await query(
            `
              INSERT INTO participant_records(
            id, session_id, identity, status, joined_at, platform, browser, project_id
          )
              VALUES($1, $2, $3, 'active', NOW(), $4, $5, $6)
            `,
            [randomUUID(), sessionId, identity, platform, browser, projectId],
          );

          await query(
            `
              UPDATE sessions
              SET total_participants = total_participants + 1,
          active_participants = active_participants + 1
              WHERE sid = $1
          `,
            [sessionId],
          );

          // Track Agent Room Entry
          if (identity.startsWith("agent_")) {
            const agentRow = await query<{ id: string }>(
              "SELECT id FROM agents WHERE agent_id = $1 LIMIT 1",
              [identity]
            );
            if (agentRow.rows[0]) {
              const attributes = (participant.attributes || {}) as Record<string, string>;
              const instanceId = attributes.AGENT_INSTANCE_ID || null;

              // Find internal primary key for instance if instance_id matches
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
        }
      } else {
        // participant_left
        if (sessionId && identity) {
          await query(
            `
              UPDATE participant_records
              SET status = 'left', left_at = NOW()
              WHERE session_id = $1 AND identity = $2 AND status = 'active'
          `,
            [sessionId, identity],
          );

          await query(
            `
              UPDATE sessions
              SET active_participants = GREATEST(0, active_participants - 1)
              WHERE sid = $1
          `,
            [sessionId],
          );

          // Track Agent Room Exit
          if (identity.startsWith("agent_")) {
            const agentRow = await query<{ id: string }>(
              "SELECT id FROM agents WHERE agent_id = $1 LIMIT 1",
              [identity]
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
        }
      }

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

    await query(
      `
        UPDATE webhook_events
        SET processed = true, delivery_attempts = 1
        WHERE id = $1
          `,
      [eventId],
    );
  } catch (error) {
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

