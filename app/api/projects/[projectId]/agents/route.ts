import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { mapAgentRow } from "@/lib/server/agent-utils";
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

function normalizeAgentPayload(payload: Record<string, unknown>) {
  const status = payload.status ? String(payload.status).toLowerCase() : null;
  let enabled =
    payload.is_enabled !== undefined ? payload.is_enabled === true : undefined;
  if (status) {
    if (["active", "running", "enabled"].includes(status)) enabled = true;
    if (["paused", "inactive", "disabled"].includes(status)) enabled = false;
  }

  const envVars =
    payload.environment && typeof payload.environment === "object"
      ? payload.environment
      : payload.env_vars && typeof payload.env_vars === "object"
        ? payload.env_vars
        : {};

  return {
    display_name: String(payload.display_name || payload.name || "New Agent"),
    image: String(payload.image || "livekit/agent:latest"),
    entrypoint:
      payload.entrypoint !== undefined && payload.entrypoint !== null
        ? String(payload.entrypoint)
        : null,
    env_vars: JSON.stringify(envVars),
    livekit_permissions: JSON.stringify(
      payload.livekit_permissions && typeof payload.livekit_permissions === "object"
        ? payload.livekit_permissions
        : {},
    ),
    default_room_behavior: String(payload.default_room_behavior || "auto"),
    auto_restart_policy: String(payload.auto_restart_policy || "always"),
    resource_limits: JSON.stringify(
      payload.resource_limits && typeof payload.resource_limits === "object"
        ? payload.resource_limits
        : {},
    ),
    is_enabled: enabled ?? true,
  };
}

async function resolveProject(request: NextRequest, context: RouteContext) {
  const claims = requireAuth(request, { admin: true });
  if (claims instanceof NextResponse) return claims;
  const { projectId } = await resolveParams(context.params);
  const resolved = await resolveOwnedProjectId(projectId, claims.sub);
  if (!resolved) return NextResponse.json({ error: "Not Found" }, { status: 404 });
  return { claims, projectId: resolved };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const scope = await resolveProject(request, context);
  if (scope instanceof NextResponse) return scope;

  const rows = await query<{
    id: string;
    agent_id: string;
    display_name: string;
    image: string;
    entrypoint: string | null;
    env_vars: string | null;
    livekit_permissions: string | null;
    default_room_behavior: string | null;
    auto_restart_policy: string | null;
    resource_limits: string | null;
    is_enabled: boolean;
    created_at: string | Date;
    updated_at: string | Date;
    active_sessions: string | number;
  }>(
    `
      SELECT
        a.id,
        a.agent_id,
        a.display_name,
        a.image,
        a.entrypoint,
        a.env_vars,
        a.livekit_permissions,
        a.default_room_behavior,
        a.auto_restart_policy,
        a.resource_limits,
        a.is_enabled,
        a.created_at,
        a.updated_at,
        (SELECT COUNT(*) FROM agent_rooms ar WHERE ar.agent_id = a.id AND ar.left_at IS NULL) AS active_sessions
      FROM agents a
      WHERE a.project_id = $1
      ORDER BY a.created_at DESC
    `,
    [scope.projectId],
  );

  return NextResponse.json(rows.rows.map(mapAgentRow));
}

export async function POST(request: NextRequest, context: RouteContext) {
  const scope = await resolveProject(request, context);
  if (scope instanceof NextResponse) return scope;
  const payload = (await request.json()) as Record<string, unknown>;
  const normalized = normalizeAgentPayload(payload);

  const created = await query<{
    id: string;
    agent_id: string;
    display_name: string;
    image: string;
    entrypoint: string | null;
    env_vars: string | null;
    livekit_permissions: string | null;
    default_room_behavior: string | null;
    auto_restart_policy: string | null;
    resource_limits: string | null;
    is_enabled: boolean;
    created_at: string | Date;
    updated_at: string | Date;
  }>(
    `
      INSERT INTO agents (
        id,
        agent_id,
        display_name,
        image,
        entrypoint,
        env_vars,
        livekit_permissions,
        default_room_behavior,
        auto_restart_policy,
        resource_limits,
        is_enabled,
        project_id,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
      )
      RETURNING
        id,
        agent_id,
        display_name,
        image,
        entrypoint,
        env_vars,
        livekit_permissions,
        default_room_behavior,
        auto_restart_policy,
        resource_limits,
        is_enabled,
        created_at,
        updated_at
    `,
    [
      randomUUID(),
      `agent_${randomUUID().replace(/-/g, "")}`,
      normalized.display_name,
      normalized.image,
      normalized.entrypoint,
      normalized.env_vars,
      normalized.livekit_permissions,
      normalized.default_room_behavior,
      normalized.auto_restart_policy,
      normalized.resource_limits,
      normalized.is_enabled,
      scope.projectId,
    ],
  );

  return NextResponse.json(mapAgentRow(created.rows[0]), { status: 201 });
}

