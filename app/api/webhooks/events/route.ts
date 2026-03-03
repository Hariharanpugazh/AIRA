import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/guards";

export async function GET(request: NextRequest) {
  const claims = requireAuth(request);
  if (claims instanceof NextResponse) return claims;

  const limit = Math.max(
    1,
    Math.min(
      500,
      Number.parseInt(request.nextUrl.searchParams.get("limit") || "100", 10) || 100,
    ),
  );

  const rows = await query<{
    id: string;
    project_id: string | null;
    event_type: string;
    payload: string;
    processed: boolean;
    created_at: string | Date;
    delivery_attempts: number;
    last_error: string | null;
    room_name: string | null;
    session_id: string | null;
    participant_identity: string | null;
    egress_id: string | null;
    ingress_id: string | null;
  }>(
    `
      SELECT
        id, project_id, event_type, payload, processed, created_at,
        delivery_attempts, last_error, room_name, session_id,
        participant_identity, egress_id, ingress_id
      FROM webhook_events
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  const events = rows.rows.map((row) => ({
    id: row.id,
    project_id: row.project_id,
    event_type: row.event_type,
    payload: (() => {
      try {
        return JSON.parse(row.payload);
      } catch {
        return null;
      }
    })(),
    processed: row.processed,
    created_at: new Date(row.created_at).toISOString(),
    delivery_attempts: row.delivery_attempts,
    last_error: row.last_error,
    room_name: row.room_name,
    session_id: row.session_id,
    participant_identity: row.participant_identity,
    egress_id: row.egress_id,
    ingress_id: row.ingress_id,
  }));

  return NextResponse.json({
    events,
    count: events.length,
  });
}
