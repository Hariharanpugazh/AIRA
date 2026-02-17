import { livekit } from "./livekit";
import { query } from "./db";

/**
 * Synchronizes the database session states with the actual live state from LiveKit server.
 * This handles cases where webhooks might have been missed or the server restarted.
 */
export async function syncSessionStates() {
    try {
        // 1. Fetch currently active rooms from LiveKit
        const activeRooms = await livekit.room.listRooms();
        const activeSids = activeRooms.map((r) => r.sid);

        // 2. Identify sessions in our DB marked as 'active' that are NO LONGER in LiveKit
        // We only target sessions that have been active for at least a few minutes 
        // to avoid race conditions with room_started webhooks.
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

        // 3. For sessions that ARE still active, sync the participant counts just in case
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

        console.log(`[Sync] Synchronized ${activeRooms.length} active sessions.`);
    } catch (error) {
        console.error("[Sync] Failed to synchronize session states:", error);
    }
}
