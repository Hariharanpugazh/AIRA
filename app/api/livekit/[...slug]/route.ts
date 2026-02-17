import { randomUUID } from "node:crypto";
import {
  AccessToken,
  EgressStatus,
  IngressInput,
  TrackSource,
  type ParticipantPermission,
} from "livekit-server-sdk";
import { EncodedFileOutput, EncodedFileType, ImageOutput } from "@livekit/protocol";
import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { requireAuth } from "@/lib/server/guards";
import { livekit } from "@/lib/server/livekit";
import { resolveOwnedProjectId } from "@/lib/server/project";
import {
  projectPrefix,
  scopeName,
  unscopeName,
} from "@/lib/server/scopes";
import { hashPassword } from "@/lib/server/auth";
import { syncAllResources } from "@/lib/server/resource-sync";

type RouteContext = {
  params: Promise<{ slug: string[] }> | { slug: string[] };
};

type Claims = {
  sub: string;
  email: string;
  name: string;
  is_admin: boolean;
};

type EgressScopeState = {
  byEgressId: Map<string, string>;
};

const globalState = globalThis as typeof globalThis & {
  __airaEgressScope?: EgressScopeState;
};

const egressScopeState: EgressScopeState =
  globalState.__airaEgressScope || { byEgressId: new Map() };
if (!globalState.__airaEgressScope) {
  globalState.__airaEgressScope = egressScopeState;
}

function resolveParams(params: RouteContext["params"]) {
  if ("then" in params) return params;
  return Promise.resolve(params);
}

function wsUrlFromHost(host: string) {
  if (host.startsWith("https://")) return host.replace("https://", "wss://");
  if (host.startsWith("http://")) return host.replace("http://", "ws://");
  return host;
}

function toNumber(value: bigint | number | undefined | null) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return 0;
}

function mapRoom(room: {
  sid: string;
  name: string;
  emptyTimeout: number;
  maxParticipants: number;
  creationTime: bigint;
  numParticipants: number;
  activeRecording: boolean;
}) {
  return {
    sid: room.sid,
    name: room.name,
    empty_timeout: room.emptyTimeout,
    max_participants: room.maxParticipants,
    creation_time: toNumber(room.creationTime),
    num_participants: room.numParticipants,
    active_recording: room.activeRecording,
  };
}

function mapIngress(
  ingress: {
    ingressId: string;
    name: string;
    streamKey: string;
    url: string;
    inputType: number;
    roomName: string;
    participantIdentity: string;
    participantName: string;
    reusable: boolean;
    state?: {
      status: number;
      error: string;
      roomId: string;
      startedAt: bigint;
      endedAt: bigint;
      resourceId: string;
      tracks: Array<{ sid: string }>;
    };
  },
  projectId: string,
) {
  const statusMap: Record<number, string> = {
    0: "endpoint_inactive",
    1: "endpoint_buffering",
    2: "endpoint_publishing",
    3: "endpoint_error",
    4: "endpoint_complete",
  };
  const ingressType = ingress.inputType === 1 ? "whip" : ingress.inputType === 2 ? "url" : "rtmp";

  return {
    ingress_id: ingress.ingressId,
    name: ingress.name,
    stream_key: ingress.streamKey,
    url: ingress.url,
    input_type: ingress.inputType,
    ingress_type: ingressType,
    status: ingress.state ? statusMap[ingress.state.status] || "inactive" : "inactive",
    room_name: unscopeName(ingress.roomName, projectId),
    participant_identity: unscopeName(ingress.participantIdentity, projectId),
    participant_name: ingress.participantName,
    reusable: ingress.reusable,
    state: ingress.state
      ? {
        status: String(ingress.state.status),
        error: ingress.state.error,
        room_id: ingress.state.roomId,
        started_at: toNumber(ingress.state.startedAt),
        ended_at: toNumber(ingress.state.endedAt),
        resource_id: ingress.state.resourceId,
        tracks: ingress.state.tracks.map((track) => track.sid),
      }
      : null,
    project_id: projectId,
  };
}

