import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/guards";
import {
  parseRangeToHours,
  resolveSessionScopeProjectIds,
} from "@/lib/server/session-utils";
import { syncAllResources } from "@/lib/server/resource-sync";

type RouteContext = {
  params: Promise<{ action: string }> | { action: string };
};

function resolveParams(params: RouteContext["params"]) {
  if ("then" in params) return params;
  return Promise.resolve(params);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const claims = requireAuth(request, { admin: true });
  if (claims instanceof NextResponse) return claims;

  // Sync DB with LiveKit server state to ensure analytics are accurate
  await syncAllResources();

  const { action } = await resolveParams(context.params);

  const projectIdentifier = request.nextUrl.searchParams.get("project_id");
  const projectIds = await resolveSessionScopeProjectIds(claims.sub, projectIdentifier);
  if (projectIds === null) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  if (action === "summary") {
    if (projectIds.length === 0) {
      return NextResponse.json({
        active_rooms: 0,
        total_participants: 0,
        status: "healthy",
        last_updated: new Date().toISOString(),
      });
    }

    const summary = await query<{ active_rooms: string; total_participants: string }>(
      `
        SELECT
          COUNT(DISTINCT room_name)::text AS active_rooms,
          COALESCE(
            SUM(
              CASE
                WHEN active_participants > 0 THEN active_participants
                ELSE total_participants
              END
            ),
            0
          )::text AS total_participants
        FROM sessions
        WHERE project_id = ANY($1::text[])
          AND status = 'active'
      `,
      [projectIds],
    );

    return NextResponse.json({
      active_rooms: Number(summary.rows[0]?.active_rooms || 0),
      total_participants: Number(summary.rows[0]?.total_participants || 0),
      status: "healthy",
      last_updated: new Date().toISOString(),
    });
  }

  if (action === "dashboard") {
    if (projectIds.length === 0) {
      return NextResponse.json({
        overview: {
          connection_success: 100,
          connection_type: { udp: 0, tcp: 0 },
          top_countries: [],
        },
        platforms: {},
        participants: {
          webrtc_minutes: 0,
          agent_minutes: 0,
          sip_minutes: 0,
          total_minutes: 0,
        },
        agents: {
          session_minutes: 0,
          concurrent: 0,
        },
        telephony: {
          inbound: 0,
          outbound: 0,
        },
        rooms: {
          total_sessions: 0,
          avg_size: 0,
          avg_duration: 0,
        },
      });
    }

    const hours = parseRangeToHours(request.nextUrl.searchParams.get("range"));
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const totals = await query<{
      total_sessions: string;
      successful_sessions: string;
      total_duration: string;
      sip_duration: string;
      avg_duration: string;
      avg_participants: string;
    }>(
      `
        SELECT
          COUNT(*)::text AS total_sessions,
          COUNT(*) FILTER (WHERE status <> 'failed')::text AS successful_sessions,
          COALESCE(SUM(duration), 0)::text AS total_duration,
          COALESCE(SUM(duration) FILTER (WHERE features ILIKE '%sip%'), 0)::text AS sip_duration,
          COALESCE(AVG(duration), 0)::text AS avg_duration,
          COALESCE(AVG(total_participants), 0)::text AS avg_participants
        FROM sessions
        WHERE project_id = ANY($1::text[])
          AND start_time >= $2::timestamptz
      `,
      [projectIds, startTime],
    );

    const agentIds = await query<{ id: string }>(
      "SELECT id FROM agents WHERE project_id = ANY($1::text[])",
      [projectIds],
    );

    const activeAgents = await query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM agents WHERE project_id = ANY($1::text[]) AND is_enabled = true",
      [projectIds],
    );

    let agentMinutes = 0;
    if (agentIds.rowCount) {
      const durations = await query<{ total_minutes: string }>(
        `
          SELECT
            COALESCE(
              SUM(
                EXTRACT(EPOCH FROM (stopped_at - started_at)) / 60
              ),
              0
            )::text AS total_minutes
          FROM agent_instances
          WHERE agent_id = ANY($1::text[])
            AND started_at IS NOT NULL
            AND stopped_at IS NOT NULL
        `,
        [agentIds.rows.map((row) => row.id)],
      );
      agentMinutes = Math.max(0, Math.floor(Number(durations.rows[0]?.total_minutes || 0)));
    }

    const totalSessions = Number(totals.rows[0]?.total_sessions || 0);
    const successfulSessions = Number(totals.rows[0]?.successful_sessions || 0);
    const totalDurationSeconds = Number(totals.rows[0]?.total_duration || 0);
    const sipDurationSeconds = Number(totals.rows[0]?.sip_duration || 0);
    const totalMinutes = Math.max(0, Math.floor(totalDurationSeconds / 60));
    const sipMinutes = Math.max(0, Math.floor(sipDurationSeconds / 60));
    const webrtcMinutes = Math.max(0, totalMinutes - agentMinutes - sipMinutes);
    const successRate = totalSessions
      ? (successfulSessions / totalSessions) * 100
      : 100;

    const platforms = await query<{ platform: string; count: string }>(
      `
        SELECT platform, COUNT(DISTINCT identity)::text AS count
        FROM participant_records
        WHERE project_id = ANY($1::text[])
          AND joined_at >= $2::timestamptz
        GROUP BY platform
      `,
      [projectIds, startTime],
    );

    const platformStats: Record<string, number> = {};
    const totalPlatformCount = platforms.rows.reduce((acc, p) => acc + Number(p.count), 0);
    if (totalPlatformCount > 0) {
      platforms.rows.forEach((p) => {
        const name = p.platform || "other";
        const pct = Math.round((Number(p.count) / totalPlatformCount) * 100);
        platformStats[name] = pct;
      });
    }

    return NextResponse.json({
      overview: {
        connection_success: successRate,
        connection_type: totalSessions > 0 ? { udp: 100, tcp: 0 } : { udp: 0, tcp: 0 },
        top_countries: [],
      },
      platforms: platformStats,
      participants: {
        webrtc_minutes: webrtcMinutes,
        agent_minutes: agentMinutes,
        sip_minutes: sipMinutes,
        total_minutes: totalMinutes,
      },
      agents: {
        session_minutes: agentMinutes,
        concurrent: Number(activeAgents.rows[0]?.count || 0),
      },
      telephony: {
        inbound: sipMinutes,
        outbound: 0,
      },
      rooms: {
        total_sessions: totalSessions,
        avg_size: Number(totals.rows[0]?.avg_participants || 0),
        avg_duration: Number(totals.rows[0]?.avg_duration || 0),
      },
    });
  }

  if (action === "timeseries") {
    if (projectIds.length === 0) {
      return NextResponse.json([]);
    }

    const hours = parseRangeToHours(request.nextUrl.searchParams.get("range"));
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const rows = await query<{
      bucket: string | Date;
      active_rooms: number;
      total_participants: number;
    }>(
      `
        SELECT
          date_trunc('hour', start_time) AS bucket,
          COUNT(*)::int AS active_rooms,
          COALESCE(SUM(total_participants), 0)::int AS total_participants
        FROM sessions
        WHERE project_id = ANY($1::text[])
          AND start_time >= $2::timestamptz
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      [projectIds, startTime],
    );

    return NextResponse.json(
      rows.rows.map((row) => ({
        timestamp: new Date(row.bucket).toISOString().replace(/\.\d{3}Z$/, "Z"),
        active_rooms: row.active_rooms || 0,
        total_participants: row.total_participants || 0,
      })),
    );
  }

  return NextResponse.json({ error: "Not Found" }, { status: 404 });
}

