import { livekit } from "./livekit";
import { query } from "./db";

/**
 * Synchronizes all LiveKit resources (sessions, egresses, ingresses)
 * with the database to ensure persistence and recovery from server restarts.
 */
export async function syncAllResources() {
  try {
    await Promise.all([
      syncSessionStates(),
      syncEgressStates(),
      syncIngressStates(),
    ]);
    console.log("[Sync] All resources synchronized successfully");
  } catch (error) {
    console.error("[Sync] Consolidated sync failed:", error);
  }
}

async function syncSessionStates() {
  try {
    const activeRooms = await livekit.room.listRooms();
    const activeSids = activeRooms.map((r) => r.sid);

    // Mark stale sessions as finished
    await query(
      `
        UPDATE sessions
        SET status = 'finished',
            end_time = NOW(),
            duration = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - start_time))::int),
            active_participants = 0
        WHERE status = 'active'
          AND sid != ALL($1::text[])
          AND created_at < NOW() - INTERVAL '2 minutes'
      `,
      [activeSids]
    );

    // Update participant counts for active sessions
    for (const room of activeRooms) {
      await query(
        `
          UPDATE sessions
          SET total_participants = GREATEST(total_participants, $2),
              active_participants = $2
          WHERE sid = $1 AND status = 'active'
        `,
        [room.sid, room.numParticipants]
      );

      // Ensure session exists
      await query(
        `
          INSERT INTO sessions (sid, room_name, status, start_time, total_participants, active_participants, created_at)
          VALUES ($1, $2, 'active', to_timestamp($3), $4, $4, NOW())
          ON CONFLICT (sid) DO UPDATE
          SET room_name = $2,
              active_participants = $4
        `,
        [room.sid, room.name, Number(room.creationTime), room.numParticipants]
      );
    }
  } catch (error) {
    console.error("[Sync] Session sync failed:", error);
  }
}

async function syncEgressStates() {
  try {
    const activeEgresses = await livekit.egress.listEgress();
    const activeIds = activeEgresses.map((e) => e.egressId);

    // If it's active in our DB but not in LiveKit, it finished
    await query(
      `
        UPDATE egress
        SET is_active = false,
            status_detail = 'EGRESS_COMPLETE',
            ended_at = NOW(),
            updated_at = NOW()
        WHERE is_active = true
          AND egress_id != ALL($1::text[])
          AND created_at < NOW() - INTERVAL '1 minute'
      `,
      [activeIds]
    );

    // Update or insert active egresses
    for (const egress of activeEgresses) {
      const raw = egress as unknown as Record<string, unknown>;

      // Determine source type
      let sourceType = "room_composite";
      let participantIdentity: string | null = null;
      let trackId: string | null = null;
      let webUrl: string | null = null;

      if (raw.web) {
        sourceType = "web";
        webUrl = String((raw.web as Record<string, unknown>).url || "");
      } else if (raw.track) {
        sourceType = "track";
        trackId = String((raw.track as Record<string, unknown>).trackId || "");
      } else if (raw.trackComposite) {
        sourceType = "track_composite";
        participantIdentity = String((raw.trackComposite as Record<string, unknown>).participantIdentity || "");
      } else if (raw.participant) {
        sourceType = "participant";
        participantIdentity = String((raw.participant as Record<string, unknown>).participantIdentity || "");
      }

      // Extract results
      const fileResults = raw.fileResults as unknown[] | undefined;
      const streamResults = raw.streamResults as unknown[] | undefined;
      const segmentResults = raw.segmentResults as unknown[] | undefined;
      const imageResults = raw.imageResults as unknown[] | undefined;

      // Get output URL
      let outputUrl: string | null = null;
      if (fileResults?.[0] && typeof fileResults[0] === "object") {
        const fr = fileResults[0] as Record<string, unknown>;
        outputUrl = String(fr.location || fr.filename || "");
      }

      const status = String((egress as { status?: string | number }).status || "EGRESS_ACTIVE");
      const statusName = typeof status === "number" ? String(status) : status;

      await query(
        `
          INSERT INTO egress (
            id, egress_id, name, egress_type, source_type, room_name, room_id,
            is_active, status_detail, started_at, ended_at, output_url,
            participant_identity, track_id, web_url,
            file_results, stream_results, segment_results, image_results,
            created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                  to_timestamp($10 / 1000.0), $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())
          ON CONFLICT (egress_id) DO UPDATE
          SET is_active = $8,
              status_detail = $9,
              ended_at = COALESCE(to_timestamp($11 / 1000.0), egress.ended_at),
              output_url = COALESCE($12, egress.output_url),
              file_results = COALESCE($16, egress.file_results),
              stream_results = COALESCE($17, egress.stream_results),
              segment_results = COALESCE($18, egress.segment_results),
              image_results = COALESCE($19, egress.image_results),
              updated_at = NOW()
        `,
        [
          egress.egressId,
          egress.egressId,
          (egress as unknown as { egressName?: string }).egressName || egress.egressId,
          "egress",
          sourceType,
          egress.roomName,
          egress.roomId,
          statusName === "EGRESS_ACTIVE" || statusName === "1",
          statusName,
          Number(egress.startedAt) || Date.now(),
          egress.endedAt ? Number(egress.endedAt) : null,
          outputUrl,
          participantIdentity,
          trackId,
          webUrl,
          fileResults ? JSON.stringify(fileResults) : null,
          streamResults ? JSON.stringify(streamResults) : null,
          segmentResults ? JSON.stringify(segmentResults) : null,
          imageResults ? JSON.stringify(imageResults) : null,
        ]
      );
    }
  } catch (error) {
    console.error("[Sync] Egress sync failed:", error);
  }
}

