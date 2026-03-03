import { randomUUID } from "node:crypto";
import type { SIPDispatchRuleInfo } from "livekit-server-sdk";
import {
  ListUpdate,
  SIPDispatchRule,
  SIPDispatchRuleCallee,
  SIPDispatchRuleDirect,
  SIPDispatchRuleIndividual,
  SIPTransport,
} from "@livekit/protocol";
import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/server/db";
import { requireAuth } from "@/lib/server/guards";
import { livekit } from "@/lib/server/livekit";
import { resolveOwnedProjectId } from "@/lib/server/project";
import {
  encodeScopeMetadata,
  metadataInScope,
  parseScopeMetadata,
  scopeName,
} from "@/lib/server/scopes";

type Claims = {
  sub: string;
  email: string;
  name: string;
  is_admin: boolean;
};

type RouteContext = {
  params: Promise<{ slug: string[] }> | { slug: string[] };
};

function resolveParams(params: RouteContext["params"]) {
  if ("then" in params) return params;
  return Promise.resolve(params);
}

function hasOwn(payload: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(payload, key);
}

function sipDomainFromHost(host: string) {
  return host
    .replace(/^wss?:\/\//, "")
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];
}

function mapInboundTrunk(
  trunk: {
    sipTrunkId: string;
    name: string;
    metadata: string;
    allowedAddresses: string[];
    allowedNumbers: string[];
    authUsername: string;
  },
) {
  const scope = parseScopeMetadata(trunk.metadata);
  return {
    id: trunk.sipTrunkId,
    sip_trunk_id: trunk.sipTrunkId,
    name: trunk.name,
    metadata: trunk.metadata,
    inbound_addresses: trunk.allowedAddresses || [],
    inbound_numbers_regex: trunk.allowedNumbers || [],
    outbound_address: null,
    sip_server: null,
    sip_uri: `sip:${trunk.sipTrunkId}@${sipDomainFromHost(process.env.LIVEKIT_URL || "")}`,
    username: trunk.authUsername || null,
    created_at: new Date().toISOString(),
    project_id: scope.project_id || null,
  };
}

function mapOutboundTrunk(
  trunk: {
    sipTrunkId: string;
    name: string;
    metadata: string;
    address: string;
    numbers: string[];
    authUsername: string;
  },
) {
  const scope = parseScopeMetadata(trunk.metadata);
  return {
    id: trunk.sipTrunkId,
    sip_trunk_id: trunk.sipTrunkId,
    name: trunk.name,
    metadata: trunk.metadata,
    inbound_addresses: [],
    inbound_numbers_regex: trunk.numbers || [],
    outbound_address: trunk.address,
    sip_server: trunk.address,
    sip_uri: trunk.address ? `sip:${trunk.address}` : null,
    username: trunk.authUsername || null,
    created_at: new Date().toISOString(),
    project_id: scope.project_id || null,
  };
}

function mapDispatchRule(rule: SIPDispatchRuleInfo) {
  const scope = parseScopeMetadata(rule.metadata);
  const ruleCase = rule.rule?.rule.case;
  let ruleType = "direct";
  let roomPrefix: string | undefined;
  let randomize: boolean | undefined;
  if (ruleCase === "dispatchRuleIndividual") {
    ruleType = "individual";
    roomPrefix = rule.rule?.rule.value.roomPrefix || undefined;
  } else if (ruleCase === "dispatchRuleCallee") {
    ruleType = "callee";
    roomPrefix = rule.rule?.rule.value.roomPrefix || undefined;
    randomize = !!rule.rule?.rule.value.randomize;
  } else if (ruleCase === "dispatchRuleDirect") {
    ruleType = "direct";
  }

  return {
    id: rule.sipDispatchRuleId,
    sip_dispatch_rule_id: rule.sipDispatchRuleId,
    name: rule.name || rule.sipDispatchRuleId,
    metadata: rule.metadata || null,
    trunk_ids: rule.trunkIds || [],
    hide_phone_number: rule.hidePhoneNumber || false,
    rule_type: ruleType,
    room_prefix: roomPrefix,
    randomize,
    agent_id: rule.attributes?.agent_id || null,
    trunk_id: rule.trunkIds?.[0] || null,
    project_id: scope.project_id || null,
  };
}

