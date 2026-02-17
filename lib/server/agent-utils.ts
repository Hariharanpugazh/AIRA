export function safeParseJsonObject<T extends Record<string, unknown>>(
  raw: string | null | undefined,
) {
  if (!raw) return {} as T;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as T;
    }
  } catch {
    // Ignore invalid JSON payloads from historical rows.
  }
  return {} as T;
}

export function mapAgentRow(row: {
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
  active_sessions?: string | number;
}) {
  return {
    id: row.id,
    agent_id: row.agent_id,
    display_name: row.display_name,
    image: row.image,
    entrypoint: row.entrypoint,
    env_vars: safeParseJsonObject<Record<string, string>>(row.env_vars),
    livekit_permissions: safeParseJsonObject<Record<string, boolean>>(row.livekit_permissions),
    default_room_behavior: row.default_room_behavior || "auto",
    auto_restart_policy: row.auto_restart_policy || "always",
    resource_limits: safeParseJsonObject<Record<string, unknown>>(row.resource_limits),
    is_enabled: row.is_enabled,
    active_sessions: Number(row.active_sessions || 0),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