async function syncIngressStates() {
  try {
    const activeIngresses = await livekit.ingress.listIngress({});

    for (const ingress of activeIngresses) {
      const state = ingress.state;
      const trackSids = state?.tracks?.map((t) => t.sid) || [];

      await query(
        `
          INSERT INTO ingress (
            id, name, input_type, room_name, stream_key, url,
            participant_identity, participant_name, reusable,
            room_id, resource_id, status, started_at, ended_at,
            track_count, track_sids, error, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                  $13, $14, $15, $16, $17, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE
          SET name = $2,
              input_type = $3,
              room_name = $4,
              stream_key = $5,
              url = $6,
              participant_identity = $7,
              participant_name = $8,
              reusable = $9,
              room_id = $10,
              resource_id = $11,
              status = $12,
              started_at = COALESCE($13, ingress.started_at),
              ended_at = COALESCE($14, ingress.ended_at),
              track_count = $15,
              track_sids = $16,
              error = $17,
              updated_at = NOW()
        `,
        [
          ingress.ingressId,
          ingress.name || ingress.ingressId,
          String(ingress.inputType),
          ingress.roomName,
          ingress.streamKey,
          ingress.url,
          ingress.participantIdentity,
          ingress.participantName,
          ingress.reusable,
          state?.roomId || null,
          state?.resourceId || null,
          String(state?.status || "endpoint_inactive"),
          state?.startedAt ? new Date(Number(state.startedAt) / 1000000) : null,
          state?.endedAt ? new Date(Number(state.endedAt) / 1000000) : null,
          trackSids.length,
          trackSids.length > 0 ? JSON.stringify(trackSids) : null,
          state?.error || null,
        ]
      );
    }
  } catch (error) {
    console.error("[Sync] Ingress sync failed:", error);
  }
}

/**
 * Sync SIP call logs with LiveKit room states
 */
export async function syncCallLogs() {
  try {
    // Update stale active calls to ended if room is closed
    await query(
      `
        UPDATE call_logs
        SET status = 'ended',
            ended_at = NOW(),
            duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::int)
        WHERE status IN ('active', 'ringing')
          AND room_name IS NOT NULL
          AND room_name NOT IN (
            SELECT room_name FROM sessions WHERE status = 'active'
          )
          AND started_at < NOW() - INTERVAL '5 minutes'
      `
    );
  } catch (error) {
    console.error("[Sync] Call logs sync failed:", error);
  }
}
