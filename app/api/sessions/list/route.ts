import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/guards";
import {
  parseSessionFeatures,
  resolveSessionScopeProjectIds,
} from "@/lib/server/session-utils";
import { syncAllResources } from "@/lib/server/resource-sync";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Sync DB with LiveKit server state to handle missed webhooks or server restarts
  await syncAllResources();

  const page = Math.max(
    1,
    Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1,
  );
  const limit = Math.max(
    1,
    Math.min(
      200,
      Number.parseInt(request.nextUrl.searchParams.get("limit") || "20", 10) || 20,
    ),
  );
  const status = request.nextUrl.searchParams.get("status");
  const search = request.nextUrl.searchParams.get("search");
  const projectIdentifier = request.nextUrl.searchParams.get("project_id");

  const scopeProjectIds = await resolveSessionScopeProjectIds(auth.sub, projectIdentifier);
  if (scopeProjectIds === null) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  if (scopeProjectIds.length === 0) {
    return NextResponse.json({ data: [], total: 0, page, limit });
  }

  const where: string[] = ["project_id = ANY($1::text[])"];
  const values: unknown[] = [scopeProjectIds];
  let idx = values.length;

  if (status) {
    idx += 1;
    where.push(`status = $${idx}`);
    values.push(status);
  }
  if (search) {
    idx += 1;
    where.push(`room_name ILIKE $${idx}`);
    values.push(`%${search}%`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const totalResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM sessions ${whereSql}`,
    values,
  );
  const total = Number(totalResult.rows[0]?.total || 0);

  const offset = (page - 1) * limit;
  const rows = await query<{
    sid: string;
    room_name: string;
    status: string;
    start_time: string | Date;
    end_time: string | Date | null;
    duration: number | null;
    total_participants: number | null;
    active_participants: number | null;
    project_id: string | null;
    features: string | null;
  }>(
    `
      SELECT
        sid,
        room_name,
        status,
        start_time,
        end_time,
        duration,
        total_participants,
        active_participants,
        project_id,
        features
      FROM sessions
      ${whereSql}
      ORDER BY start_time DESC
      LIMIT $${idx + 1}
      OFFSET $${idx + 2}
    `,
    [...values, limit, offset],
  );

  return NextResponse.json({
    data: rows.rows.map((row) => ({
      sid: row.sid,
      room_name: row.room_name,
      status: row.status,
      start_time: new Date(row.start_time).toISOString(),
      end_time: row.end_time ? new Date(row.end_time).toISOString() : null,
      duration: row.duration || 0,
      total_participants: row.total_participants || 0,
      active_participants: row.active_participants || 0,
      project_id: row.project_id,
      features: parseSessionFeatures(row.features),
    })),
    total,
    page,
    limit,
  });
}

