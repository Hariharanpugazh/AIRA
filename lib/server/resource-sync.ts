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
    } catch (error) {
        console.error("[Sync] Consolidated sync failed:", error);
    }
}

async function syncSessionStates() {
    const activeRooms = await livekit.room.listRooms();
    const activeSids = activeRooms.map((r) => r.sid);

    await query(
        `
      UPDATE sessions
      SET status = 'finished',
          end_time = NOW(),
          active_participants = 0
      WHERE status = 'active'
        AND sid != ALL($1::text[])
        AND created_at < NOW() - INTERVAL '2 minutes'
    `,
        [activeSids]
    );

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
    }
}

async function syncEgressStates() {
    const activeEgresses = await livekit.egress.listEgress();
    const activeIds = activeEgresses.map((e) => e.egressId);

    // If it's active in our DB but not in LiveKit, it finished
    await query(
        `
      UPDATE egress
      SET is_active = false, updated_at = NOW()
      WHERE is_active = true
        AND id != ALL($1::text[])
        AND created_at < NOW() - INTERVAL '1 minute'
    `,
        [activeIds]
    );

    // Update URL if available
    for (const egress of activeEgresses) {
        const url = (egress as any).file?.location || (egress as any).stream?.url || "";
        await query(
            `
            UPDATE egress
            SET output_url = $2, updated_at = NOW()
            WHERE id = $1 AND is_active = true
          `,
            [egress.egressId, url]
        );
    }
}

async function syncIngressStates() {
    const activeIngresses = await livekit.ingress.listIngress({});

    for (const ingress of activeIngresses) {
        // Ingresses are usually static/persistent in config, 
        // but we ensure they exist in our DB for historical tracking.
        await query(
            `
            INSERT INTO ingress (
              id, name, input_type, room_name, stream_key, url, is_enabled, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE
            SET updated_at = NOW()
          `,
            [
                ingress.ingressId,
                ingress.name || ingress.ingressId,
                String(ingress.inputType),
                ingress.roomName,
                ingress.streamKey,
                ingress.url
            ]
        );
    }
}