function callLogResponse(row: {
  id: string;
  call_id: string;
  from_number: string | null;
  to_number: string;
  direction: "inbound" | "outbound";
  started_at: string | Date;
  ended_at: string | Date | null;
  duration_seconds: number | null;
  status: string;
  trunk_id: string | null;
  room_name: string | null;
  participant_identity: string | null;
}) {
  return {
    id: row.id,
    call_id: row.call_id,
    from_number: row.from_number || "",
    to_number: row.to_number,
    direction: row.direction,
    started_at: new Date(row.started_at).toISOString(),
    ended_at: row.ended_at ? new Date(row.ended_at).toISOString() : null,
    duration_seconds: row.duration_seconds || 0,
    status: row.status,
    trunk_id: row.trunk_id,
    room_name: row.room_name,
    participant_identity: row.participant_identity,
  };
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function parseStringMap(value: unknown): Record<string, string> | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).map(([key, item]) => [key, String(item)]),
      );
    } catch {
      return undefined;
    }
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, String(item)]),
    );
  }
  return undefined;
}

function parseTrunkNumbers(payload: Record<string, unknown>) {
  return parseStringList(
    hasOwn(payload, "inbound_numbers_regex") ? payload.inbound_numbers_regex : payload.numbers,
  );
}

function buildRuleProto(input: {
  ruleType: "direct" | "individual" | "callee";
  roomName?: string;
  roomPrefix?: string;
  pin?: string;
  randomize?: boolean;
}) {
  if (input.ruleType === "direct") {
    return new SIPDispatchRule({
      rule: {
        case: "dispatchRuleDirect",
        value: new SIPDispatchRuleDirect({
          roomName: input.roomName || "default-sip-room",
          pin: input.pin || "",
        }),
      },
    });
  }

  if (input.ruleType === "individual") {
    return new SIPDispatchRule({
      rule: {
        case: "dispatchRuleIndividual",
        value: new SIPDispatchRuleIndividual({
          roomPrefix: input.roomPrefix || "inbound-",
          pin: input.pin || "",
        }),
      },
    });
  }

  return new SIPDispatchRule({
    rule: {
      case: "dispatchRuleCallee",
      value: new SIPDispatchRuleCallee({
        roomPrefix: input.roomPrefix || "inbound-",
        pin: input.pin || "",
        randomize: input.randomize === true,
      }),
    },
  });
}

function normalizedRuleType(value: unknown): "direct" | "individual" | "callee" | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "direct") return "direct";
  if (normalized === "individual") return "individual";
  if (normalized === "callee") return "callee";
  return null;
}

function detectRuleType(rule: SIPDispatchRuleInfo): "direct" | "individual" | "callee" {
  const ruleCase = rule.rule?.rule.case;
  if (ruleCase === "dispatchRuleIndividual") return "individual";
  if (ruleCase === "dispatchRuleCallee") return "callee";
  return "direct";
}

function listUpdate(values: string[]) {
  return new ListUpdate({ set: values });
}

async function requireAdmin(request: NextRequest): Promise<Claims | NextResponse> {
  const claims = requireAuth(request, { admin: true });
  if (claims instanceof NextResponse) return claims;
  return claims;
}

async function resolveOptionalProject(
  claims: Claims,
  projectIdentifier: string | null | undefined,
) {
  if (!projectIdentifier) return null;
  return resolveOwnedProjectId(projectIdentifier, claims.sub);
}

async function resolveScopeFromQuery(request: NextRequest, claims: Claims) {
  const projectIdentifier = request.nextUrl.searchParams.get("project_id");
  if (!projectIdentifier) return null;
  const projectId = await resolveOptionalProject(claims, projectIdentifier);
  if (!projectId) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  return projectId;
}