function mapEgress(
  egress: {
    egressId: string;
    roomId: string;
    roomName: string;
    status: number;
    startedAt: bigint;
    endedAt: bigint;
    error: string;
  },
  projectId?: string,
  forceRoomName?: string,
) {
  const statusName =
    typeof egress.status === "number"
      ? String(EgressStatus[egress.status] || egress.status)
      : String(egress.status);

  return {
    egress_id: egress.egressId,
    room_id: egress.roomId || null,
    room_name:
      forceRoomName ||
      (projectId && egress.roomName ? unscopeName(egress.roomName, projectId) : egress.roomName),
    status: statusName,
    started_at: toNumber(egress.startedAt) || null,
    ended_at: toNumber(egress.endedAt) || null,
    error: egress.error || null,
    project_id: projectId || null,
  };
}

function resolveIngressInput(type: string) {
  const normalized = type.trim().toLowerCase();
  if (normalized === "whip") return IngressInput.WHIP_INPUT;
  if (normalized === "url") return IngressInput.URL_INPUT;
  return IngressInput.RTMP_INPUT;
}

function createEncodedOutput(filepath: string) {
  return {
    file: new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath,
      disableManifest: true,
    }),
  };
}

async function authForLivekit(
  request: NextRequest,
  requireAdmin: boolean,
): Promise<Claims | NextResponse> {
  const claims = requireAuth(request, { admin: requireAdmin });
  if (claims instanceof NextResponse) return claims;
  return claims;
}

async function resolveScopedProject(
  claims: Claims,
  projectIdentifier: string | null | undefined,
) {
  if (!projectIdentifier) return null;
  return resolveOwnedProjectId(projectIdentifier, claims.sub);
}

