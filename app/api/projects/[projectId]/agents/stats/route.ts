import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/guards";
import { resolveOwnedProjectId } from "@/lib/server/project";

type RouteContext = {
  params: Promise<{ projectId: string }> | { projectId: string };
};

function resolveParams(params: RouteContext["params"]) {
  if ("then" in params) return params;
  return Promise.resolve(params);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const claims = requireAuth(request, { admin: true });
  if (claims instanceof NextResponse) return claims;

  const { projectId } = await resolveParams(context.params);
  const resolvedProjectId = await resolveOwnedProjectId(projectId, claims.sub);
  if (!resolvedProjectId) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const agents = await query<{ id: string }>(
    "SELECT id FROM agents WHERE project_id = $1",
    [resolvedProjectId],
  );
  const agentIds = agents.rows.map((row) => row.id);
  if (!agentIds.length) {
    return NextResponse.json({
      active_sessions: 0,
      total_minutes: 0,
      quota_minutes: -1,
    });
  }

  const isTimeseries = request.nextUrl.searchParams.get("timeseries") === "true";
  if (isTimeseries) {
    const range = request.nextUrl.searchParams.get("range") || "7d";
    // For simplicity, we'll return daily buckets for the past week
    const rows = await query<{
      bucket: string | Date;
      sessions: number;
    }>(
      `
        SELECT
          date_trunc('day', joined_at) AS bucket,
          COUNT(*)::int AS sessions
        FROM agent_rooms
        WHERE agent_id = ANY($1::text[])
          AND joined_at >= NOW() - INTERVAL '7 days'
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      [agentIds],
    );

    return NextResponse.json(
      rows.rows.map((row) => ({
        timestamp: new Date(row.bucket).toISOString(),
        sessions: row.sessions,
        errors: 0, // Errors tracking to be implemented later
      }))
    );
  }

  const active = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM agent_rooms
      WHERE agent_id = ANY($1::text[])
        AND left_at IS NULL
    `,
    [agentIds],
  );

  const total = await query<{ total_minutes: string }>(
    `
      SELECT
        COALESCE(
          SUM(
            EXTRACT(
              EPOCH FROM (
                COALESCE(left_at, joined_at) - joined_at
              )
            ) / 60
          ),
          0
        )::text AS total_minutes
      FROM agent_rooms
      WHERE agent_id = ANY($1::text[])
        AND joined_at IS NOT NULL
    `,
    [agentIds],
  );

  return NextResponse.json({
    active_sessions: Number(active.rows[0]?.count || 0),
    total_minutes: Math.max(0, Math.floor(Number(total.rows[0]?.total_minutes || 0))),
    quota_minutes: -1,
  });
}