async function resolveScopeFromPayload(payload: Record<string, unknown>, claims: Claims) {
  const projectIdentifier =
    payload.project_id !== undefined && payload.project_id !== null
      ? String(payload.project_id)
      : null;
  if (!projectIdentifier) return null;
  const projectId = await resolveOptionalProject(claims, projectIdentifier);
  if (!projectId) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  return projectId;
}

async function resolveScopeFromPayloadOrQuery(
  request: NextRequest,
  payload: Record<string, unknown>,
  claims: Claims,
) {
  const payloadScope = await resolveScopeFromPayload(payload, claims);
  if (payloadScope instanceof NextResponse) return payloadScope;
  if (payloadScope) return payloadScope;
  return resolveScopeFromQuery(request, claims);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const claims = await requireAdmin(request);
  if (claims instanceof NextResponse) return claims;
  const { slug } = await resolveParams(context.params);

  if (slug.length === 1 && slug[0] === "sip-trunks") {
    const projectScope = await resolveScopeFromQuery(request, claims);
    if (projectScope instanceof NextResponse) return projectScope;
    const [inbound, outbound] = await Promise.all([
      livekit.sip.listSipInboundTrunk(),
      livekit.sip.listSipOutboundTrunk(),
    ]);

    const trunks = [
      ...inbound
        .filter((trunk) => metadataInScope(trunk.metadata, claims.sub, projectScope))
        .map(mapInboundTrunk),
      ...outbound
        .filter((trunk) => metadataInScope(trunk.metadata, claims.sub, projectScope))
        .map(mapOutboundTrunk),
    ];
    return NextResponse.json(trunks);
  }

  if (slug.length === 1 && slug[0] === "dispatch-rules") {
    const projectScope = await resolveScopeFromQuery(request, claims);
    if (projectScope instanceof NextResponse) return projectScope;
    const rules = await livekit.sip.listSipDispatchRule();
    return NextResponse.json(
      rules
        .filter((rule) => metadataInScope(rule.metadata, claims.sub, projectScope))
        .map(mapDispatchRule),
    );
  }

  if (slug.length === 1 && slug[0] === "call-logs") {
    const projectScope = await resolveScopeFromQuery(request, claims);
    if (projectScope instanceof NextResponse) return projectScope;
    const limit = Math.max(
      1,
      Math.min(
        200,
        Number.parseInt(request.nextUrl.searchParams.get("limit") || "50", 10) || 50,
      ),
    );

    // Sync call logs with room states first
    const { syncCallLogs } = await import("@/lib/server/resource-sync");
    await syncCallLogs();

    const rows = await query<{
      id: string;
      call_id: string;
      from_number: string | null;
      to_number: string;
      direction: "inbound" | "outbound";
      started_at: string | Date;
      ended_at: string | Date | null;
      duration_seconds: number | null;
      status: string;
      trunk_id: string | null;
      room_name: string | null;
      participant_identity: string | null;
      project_id: string | null;
      metadata: string | null;
      sip_call_id: string | null;
      room_sid: string | null;
      hangup_cause: string | null;
      recording_url: string | null;
    }>(
      `
        SELECT
          id, call_id, from_number, to_number, direction, started_at, ended_at, duration_seconds,
          status, trunk_id, room_name, participant_identity, project_id, metadata,
          sip_call_id, room_sid, hangup_cause, recording_url
        FROM call_logs
        WHERE metadata LIKE $1
          ${projectScope ? "AND project_id = $2" : ""}
        ORDER BY started_at DESC
        LIMIT ${projectScope ? "$3" : "$2"}
      `,
      projectScope
        ? [`%\"owner_user_id\":\"${claims.sub}\"%`, projectScope, limit]
        : [`%\"owner_user_id\":\"${claims.sub}\"%`, limit],
    );

    return NextResponse.json(rows.rows.map((row) => ({
      ...callLogResponse(row),
      sip_call_id: row.sip_call_id,
      room_sid: row.room_sid,
      hangup_cause: row.hangup_cause,
      recording_url: row.recording_url,
    })));
  }

  return NextResponse.json({ error: "Not Found" }, { status: 404 });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const claims = await requireAdmin(request);
  if (claims instanceof NextResponse) return claims;
  const { slug } = await resolveParams(context.params);
  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  if (slug.length === 1 && slug[0] === "sip-trunks") {
    const projectScope = await resolveScopeFromPayload(payload, claims);
    if (projectScope instanceof NextResponse) return projectScope;

    const name = String(payload.name || "").trim() || "default-trunk";
    const numbers =
      (Array.isArray(payload.inbound_numbers_regex)
        ? payload.inbound_numbers_regex
        : Array.isArray(payload.numbers)
          ? payload.numbers
          : []
      ).map((item) => String(item).trim()).filter(Boolean);
    const metadata = encodeScopeMetadata({
      owner_user_id: claims.sub,
      project_id: projectScope || undefined,
      client_metadata: payload.metadata ? String(payload.metadata) : null,
    });

    const outboundAddress = payload.outbound_address
      ? String(payload.outbound_address)
      : payload.sip_server
        ? String(payload.sip_server)
        : "";
    const transportRaw = String(payload.transport || "").trim().toLowerCase();
    const transport =
      transportRaw === "udp"
        ? SIPTransport.SIP_TRANSPORT_UDP
        : transportRaw === "tls"
          ? SIPTransport.SIP_TRANSPORT_TLS
          : transportRaw === "tcp"
            ? SIPTransport.SIP_TRANSPORT_TCP
            : SIPTransport.SIP_TRANSPORT_AUTO;
    const headers = parseStringMap(payload.headers);
    const headersToAttributes = parseStringMap(payload.headers_to_attributes);

    if (outboundAddress) {
      const created = await livekit.sip.createSipOutboundTrunk(name, outboundAddress, numbers, {
        metadata,
        transport,
        destinationCountry: payload.destination_country
          ? String(payload.destination_country).toUpperCase()
          : undefined,
        headers,
        headersToAttributes,
        authUsername: payload.outbound_username
          ? String(payload.outbound_username)
          : payload.username
            ? String(payload.username)
            : undefined,
        authPassword: payload.outbound_password
          ? String(payload.outbound_password)
          : payload.password
            ? String(payload.password)
            : undefined,
      });
      return NextResponse.json(mapOutboundTrunk(created), { status: 201 });
    }

    const created = await livekit.sip.createSipInboundTrunk(name, numbers, {
      metadata,
      allowedAddresses: Array.isArray(payload.inbound_addresses)
        ? payload.inbound_addresses.map((item) => String(item))
        : undefined,
      allowedNumbers: numbers,
      headers,
      headersToAttributes,
      authUsername: payload.inbound_username
        ? String(payload.inbound_username)
        : payload.username
          ? String(payload.username)
          : undefined,
      authPassword: payload.inbound_password
        ? String(payload.inbound_password)
        : payload.password
          ? String(payload.password)
          : undefined,
    });
    return NextResponse.json(mapInboundTrunk(created), { status: 201 });
  }

  if (slug.length === 1 && slug[0] === "dispatch-rules") {
    const projectScope = await resolveScopeFromPayload(payload, claims);
    if (projectScope instanceof NextResponse) return projectScope;

    const ruleType = normalizedRuleType(payload.rule_type) || "direct";
    const metadata = encodeScopeMetadata({
      owner_user_id: claims.sub,
      project_id: projectScope || undefined,
      client_metadata: payload.metadata ? String(payload.metadata) : null,
    });

    const trunkIds = Array.isArray(payload.trunk_ids)
      ? payload.trunk_ids.map((item) => String(item))
      : payload.trunk_id
        ? [String(payload.trunk_id)]
        : [];

    const opts = {
      name: String(payload.name || ""),
      metadata,
      trunkIds,
      hidePhoneNumber: payload.hide_phone_number === true,
      attributes: payload.agent_id ? { agent_id: String(payload.agent_id) } : undefined,
    };

    if (ruleType === "direct") {
      const created = await livekit.sip.createSipDispatchRule(
        {
          type: "direct",
          roomName: String(payload.room_name || "default-sip-room"),
          pin: payload.pin ? String(payload.pin) : undefined,
        },
        opts,
      );
      return NextResponse.json(mapDispatchRule(created), { status: 201 });
    }

    if (ruleType === "individual") {
      const created = await livekit.sip.createSipDispatchRule(
        {
          type: "individual",
          roomPrefix: String(payload.room_prefix || "inbound-"),
          pin: payload.pin ? String(payload.pin) : undefined,
        },
        opts,
      );
      return NextResponse.json(mapDispatchRule(created), { status: 201 });
    }

    // SDK create helper currently exposes direct/individual only; convert immediately to callee.
    const created = await livekit.sip.createSipDispatchRule(
      {
        type: "individual",
        roomPrefix: String(payload.room_prefix || "inbound-"),
        pin: payload.pin ? String(payload.pin) : undefined,
      },
      opts,
    );
    const updated = await livekit.sip.updateSipDispatchRuleFields(created.sipDispatchRuleId, {
      rule: buildRuleProto({
        ruleType: "callee",
        roomPrefix: String(payload.room_prefix || "inbound-"),
        pin: payload.pin ? String(payload.pin) : "",
        randomize: payload.randomize === true,
      }),
    });
    return NextResponse.json(mapDispatchRule(updated), { status: 201 });
  }

  if (slug.length === 1 && slug[0] === "outbound-call") {
    const projectScope = await resolveScopeFromPayload(payload, claims);
    if (projectScope instanceof NextResponse) return projectScope;
    const trunkId = String(payload.trunk_id || "").trim();
    const toNumber = String(payload.to_number || "").trim();
    if (!trunkId || !toNumber) {
      return NextResponse.json({ error: "trunk_id and to_number are required" }, { status: 400 });
    }

    const [inbound, outbound] = await Promise.all([
      livekit.sip.listSipInboundTrunk(),
      livekit.sip.listSipOutboundTrunk(),
    ]);
    const trunkExists =
      inbound.some(
        (trunk) =>
          trunk.sipTrunkId === trunkId &&
          metadataInScope(trunk.metadata, claims.sub, projectScope),
      ) ||
      outbound.some(
        (trunk) =>
          trunk.sipTrunkId === trunkId &&
          metadataInScope(trunk.metadata, claims.sub, projectScope),
      );

    if (!trunkExists) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const roomName = scopeName(
      String(payload.room_name || `sip-${randomUUID().slice(0, 8)}`),
      projectScope || "global",
    );
    const participantIdentity =
      String(payload.participant_identity || "").trim() ||
      `sip-caller-${randomUUID().slice(0, 8)}`;

    const participant = await livekit.sip.createSipParticipant(trunkId, toNumber, roomName, {
      participantIdentity,
      participantName: participantIdentity,
    });

    const id = randomUUID();
    await query(
      `
        INSERT INTO call_logs (
          id, call_id, from_number, to_number, direction, started_at, ended_at,
          duration_seconds, status, trunk_id, room_name, participant_identity,
          project_id, metadata, created_at
        ) VALUES (
          $1, $2, $3, $4, 'outbound', NOW(), NULL, 0, 'ringing', $5, $6, $7, $8, $9, NOW()
        )
      `,
      [
        id,
        participant.sipCallId,
        "",
        toNumber,
        trunkId,
        roomName,
        participantIdentity,
        projectScope,
        encodeScopeMetadata({
          owner_user_id: claims.sub,
          project_id: projectScope || undefined,
        }),
      ],
    );

    return NextResponse.json(
      {
        id,
        call_id: participant.sipCallId,
        from_number: "",
        to_number: toNumber,
        direction: "outbound",
        started_at: new Date().toISOString(),
        ended_at: null,
        duration_seconds: 0,
        status: "ringing",
        trunk_id: trunkId,
        room_name: roomName,
        participant_identity: participantIdentity,
      },
      { status: 201 },
    );
  }

  if (slug.length === 3 && slug[0] === "calls" && slug[2] === "end") {
    const callId = slug[1];
    const projectScope = await resolveScopeFromQuery(request, claims);
    if (projectScope instanceof NextResponse) return projectScope;

    const row = await query<{
      id: string;
      call_id: string;
      started_at: string | Date;
      room_name: string | null;
      participant_identity: string | null;
    }>(
      `
        SELECT id, call_id, started_at, room_name, participant_identity
        FROM call_logs
        WHERE (call_id = $1 OR id = $1)
          AND metadata LIKE $2
          ${projectScope ? "AND project_id = $3" : ""}
        LIMIT 1
      `,
      projectScope
        ? [callId, `%\"owner_user_id\":\"${claims.sub}\"%`, projectScope]
        : [callId, `%\"owner_user_id\":\"${claims.sub}\"%`],
    );
    const call = row.rows[0];
    if (!call) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    if (call.room_name && call.participant_identity) {
      try {
        await livekit.room.removeParticipant(call.room_name, call.participant_identity);
      } catch {
        // Ignore removal errors during call termination.
      }
    }

    await query(
      `
        UPDATE call_logs
        SET
          status = 'ended',
          ended_at = NOW(),
          duration_seconds = GREATEST(
            0,
            EXTRACT(EPOCH FROM (NOW() - started_at))::int
          )
        WHERE id = $1
      `,
      [call.id],
    );

    return new NextResponse(null, { status: 200 });
  }

  return NextResponse.json({ error: "Not Found" }, { status: 404 });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const claims = await requireAdmin(request);
  if (claims instanceof NextResponse) return claims;
  const { slug } = await resolveParams(context.params);
  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  if (slug.length === 2 && slug[0] === "sip-trunks") {
    const trunkId = slug[1];
    const projectScope = await resolveScopeFromPayloadOrQuery(request, payload, claims);
    if (projectScope instanceof NextResponse) return projectScope;

    const [inbound, outbound] = await Promise.all([
      livekit.sip.listSipInboundTrunk(),
      livekit.sip.listSipOutboundTrunk(),
    ]);

    const inboundTrunk = inbound.find(
      (trunk) =>
        trunk.sipTrunkId === trunkId && metadataInScope(trunk.metadata, claims.sub, projectScope),
    );
    const outboundTrunk = outbound.find(
      (trunk) =>
        trunk.sipTrunkId === trunkId && metadataInScope(trunk.metadata, claims.sub, projectScope),
    );

    if (!inboundTrunk && !outboundTrunk) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const hasNumbers = hasOwn(payload, "numbers") || hasOwn(payload, "inbound_numbers_regex");
    const numbers = parseTrunkNumbers(payload);
    const projectIdFromMetadata = parseScopeMetadata(
      inboundTrunk?.metadata || outboundTrunk?.metadata || "",
    ).project_id;
    const metadata =
      hasOwn(payload, "metadata") && payload.metadata !== undefined
        ? encodeScopeMetadata({
          owner_user_id: claims.sub,
          project_id: projectScope || projectIdFromMetadata || undefined,
          client_metadata: payload.metadata ? String(payload.metadata) : null,
        })
        : undefined;

    if (outboundTrunk) {
      const fields: Parameters<typeof livekit.sip.updateSipOutboundTrunkFields>[1] = {};
      if (hasOwn(payload, "name")) fields.name = String(payload.name || "");
      if (hasNumbers) fields.numbers = listUpdate(numbers);
      if (hasOwn(payload, "outbound_username") || hasOwn(payload, "username")) {
        fields.authUsername = String(payload.outbound_username || payload.username || "");
      }
      if (hasOwn(payload, "outbound_password") || hasOwn(payload, "password")) {
        fields.authPassword = String(payload.outbound_password || payload.password || "");
      }
      if (hasOwn(payload, "destination_country")) {
        fields.destinationCountry = String(payload.destination_country || "");
      }
      if (metadata !== undefined) {
        fields.metadata = metadata;
      }

      const hasUpdates = Object.keys(fields).length > 0;
      const updated = hasUpdates
        ? await livekit.sip.updateSipOutboundTrunkFields(trunkId, fields)
        : outboundTrunk;
      return NextResponse.json(mapOutboundTrunk(updated));
    }

    const fields: Parameters<typeof livekit.sip.updateSipInboundTrunkFields>[1] = {};
    if (hasOwn(payload, "name")) fields.name = String(payload.name || "");
    if (hasNumbers) fields.numbers = listUpdate(numbers);
    if (hasOwn(payload, "inbound_addresses")) {
      fields.allowedAddresses = listUpdate(parseStringList(payload.inbound_addresses));
    }
    if (hasNumbers || hasOwn(payload, "allowed_numbers")) {
      fields.allowedNumbers = listUpdate(
        hasOwn(payload, "allowed_numbers") ? parseStringList(payload.allowed_numbers) : numbers,
      );
    }
    if (hasOwn(payload, "inbound_username") || hasOwn(payload, "username")) {
      fields.authUsername = String(payload.inbound_username || payload.username || "");
    }
    if (hasOwn(payload, "inbound_password") || hasOwn(payload, "password")) {
      fields.authPassword = String(payload.inbound_password || payload.password || "");
    }
    if (metadata !== undefined) {
      fields.metadata = metadata;
    }

    const hasUpdates = Object.keys(fields).length > 0;
    const updated = hasUpdates
      ? await livekit.sip.updateSipInboundTrunkFields(trunkId, fields)
      : inboundTrunk;
    if (!updated) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    return NextResponse.json(mapInboundTrunk(updated));
  }

  if (slug.length === 2 && slug[0] === "dispatch-rules") {
    const ruleId = slug[1];
    const projectScope = await resolveScopeFromPayloadOrQuery(request, payload, claims);
    if (projectScope instanceof NextResponse) return projectScope;

    const rules = await livekit.sip.listSipDispatchRule();
    const existing = rules.find(
      (rule) =>
        rule.sipDispatchRuleId === ruleId && metadataInScope(rule.metadata, claims.sub, projectScope),
    );
    if (!existing) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const updateFields: Parameters<typeof livekit.sip.updateSipDispatchRuleFields>[1] = {};

    if (hasOwn(payload, "name")) {
      updateFields.name = String(payload.name || "");
    }

    if (hasOwn(payload, "metadata")) {
      const existingScope = parseScopeMetadata(existing.metadata);
      updateFields.metadata = encodeScopeMetadata({
        owner_user_id: claims.sub,
        project_id: projectScope || existingScope.project_id || undefined,
        client_metadata: payload.metadata ? String(payload.metadata) : null,
      });
    }

    if (hasOwn(payload, "trunk_ids") || hasOwn(payload, "trunk_id")) {
      const trunkIds = Array.isArray(payload.trunk_ids)
        ? payload.trunk_ids.map((item) => String(item))
        : payload.trunk_id
          ? [String(payload.trunk_id)]
          : [];
      updateFields.trunkIds = listUpdate(trunkIds);
    }

    if (hasOwn(payload, "agent_id")) {
      const attributes = { ...(existing.attributes || {}) };
      const agentId = String(payload.agent_id || "").trim();
      if (agentId) {
        attributes.agent_id = agentId;
      } else {
        delete attributes.agent_id;
      }
      updateFields.attributes = attributes;
    }

    const wantsRuleUpdate =
      hasOwn(payload, "rule_type") ||
      hasOwn(payload, "room_name") ||
      hasOwn(payload, "room_prefix") ||
      hasOwn(payload, "pin") ||
      hasOwn(payload, "randomize");

    if (wantsRuleUpdate) {
      const nextRuleType = normalizedRuleType(payload.rule_type) || detectRuleType(existing);
      const existingRuleCase = existing.rule?.rule.case;
      const existingRuleValue = existing.rule?.rule.value;
      const pinValue = hasOwn(payload, "pin")
        ? String(payload.pin || "")
        : existingRuleValue && "pin" in existingRuleValue
          ? String(existingRuleValue.pin || "")
          : "";

      if (nextRuleType === "direct") {
        let existingRoomName: string | undefined = undefined;
        if (existingRuleCase === "dispatchRuleDirect" && existingRuleValue && "roomName" in existingRuleValue) {
          existingRoomName = (existingRuleValue as { roomName?: string }).roomName;
        }
        updateFields.rule = buildRuleProto({
          ruleType: "direct",
          roomName: String(payload.room_name || existingRoomName || "default-sip-room"),
          pin: pinValue,
        });
      } else if (nextRuleType === "individual") {
        let existingRoomPrefix: string | undefined = undefined;
        if (existingRuleCase === "dispatchRuleIndividual" && existingRuleValue && "roomPrefix" in existingRuleValue) {
          existingRoomPrefix = (existingRuleValue as { roomPrefix?: string }).roomPrefix;
        }
        updateFields.rule = buildRuleProto({
          ruleType: "individual",
          roomPrefix: String(payload.room_prefix || existingRoomPrefix || "inbound-"),
          pin: pinValue,
        });
      } else {
        let existingRoomPrefix: string | undefined = undefined;
        let existingRandomize: boolean | undefined = undefined;
        if (existingRuleCase === "dispatchRuleCallee" && existingRuleValue) {
          if ("roomPrefix" in existingRuleValue) {
            existingRoomPrefix = (existingRuleValue as { roomPrefix?: string }).roomPrefix;
          }
          if ("randomize" in existingRuleValue) {
            existingRandomize = (existingRuleValue as { randomize?: boolean }).randomize;
          }
        }
        updateFields.rule = buildRuleProto({
          ruleType: "callee",
          roomPrefix: String(payload.room_prefix || existingRoomPrefix || "inbound-"),
          pin: pinValue,
          randomize:
            hasOwn(payload, "randomize") && payload.randomize !== undefined
              ? payload.randomize === true
              : existingRandomize === true,
        });
      }
    }

    const hasUpdates = Object.keys(updateFields).length > 0;
    const updated = hasUpdates
      ? await livekit.sip.updateSipDispatchRuleFields(ruleId, updateFields)
      : existing;
    return NextResponse.json(mapDispatchRule(updated));
  }

  return NextResponse.json({ error: "Not Found" }, { status: 404 });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const claims = await requireAdmin(request);
  if (claims instanceof NextResponse) return claims;
  const { slug } = await resolveParams(context.params);
  const projectScope = await resolveScopeFromQuery(request, claims);
  if (projectScope instanceof NextResponse) return projectScope;

  if (slug.length === 2 && slug[0] === "sip-trunks") {
    const trunkId = slug[1];
    const [inbound, outbound] = await Promise.all([
      livekit.sip.listSipInboundTrunk(),
      livekit.sip.listSipOutboundTrunk(),
    ]);
    const inScope =
      inbound.some(
        (trunk) =>
          trunk.sipTrunkId === trunkId &&
          metadataInScope(trunk.metadata, claims.sub, projectScope),
      ) ||
      outbound.some(
        (trunk) =>
          trunk.sipTrunkId === trunkId &&
          metadataInScope(trunk.metadata, claims.sub, projectScope),
      );
    if (!inScope) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    await livekit.sip.deleteSipTrunk(trunkId);
    return new NextResponse(null, { status: 200 });
  }

  if (slug.length === 2 && slug[0] === "dispatch-rules") {
    const ruleId = slug[1];
    const rules = await livekit.sip.listSipDispatchRule();
    const inScope = rules.some(
      (rule) =>
        rule.sipDispatchRuleId === ruleId &&
        metadataInScope(rule.metadata, claims.sub, projectScope),
    );
    if (!inScope) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    await livekit.sip.deleteSipDispatchRule(ruleId);
    return new NextResponse(null, { status: 200 });
  }

  return NextResponse.json({ error: "Not Found" }, { status: 404 });
}