async function resolveQueryProject(
  request: NextRequest,
  claims: Claims,
  required: boolean,
) {
  const projectIdentifier = request.nextUrl.searchParams.get("project_id");
  if (!projectIdentifier) {
    if (!required) return null;
    return NextResponse.json(
      { error: "Bad Request", message: "project_id is required" },
      { status: 400 },
    );
  }
  const projectId = await resolveScopedProject(claims, projectIdentifier);
  if (!projectId) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  return projectId;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const claims = await authForLivekit(request, true);
  if (claims instanceof NextResponse) return claims;
  const { slug } = await resolveParams(context.params);

  if (slug.length === 1 && slug[0] === "health") {
    try {
      await livekit.room.listRooms();
      return NextResponse.json({ status: "healthy", service: "livekit" });
    } catch (error) {
      return NextResponse.json(
        { status: "unhealthy", error: error instanceof Error ? error.message : "unknown_error" },
        { status: 503 },
      );
    }
  }

  if (slug.length === 1 && slug[0] === "stats") {
    const rooms = await livekit.room.listRooms();
    const activeRooms = rooms.length;
    const totalParticipants = rooms.reduce((acc, room) => acc + room.numParticipants, 0);
    return NextResponse.json({
      active_rooms: activeRooms,
      total_participants: totalParticipants,
      status: "healthy",
    });
  }

  if (slug.length === 1 && slug[0] === "rooms") {
    const rooms = await livekit.room.listRooms();
    return NextResponse.json(rooms.map(mapRoom));
  }

  if (slug.length === 2 && slug[0] === "rooms") {
    const roomName = decodeURIComponent(slug[1]);
    const rooms = await livekit.room.listRooms([roomName]);
    const room = rooms.find((item) => item.name === roomName);
    if (!room) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    const participants = await livekit.room.listParticipants(roomName);
    return NextResponse.json({
      room: {
        sid: room.sid,
        name: room.name,
        participants: room.numParticipants,
        active_recording: room.activeRecording,
        creation_time: toNumber(room.creationTime),
        enabled_codecs: room.enabledCodecs || [],
      },
      participants: participants.map((participant) => ({
        sid: participant.sid,
        identity: participant.identity,
        name: participant.name,
        state: participant.state,
        joined_at: toNumber(participant.joinedAt),
        is_publisher: participant.isPublisher,
        tracks: participant.tracks.map((track) => ({
          sid: track.sid,
          source:
            typeof track.source === "number"
              ? String(TrackSource[track.source] || track.source)
              : String(track.source),
          mime_type: track.mimeType,
          muted: track.muted,
        })),
      })),
      participant_count: participants.length,
    });
  }

  if (slug.length === 3 && slug[0] === "rooms" && slug[2] === "participants") {
    const roomName = decodeURIComponent(slug[1]);
    const participants = await livekit.room.listParticipants(roomName);
    return NextResponse.json(
      participants.map((participant) => ({
        sid: participant.sid,
        identity: participant.identity,
        name: participant.name,
        state: participant.state,
        joined_at: toNumber(participant.joinedAt),
      })),
    );
  }

  if (slug.length === 3 && slug[0] === "rooms" && slug[2] === "rtc-stats") {
    const roomName = decodeURIComponent(slug[1]);
    const rooms = await livekit.room.listRooms([roomName]);
    const room = rooms.find((item) => item.name === roomName);
    if (!room) {
      return NextResponse.json(
        {
          success: false,
          error: "Room not found",
          room_name: roomName,
        },
        { status: 404 },
      );
    }

    const participants = await livekit.room.listParticipants(roomName);
    const publisherStats = participants
      .filter((participant) => participant.isPublisher)
      .map((participant) => ({
        identity: participant.identity,
        track_count: participant.tracks.length,
        published_tracks: participant.tracks.map((track) => ({
          sid: track.sid,
          source:
            typeof track.source === "number"
              ? String(TrackSource[track.source] || track.source)
              : String(track.source),
          muted: track.muted,
        })),
      }));
    const subscriberStats = participants.map((participant) => ({
      identity: participant.identity,
      state: participant.state,
      joined_at: toNumber(participant.joinedAt),
    }));

    return NextResponse.json({
      success: true,
      data: {
        room_name: roomName,
        room_sid: room.sid,
        active_recording: room.activeRecording,
        participant_count: participants.length,
        publisher_stats: publisherStats,
        subscriber_stats: subscriberStats,
      },
      latency_ms: null,
    });
  }

  if (slug.length === 1 && slug[0] === "token") {
    const identity = request.nextUrl.searchParams.get("identity") || claims.sub;
    const room = request.nextUrl.searchParams.get("room") || "default-room";
    const accessToken = new AccessToken(
      serverEnv.LIVEKIT_API_KEY,
      serverEnv.LIVEKIT_API_SECRET,
      {
        identity,
        name: identity,
        ttl: "24h",
      },
    );
    accessToken.addGrant({
      roomCreate: claims.is_admin,
      roomList: claims.is_admin,
      roomJoin: true,
      room,
      roomAdmin: claims.is_admin,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
      ingressAdmin: claims.is_admin,
    });
    const token = await accessToken.toJwt();

    return NextResponse.json({
      token,
      ws_url: wsUrlFromHost(serverEnv.LIVEKIT_HOST),
      room,
      identity,
    });
  }

  if (slug.length === 1 && slug[0] === "api-keys") {
    const projectScope = await resolveQueryProject(request, claims, false);
    if (projectScope instanceof NextResponse) return projectScope;
    const rows = await query<{
      id: string;
      name: string;
      key: string;
      created_at: string | Date;
      is_active: boolean;
    }>(
      `
        SELECT id, name, key, created_at, is_active
        FROM api_keys
        WHERE is_active = true
          AND user_id = $1
          ${projectScope ? "AND project_id = $2" : ""}
        ORDER BY created_at DESC
      `,
      projectScope ? [claims.sub, projectScope] : [claims.sub],
    );

    return NextResponse.json(
      rows.rows.map((row) => ({
        id: row.id,
        name: row.name,
        key: row.key,
        key_prefix: row.key.slice(0, 12),
        secret_key: null,
        created_at: new Date(row.created_at).toISOString(),
        is_active: row.is_active,
      })),
    );
  }

  if (slug.length === 1 && slug[0] === "ingresses") {
    const projectId = await resolveQueryProject(request, claims, true);
    if (projectId instanceof NextResponse) return projectId;
    if (!projectId) {
      return NextResponse.json(
        { error: "Bad Request", message: "project_id is required" },
        { status: 400 },
      );
    }

    await syncAllResources();

    const rows = await query<{
      id: string;
      name: string;
      input_type: string;
      room_name: string | null;
      stream_key: string | null;
      url: string | null;
    }>(
      `
        SELECT id, name, input_type, room_name, stream_key, url
        FROM ingress
        WHERE project_id = $1
        ORDER BY created_at DESC
      `,
      [projectId],
    );

    return NextResponse.json(
      rows.rows.map((row) => ({
        ingress_id: row.id,
        name: row.name,
        input_type: Number(row.input_type),
        ingress_type: row.input_type === "1" ? "whip" : row.input_type === "2" ? "url" : "rtmp",
        status: "active", // Database currently lacks the granular LiveKit state
        room_name: unscopeName(row.room_name || "", projectId),
        stream_key: row.stream_key,
        url: row.url,
      })),
    );
  }

  if (slug.length === 1 && slug[0] === "egresses") {
    const projectId = await resolveQueryProject(request, claims, true);
    if (projectId instanceof NextResponse) return projectId;
    if (!projectId) {
      return NextResponse.json(
        { error: "Bad Request", message: "project_id is required" },
        { status: 400 },
      );
    }

    await syncAllResources();

    const rows = await query<{
      id: string;
      room_name: string | null;
      egress_type: string;
      output_type: string | null;
      output_url: string | null;
      is_active: boolean;
      created_at: string | Date;
    }>(
      `
        SELECT id, room_name, egress_type, output_type, output_url, is_active, created_at
        FROM egress
        WHERE project_id = $1
        ORDER BY created_at DESC
      `,
      [projectId],
    );

    return NextResponse.json(
      rows.rows.map((row) => ({
        egress_id: row.id,
        room_name: unscopeName(row.room_name || "", projectId),
        status: row.is_active ? "active" : "finished",
        egress_type: row.egress_type,
        output_type: row.output_type,
        output_url: row.output_url,
        started_at: new Date(row.created_at).getTime(),
      })),
    );
  }

  return NextResponse.json({ error: "Not Found" }, { status: 404 });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { slug } = await resolveParams(context.params);
  const requireAdmin = !(slug.length === 1 && slug[0] === "token");
  const claims = await authForLivekit(request, requireAdmin);
  if (claims instanceof NextResponse) return claims;
  const payload = (await request.json()) as Record<string, unknown>;

  if (slug.length === 1 && slug[0] === "rooms") {
    const name = String(payload.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Room name is required" }, { status: 400 });
    }
    const room = await livekit.room.createRoom({
      name,
      emptyTimeout: Number(payload.empty_timeout || 0) || 0,
      maxParticipants: Number(payload.max_participants || 0) || 0,
    });
    return NextResponse.json(mapRoom(room), { status: 201 });
  }

  if (slug.length === 1 && slug[0] === "token") {
    const roomName = String(payload.room_name || "").trim();
    if (!roomName) {
      return NextResponse.json({ error: "room_name is required" }, { status: 400 });
    }
    const identity = String(payload.identity || claims.sub);

    const accessToken = new AccessToken(
      serverEnv.LIVEKIT_API_KEY,
      serverEnv.LIVEKIT_API_SECRET,
      {
        identity,
        name: identity,
        ttl: "24h",
      },
    );
    accessToken.addGrant({
      roomCreate: claims.is_admin,
      roomList: claims.is_admin,
      roomJoin: true,
      room: roomName,
      roomAdmin: claims.is_admin,
      canPublish: payload.can_publish !== false,
      canSubscribe: payload.can_subscribe !== false,
      canPublishData: true,
      canUpdateOwnMetadata: true,
      ingressAdmin: claims.is_admin,
    });
    const token = await accessToken.toJwt();

    return NextResponse.json({
      token,
      ws_url: wsUrlFromHost(serverEnv.LIVEKIT_HOST),
      room: roomName,
      identity,
    });
  }

  if (slug.length === 1 && slug[0] === "api-keys") {
    const name = String(payload.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const projectId = payload.project_id
      ? await resolveScopedProject(claims, String(payload.project_id))
      : null;
    if (payload.project_id && !projectId) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const key = `lk_${randomUUID().replace(/-/g, "")}`;
    const secret = `sk_${randomUUID().replace(/-/g, "")}`;
    const secretHash = await hashPassword(secret);
    const id = randomUUID();

    await query(
      `
        INSERT INTO api_keys (id, user_id, project_id, name, key, secret_hash, secret, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
      `,
      [id, claims.sub, projectId, name, key, secretHash, secret],
    );

    return NextResponse.json(
      {
        id,
        name,
        key,
        key_prefix: key.slice(0, 12),
        secret_key: secret,
        created_at: new Date().toISOString(),
        is_active: true,
      },
      { status: 201 },
    );
  }

  if (slug.length === 3 && slug[0] === "rooms" && slug[2] === "participants") {
    return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
  }

  if (
    slug.length === 5 &&
    slug[0] === "rooms" &&
    slug[2] === "participants" &&
    slug[4] === "mute"
  ) {
    const roomName = decodeURIComponent(slug[1]);
    const identity = decodeURIComponent(slug[3]);
    const muted = payload.muted !== false;
    const trackSid = payload.track_sid ? String(payload.track_sid) : null;

    if (trackSid) {
      await livekit.room.mutePublishedTrack(roomName, identity, trackSid, muted);
    } else {
      const participant = await livekit.room.getParticipant(roomName, identity);
      for (const track of participant.tracks) {
        await livekit.room.mutePublishedTrack(roomName, identity, track.sid, muted);
      }
    }
    return new NextResponse(null, { status: 204 });
  }

  if (
    slug.length === 5 &&
    slug[0] === "rooms" &&
    slug[2] === "participants" &&
    (slug[4] === "update" || slug[4] === "permissions")
  ) {
    const roomName = decodeURIComponent(slug[1]);
    const identity = decodeURIComponent(slug[3]);

    const permissionPayload =
      typeof payload.permission === "object" && payload.permission
        ? (payload.permission as Record<string, unknown>)
        : payload;

    const permission: Partial<ParticipantPermission> | undefined =
      payload.permission ||
        payload.can_publish !== undefined ||
        payload.can_subscribe !== undefined ||
        payload.can_publish_data !== undefined ||
        payload.hidden !== undefined ||
        payload.can_update_metadata !== undefined ||
        payload.can_subscribe_metrics !== undefined
        ? {
          canPublish: Boolean(permissionPayload.can_publish),
          canSubscribe: Boolean(permissionPayload.can_subscribe),
          canPublishData: Boolean(permissionPayload.can_publish_data),
          hidden: Boolean(permissionPayload.hidden),
          canUpdateMetadata: Boolean(permissionPayload.can_update_metadata),
          canSubscribeMetrics: Boolean(permissionPayload.can_subscribe_metrics),
        }
        : undefined;

    await livekit.room.updateParticipant(roomName, identity, {
      name: payload.name ? String(payload.name) : undefined,
      metadata: payload.metadata ? String(payload.metadata) : undefined,
      permission,
    });

    return new NextResponse(null, { status: 204 });
  }

  if (slug.length === 1 && slug[0] === "ingress") {
    const projectId = await resolveScopedProject(claims, String(payload.project_id || ""));
    if (!projectId) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }

    const name = String(payload.name || "").trim();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const ingressType = String(payload.ingress_type || "rtmp");
    const inputType = resolveIngressInput(ingressType);

    const userRoomName = String(payload.room_name || name);
    const userIdentity = String(
      payload.participant_identity || `ingress-${name.toLowerCase().replace(/\s+/g, "-")}`,
    );
    const participantName = String(payload.participant_name || name);
    const roomName = scopeName(userRoomName, projectId);
    const participantIdentity = scopeName(userIdentity, projectId);

    const ingress = await livekit.ingress.createIngress(inputType, {
      name,
      roomName,
      participantIdentity,
      participantName,
    });

    await query(
      `
        INSERT INTO ingress (id, name, input_type, room_name, stream_key, url, is_enabled, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `,
      [randomUUID(), name, String(inputType), roomName, ingress.streamKey, ingress.url],
    );

    return NextResponse.json(
      {
        ingress_id: ingress.ingressId,
        name: ingress.name,
        stream_key: ingress.streamKey,
        url: ingress.url,
        input_type: Number(ingress.inputType),
        ingress_type: ingressType.toLowerCase(),
        status: "endpoint_buffering",
        room_name: userRoomName,
        participant_identity: userIdentity,
        participant_name: participantName,
        reusable: ingress.reusable,
        state: null,
        project_id: projectId,
      },
      { status: 201 },
    );
  }

  if (slug.length === 2 && slug[0] === "ingress" && slug[1] === "url") {
    const projectId = await resolveScopedProject(claims, String(payload.project_id || ""));
    if (!projectId) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }
    const name = String(payload.name || "").trim();
    const url = String(payload.url || "").trim();
    const roomNameRaw = String(payload.room_name || "").trim();
    const participantIdentityRaw = String(payload.participant_identity || "").trim();
    const participantName = String(payload.participant_name || "").trim();
    if (!name || !url || !roomNameRaw || !participantIdentityRaw || !participantName) {
      return NextResponse.json(
        { error: "name, url, room_name, participant_identity and participant_name are required" },
        { status: 400 },
      );
    }

    const scopedRoomName = scopeName(roomNameRaw, projectId);
    const scopedIdentity = scopeName(participantIdentityRaw, projectId);
    const ingress = await livekit.ingress.createIngress(IngressInput.URL_INPUT, {
      name,
      url,
      roomName: scopedRoomName,
      participantIdentity: scopedIdentity,
      participantName,
    });

    await query(
      `
        INSERT INTO ingress (id, name, input_type, room_name, stream_key, url, is_enabled, created_at, updated_at)
        VALUES ($1, $2, 'url', $3, $4, $5, true, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `,
      [randomUUID(), name, scopedRoomName, ingress.streamKey, ingress.url],
    );

    return NextResponse.json(
      {
        ingress_id: ingress.ingressId,
        name: ingress.name,
        stream_key: ingress.streamKey,
        url: ingress.url,
        input_type: Number(ingress.inputType),
        ingress_type: "url",
        status: "endpoint_buffering",
        room_name: roomNameRaw,
        participant_identity: participantIdentityRaw,
        participant_name: participantName,
        reusable: ingress.reusable,
        state: null,
        project_id: projectId,
      },
      { status: 201 },
    );
  }

  if (slug.length === 2 && slug[0] === "egress") {
    const action = slug[1];
    const projectId = await resolveScopedProject(claims, String(payload.project_id || ""));
    if (!projectId) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }

    if (action === "room-composite") {
      const roomName = String(payload.room_name || "").trim();
      if (!roomName) return NextResponse.json({ error: "room_name is required" }, { status: 400 });
      const scopedRoom = scopeName(roomName, projectId);
      const output = createEncodedOutput(`${roomName}-${Date.now()}.mp4`);
      const egress = await livekit.egress.startRoomCompositeEgress(scopedRoom, output, {
        layout: payload.layout ? String(payload.layout) : undefined,
        audioOnly: payload.audio_only === true,
        videoOnly: payload.video_only === true,
      });
      return NextResponse.json(mapEgress(egress, projectId, roomName), { status: 201 });
    }

    if (action === "web") {
      const url = String(payload.url || "").trim();
      if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });
      const output = createEncodedOutput(`web-${Date.now()}.mp4`);
      const egress = await livekit.egress.startWebEgress(url, output, {
        audioOnly: payload.audio_only === true,
        videoOnly: payload.video_only === true,
        awaitStartSignal: payload.await_start_signal === true,
      });
      egressScopeState.byEgressId.set(egress.egressId, projectId);
      return NextResponse.json(mapEgress(egress, projectId), { status: 201 });
    }

    if (action === "participant") {
      const roomName = String(payload.room_name || "").trim();
      const identity = String(payload.identity || "").trim();
      if (!roomName || !identity) {
        return NextResponse.json({ error: "room_name and identity are required" }, { status: 400 });
      }
      const scopedRoom = scopeName(roomName, projectId);
      const output = createEncodedOutput(`${roomName}-${identity}-${Date.now()}.mp4`);
      const egress = await livekit.egress.startParticipantEgress(scopedRoom, identity, output, {
        screenShare: payload.screenshare === true,
      });
      return NextResponse.json(mapEgress(egress, projectId, roomName), { status: 201 });
    }

    if (action === "track") {
      const roomName = String(payload.room_name || "").trim();
      const trackSid = String(payload.track_sid || "").trim();
      if (!roomName || !trackSid) {
        return NextResponse.json({ error: "room_name and track_sid are required" }, { status: 400 });
      }
      const scopedRoom = scopeName(roomName, projectId);
      const filepath =
        String(payload.filepath || "").trim() || `${trackSid}-${Date.now()}.mp4`;
      const egress = await livekit.egress.startTrackEgress(scopedRoom, filepath, trackSid);
      return NextResponse.json(mapEgress(egress, projectId, roomName), { status: 201 });
    }

    if (action === "image") {
      const roomName = String(payload.room_name || "").trim();
      if (!roomName) return NextResponse.json({ error: "room_name is required" }, { status: 400 });
      const scopedRoom = scopeName(roomName, projectId);
      const egress = await livekit.egress.startTrackCompositeEgress(
        scopedRoom,
        {
          images: new ImageOutput({
            filenamePrefix:
              String(payload.filename_prefix || "").trim() || `${roomName}-snapshot`,
            captureInterval: Number(payload.capture_interval || 10),
          }),
        },
        {
          audioTrackId: payload.audio_track_id ? String(payload.audio_track_id) : undefined,
          videoTrackId: payload.video_track_id ? String(payload.video_track_id) : undefined,
        },
      );
      return NextResponse.json(mapEgress(egress, projectId, roomName), { status: 201 });
    }

    if (action === "stop") {
      const egressId = String(payload.egress_id || "").trim();
      if (!egressId) return NextResponse.json({ error: "egress_id is required" }, { status: 400 });
      const items = await livekit.egress.listEgress();
      const prefix = projectPrefix(projectId);
      const belongs = items.some(
        (item) =>
          item.egressId === egressId &&
          (item.roomName?.startsWith(prefix) ||
            egressScopeState.byEgressId.get(egressId) === projectId),
      );
      if (!belongs) return NextResponse.json({ error: "Not Found" }, { status: 404 });
      const stopped = await livekit.egress.stopEgress(egressId);
      return NextResponse.json(mapEgress(stopped, projectId));
    }
  }

  return NextResponse.json({ error: "Not Found" }, { status: 404 });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return POST(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const claims = await authForLivekit(request, true);
  if (claims instanceof NextResponse) return claims;
  const { slug } = await resolveParams(context.params);

  if (slug.length === 2 && slug[0] === "api-keys") {
    const keyId = slug[1];
    const projectScope = await resolveQueryProject(request, claims, false);
    if (projectScope instanceof NextResponse) return projectScope;

    const found = await query<{ id: string }>(
      `
        SELECT id
        FROM api_keys
        WHERE id = $1
          AND user_id = $2
          ${projectScope ? "AND project_id = $3" : ""}
        LIMIT 1
      `,
      projectScope ? [keyId, claims.sub, projectScope] : [keyId, claims.sub],
    );

    if (!found.rowCount) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    await query("UPDATE api_keys SET is_active = false, updated_at = NOW() WHERE id = $1", [
      keyId,
    ]);
    return new NextResponse(null, { status: 204 });
  }

  if (slug.length === 2 && slug[0] === "rooms") {
    const roomName = decodeURIComponent(slug[1]);
    await livekit.room.deleteRoom(roomName);
    return new NextResponse(null, { status: 204 });
  }

  if (slug.length === 4 && slug[0] === "rooms" && slug[2] === "participants") {
    const roomName = decodeURIComponent(slug[1]);
    const identity = decodeURIComponent(slug[3]);
    await livekit.room.removeParticipant(roomName, identity);
    return new NextResponse(null, { status: 204 });
  }

  if (slug.length === 2 && slug[0] === "ingress") {
    const ingressId = slug[1];
    const projectId = await resolveQueryProject(request, claims, true);
    if (projectId instanceof NextResponse) return projectId;
    if (!projectId) {
      return NextResponse.json(
        { error: "Bad Request", message: "project_id is required" },
        { status: 400 },
      );
    }

    const items = await livekit.ingress.listIngress({});
    const prefix = projectPrefix(projectId);
    const inScope = items.some(
      (item) =>
        item.ingressId === ingressId &&
        (item.roomName.startsWith(prefix) || item.participantIdentity.startsWith(prefix)),
    );
    if (!inScope) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    await livekit.ingress.deleteIngress(ingressId);
    return new NextResponse(null, { status: 200 });
  }

  return NextResponse.json({ error: "Not Found" }, { status: 404 });
}
