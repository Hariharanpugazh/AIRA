import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { NextResponse, type NextRequest } from "next/server";
import { safeParseJsonObject } from "@/lib/server/agent-utils";
import { query } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { requireAuth } from "@/lib/server/guards";
import { createLiveKitAccessToken } from "@/lib/server/livekit";
import { resolveOwnedProjectId } from "@/lib/server/project";
import { scopeName } from "@/lib/server/scopes";

type RouteContext = {
  params:
    | Promise<{ projectId: string; agentId: string }>
    | { projectId: string; agentId: string };
};

function resolveParams(params: RouteContext["params"]) {
  if ("then" in params) return params;
  return Promise.resolve(params);
}

function toWsUrl(host: string) {
  if (host.startsWith("https://")) return host.replace("https://", "wss://");
  if (host.startsWith("http://")) return host.replace("http://", "ws://");
  return host;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const claims = requireAuth(request, { admin: true });
  if (claims instanceof NextResponse) return claims;

  const { projectId, agentId } = await resolveParams(context.params);
  const resolvedProjectId = await resolveOwnedProjectId(projectId, claims.sub);
  if (!resolvedProjectId) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const payload = (await request.json()) as {
    deployment_type?: string;
    room_name?: string;
  };
  const deploymentType = (payload.deployment_type || "process").toLowerCase();
  if (deploymentType !== "process") {
    return NextResponse.json(
      { error: "Unsupported deployment_type", message: "Only process deployment is supported" },
      { status: 400 },
    );
  }

  const agentRow = await query<{
    id: string;
    agent_id: string;
    display_name: string;
    image: string;
    entrypoint: string | null;
    env_vars: string | null;
    livekit_permissions: string | null;
    is_enabled: boolean;
  }>(
    `
      SELECT id, agent_id, display_name, image, entrypoint, env_vars, livekit_permissions, is_enabled
      FROM agents
      WHERE project_id = $1
        AND agent_id = $2
      LIMIT 1
    `,
    [resolvedProjectId, agentId],
  );
  const agent = agentRow.rows[0];
  if (!agent) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  if (!agent.is_enabled) {
    return NextResponse.json({ error: "Agent is disabled" }, { status: 400 });
  }

  const scopedRoomName = payload.room_name
    ? scopeName(payload.room_name, resolvedProjectId)
    : undefined;
  const permissions = safeParseJsonObject<Record<string, unknown>>(agent.livekit_permissions);
  const token = await createLiveKitAccessToken({
    identity: agent.agent_id,
    name: agent.display_name,
    room: scopedRoomName,
    grants: {
      roomJoin: Boolean(permissions.room_join ?? true),
      roomCreate: Boolean(permissions.room_create ?? false),
      roomAdmin: Boolean(permissions.room_admin ?? false),
      roomRecord: Boolean(permissions.room_record ?? false),
      room: scopedRoomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  });

  const envVars = safeParseJsonObject<Record<string, string>>(agent.env_vars);
  const execPath = agent.image.trim();
  if (!execPath) {
    return NextResponse.json({ error: "Agent executable path is empty" }, { status: 400 });
  }

  // Reject obvious container-image strings for process deploys and validate host executables.
  const looksLikeContainerImage = execPath.includes(":") && execPath.includes("/");
  if (looksLikeContainerImage) {
    return NextResponse.json(
      {
        error: "Invalid agent.image for process deployment",
        message:
          `Looks like a container image ('${execPath}'). Process deployment expects a host executable/command — set a host executable or use a different deploy approach.`,
      },
      { status: 400 },
    );
  }

  async function isExecutableOnHost(path: string) {
    // path-like => check file and exec bit
    if (path.includes("/") || path.includes("\\") || path.startsWith(".")) {
      try {
        await access(path, fsConstants.X_OK);
        return true;
      } catch {
        return false;
      }
    }

    // bare command => check PATH (which/where)
    const finder = process.platform === "win32" ? "where" : "which";
    return spawnSync(finder, [path], { stdio: "ignore" }).status === 0;
  }

  if (!(await isExecutableOnHost(execPath))) {
    return NextResponse.json(
      { error: "Agent executable not found", message: `Executable '${execPath}' not found on host PATH or is not executable.` },
      { status: 400 },
    );
  }

  const args = agent.entrypoint ? [agent.entrypoint] : [];
  const instanceId = `inst_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  let child;
  try {
    child = spawn(execPath, args, {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        ...envVars,
        LIVEKIT_URL: process.env.LIVEKIT_URL || toWsUrl(serverEnv.LIVEKIT_HOST),
        LIVEKIT_API_KEY: serverEnv.LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET: serverEnv.LIVEKIT_API_SECRET,
        LIVEKIT_AGENT_TOKEN: token,
        AGENT_INSTANCE_ID: instanceId,
        ...(scopedRoomName ? { LIVEKIT_ROOM: scopedRoomName } : {}),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to spawn process",
        message: error instanceof Error ? error.message : "Unknown spawn error",
      },
      { status: 500 },
    );
  }

  if (!child.pid) {
    return NextResponse.json(
      { error: "Failed to spawn process", message: "No process id returned" },
      { status: 500 },
    );
  }
  child.unref();

  await query(
    `
      INSERT INTO agent_instances (
        id, agent_id, instance_id, process_pid, status, started_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 'running', NOW(), NOW(), NOW())
    `,
    [randomUUID(), agent.id, instanceId, child.pid],
  );

  return NextResponse.json(
    {
      instance_id: instanceId,
      status: "running",
      process_pid: child.pid,
      container_id: null,
    },
    { status: 201 },
  );
}
