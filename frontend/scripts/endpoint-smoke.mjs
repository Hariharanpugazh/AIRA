const BASE_URL = (process.env.TEST_BASE_URL || "http://localhost:3400").replace(/\/+$/, "");

const failures = [];
let accessToken = null;
let refreshToken = null;

function toText(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function request(
  name,
  {
    method = "GET",
    path,
    body,
    token = true,
    expected = [200],
  },
) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";

  if (token === true && accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  } else if (typeof token === "string") {
    headers.authorization = `Bearer ${token}`;
  }

  let response;
  let text = "";
  let data = null;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    text = await response.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
  } catch (error) {
    failures.push({
      name,
      method,
      path,
      expected,
      status: "NETWORK_ERROR",
      body: error instanceof Error ? error.message : String(error),
    });
    console.log(`FAIL ${method} ${path} -> NETWORK_ERROR`);
    return { ok: false, status: 0, data: null, text: "" };
  }

  const ok = expected.includes(response.status);
  console.log(`${ok ? "PASS" : "FAIL"} ${method} ${path} -> ${response.status}`);
  if (!ok) {
    failures.push({
      name,
      method,
      path,
      expected,
      status: response.status,
      body: text.slice(0, 1200),
    });
  }

  return {
    ok,
    status: response.status,
    data,
    text,
  };
}

function requireValue(name, value) {
  if (!value) {
    failures.push({
      name,
      status: "MISSING_VALUE",
      body: `Missing required value: ${name}`,
    });
    return false;
  }
  return true;
}

async function main() {
  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const email = `audit-${tag}@example.com`;
  const password = "Aa!1234567890";

  let projectId = null;
  let projectShortId = null;
  let agentId = null;
  let apiKeyId = null;
  let ingressId = null;
  let urlIngressId = null;
  let trunkId = null;
  let dispatchRuleId = null;
  let roleId = null;
  let storageId = null;
  let memberId = null;
  let webhookId = null;
  let autoRecordingRuleId = null;
  let instanceId = null;
  let roomName = null;

  await request("auth.register", {
    method: "POST",
    path: "/api/auth/register",
    token: false,
    expected: [200],
    body: {
      email,
      password,
      name: "Audit Admin",
      phone: "+15550001111",
    },
  });

  const loginRes = await request("auth.login", {
    method: "POST",
    path: "/api/auth/login",
    token: false,
    expected: [200],
    body: { email, password },
  });
  accessToken = loginRes.data?.access_token || null;
  refreshToken = loginRes.data?.refresh_token || null;
  requireValue("access_token", accessToken);
  requireValue("refresh_token", refreshToken);

  await request("auth.me", {
    path: "/api/auth/me",
    expected: [200],
  });

  await request("auth.refresh", {
    method: "POST",
    path: "/api/auth/refresh",
    token: false,
    expected: [200],
    body: { refresh_token: refreshToken },
  });

  await request("health.route", {
    path: "/health",
    token: false,
    expected: [200],
  });

  await request("metrics.route", {
    path: "/metrics",
    token: false,
    expected: [200],
  });

  await request("webhook.route.unauthorized", {
    method: "POST",
    path: "/webhook",
    token: false,
    expected: [401],
    body: { event: "test_event" },
  });

  const projectRes = await request("projects.create", {
    method: "POST",
    path: "/api/projects",
    expected: [201],
    body: {
      name: `Audit Project ${tag}`,
      description: "Endpoint audit project",
    },
  });
  projectId = projectRes.data?.id || null;
  projectShortId = projectRes.data?.short_id || null;
  requireValue("project_id", projectId);
  requireValue("project_short_id", projectShortId);

  await request("projects.list", {
    path: "/api/projects",
    expected: [200],
  });

  if (projectId) {
    await request("projects.get.by-id", {
      path: `/api/projects/${encodeURIComponent(projectId)}`,
      expected: [200],
    });

    if (projectShortId) {
      await request("projects.get.by-short-id", {
        path: `/api/projects/${encodeURIComponent(projectShortId)}`,
        expected: [200],
      });
    }

    await request("projects.update", {
      method: "PUT",
      path: `/api/projects/${encodeURIComponent(projectId)}`,
      expected: [200],
      body: {
        name: `Audit Project Updated ${tag}`,
        description: "Updated by endpoint smoke test",
        status: "active",
      },
    });

    await request("projects.ai-config.get", {
      path: `/api/projects/${encodeURIComponent(projectId)}/ai-config`,
      expected: [200],
    });

    await request("projects.ai-config.put", {
      method: "PUT",
      path: `/api/projects/${encodeURIComponent(projectId)}/ai-config`,
      expected: [200],
      body: {
        stt_mode: "cloud",
        stt_provider: "google",
        llm_provider: "openai",
        llm_model: "gpt-4o-mini",
      },
    });

    // Agents: invalid image should be rejected on deploy (server-side validation)
    const createAgentRes = await request("agents.create.invalid_image", {
      method: "POST",
      path: `/api/projects/${encodeURIComponent(projectId)}/agents`,
      expected: [201],
      body: { display_name: `audit-agent-${tag}`, image: "nonexistent-command-xyz" },
    });
    agentId = createAgentRes.data?.agent_id || null;
    if (agentId) {
      await request("agents.deploy.invalid_image", {
        method: "POST",
        path: `/api/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}/deploy`,
        expected: [400],
        body: { deployment_type: "process" },
      });
    }

    await request("sessions.list.global", {
      path: `/api/sessions/list?page=1&limit=20&project_id=${encodeURIComponent(projectId)}`,
      expected: [200],
    });

    await request("sessions.stats.global", {
      path: `/api/sessions/stats?range=24h&project_id=${encodeURIComponent(projectId)}`,
      expected: [200],
    });

    await request("sessions.list.project", {
      path: `/api/projects/${encodeURIComponent(projectId)}/sessions?page=1&limit=20`,
      expected: [200],
    });

    await request("sessions.stats.project", {
      path: `/api/projects/${encodeURIComponent(projectId)}/sessions/stats?range=24h`,
      expected: [200],
    });

    await request("analytics.summary", {
      path: `/api/analytics/summary?project_id=${encodeURIComponent(projectId)}`,
      expected: [200],
    });

    await request("analytics.dashboard", {
      path: `/api/analytics/dashboard?range=24h&project_id=${encodeURIComponent(projectId)}`,
      expected: [200],
    });

    await request("analytics.timeseries", {
      path: `/api/analytics/timeseries?range=24h&project_id=${encodeURIComponent(projectId)}`,
      expected: [200],
    });

    await request("livekit.root", {
      path: "/api/livekit",
      expected: [200],
    });

    await request("livekit.health", {
      path: "/api/livekit/health",
      expected: [200],
    });

    await request("livekit.stats", {
      path: "/api/livekit/stats",
      expected: [200],
    });

    await request("livekit.token.get", {
      path: `/api/livekit/token?room=${encodeURIComponent(`audit-room-${tag}`)}&identity=${encodeURIComponent(`auditor-${tag}`)}`,
      expected: [200],
    });

    await request("livekit.token.post", {
      method: "POST",
      path: "/api/livekit/token",
      expected: [200],
      body: {
        room_name: `audit-room-${tag}`,
        identity: `auditor-${tag}`,
        can_publish: true,
        can_subscribe: true,
      },
    });

    roomName = `audit-room-${tag}`;
    await request("livekit.rooms.create", {
      method: "POST",
      path: "/api/livekit/rooms",
      expected: [201],
      body: {
        name: roomName,
        empty_timeout: 60,
        max_participants: 10,
      },
    });

    await request("livekit.rooms.put-alias", {
      method: "PUT",
      path: "/api/livekit/rooms",
      expected: [201],
      body: {
        name: `${roomName}-put`,
      },
    });

    await request("livekit.rooms.list", {
      path: "/api/livekit/rooms",
      expected: [200],
    });

    await request("livekit.rooms.detail", {
      path: `/api/livekit/rooms/${encodeURIComponent(roomName)}`,
      expected: [200],
    });

    await request("livekit.rooms.participants", {
      path: `/api/livekit/rooms/${encodeURIComponent(roomName)}/participants`,
      expected: [200],
    });

    await request("livekit.rooms.rtc-stats", {
      path: `/api/livekit/rooms/${encodeURIComponent(roomName)}/rtc-stats`,
      expected: [200],
    });

    await request("livekit.room.delete.put-room", {
      method: "DELETE",
      path: `/api/livekit/rooms/${encodeURIComponent(`${roomName}-put`)}`,
      expected: [204],
    });

    const apiKeyRes = await request("livekit.api-keys.create", {
      method: "POST",
      path: "/api/livekit/api-keys",
      expected: [201],
      body: {
        name: `audit-key-${tag}`,
        project_id: projectId,
      },
    });
    apiKeyId = apiKeyRes.data?.id || null;

    await request("livekit.api-keys.list", {
      path: `/api/livekit/api-keys?project_id=${encodeURIComponent(projectId)}`,
      expected: [200],
    });

    const ingressRes = await request("livekit.ingress.create.rtmp", {
      method: "POST",
      path: "/api/livekit/ingress",
      expected: [201],
      body: {
        project_id: projectId,
        name: `audit-ingress-${tag}`,
        ingress_type: "rtmp",
        room_name: `ingress-room-${tag}`,
        participant_identity: `ingress-${tag}`,
      },
    });
    ingressId = ingressRes.data?.ingress_id || null;

    const urlIngressRes = await request("livekit.ingress.create.url", {
      method: "POST",
      path: "/api/livekit/ingress/url",
      expected: [201],
      body: {
        project_id: projectId,
        name: `audit-url-ingress-${tag}`,
        url: "https://example.com/stream",
        room_name: `url-room-${tag}`,
        participant_identity: `url-participant-${tag}`,
        participant_name: `URL Participant ${tag}`,
      },
    });
    urlIngressId = urlIngressRes.data?.ingress_id || null;

    await request("livekit.ingress.list", {
      path: `/api/livekit/ingresses?project_id=${encodeURIComponent(projectId)}`,
      expected: [200],
    });

    await request("livekit.egresses.list", {
      path: `/api/livekit/egresses?project_id=${encodeURIComponent(projectId)}`,
      expected: [200],
    });

    await request("livekit.egress.room-composite.validation", {
      method: "POST",
      path: "/api/livekit/egress/room-composite",
      expected: [400],
      body: { project_id: projectId },
    });

    await request("livekit.egress.web.validation", {
      method: "POST",
      path: "/api/livekit/egress/web",
      expected: [400],
      body: { project_id: projectId },
    });

    await request("livekit.egress.participant.validation", {
      method: "POST",
      path: "/api/livekit/egress/participant",
      expected: [400],
      body: { project_id: projectId },
    });

    await request("livekit.egress.track.validation", {
      method: "POST",
      path: "/api/livekit/egress/track",
      expected: [400],
      body: { project_id: projectId },
    });

    await request("livekit.egress.image.validation", {
      method: "POST",
      path: "/api/livekit/egress/image",
      expected: [400],
      body: { project_id: projectId },
    });

    await request("livekit.egress.stop.validation", {
      method: "POST",
      path: "/api/livekit/egress/stop",
      expected: [400],
      body: { project_id: projectId },
    });

    await request("telephony.sip-trunks.list.initial", {
      path: `/api/telephony/sip-trunks?project_id=${encodeURIComponent(projectId)}`,
      expected: [200],
    });

    const trunkRes = await request("telephony.sip-trunks.create", {
      method: "POST",
      path: "/api/telephony/sip-trunks",
      expected: [201],
      body: {
        project_id: projectId,
        name: `audit-trunk-${tag}`,
        inbound_numbers_regex: ["+1555000"],
      },
    });
    trunkId = trunkRes.data?.sip_trunk_id || null;

    if (trunkId) {
      await request("telephony.sip-trunks.update", {
        method: "PUT",
        path: `/api/telephony/sip-trunks/${encodeURIComponent(trunkId)}`,
        expected: [200],
        body: {
          project_id: projectId,
          name: `audit-trunk-updated-${tag}`,
          inbound_numbers_regex: ["+15550001234"],
        },
      });
    }

    await request("telephony.sip-trunks.list", {
      path: `/api/telephony/sip-trunks?project_id=${encodeURIComponent(projectId)}`,
      expected: [200],
    });

    await request("telephony.dispatch-rules.list.initial", {
      path: `/api/telephony/dispatch-rules?project_id=${encodeURIComponent(projectId)}`,
      expected: [200],
    });

    const dispatchRes = await request("telephony.dispatch-rules.create", {
      method: "POST",
      path: "/api/telephony/dispatch-rules",
      expected: [201],
      body: {
        project_id: projectId,
        name: `audit-dispatch-${tag}`,
        rule_type: "direct",
        room_name: `dispatch-room-${tag}`,
        trunk_ids: trunkId ? [trunkId] : [],
      },
    });
    dispatchRuleId = dispatchRes.data?.sip_dispatch_rule_id || null;

    if (dispatchRuleId) {
      await request("telephony.dispatch-rules.update", {
        method: "PUT",
        path: `/api/telephony/dispatch-rules/${encodeURIComponent(dispatchRuleId)}`,
        expected: [200],
        body: {
          project_id: projectId,
          name: `audit-dispatch-updated-${tag}`,
          room_prefix: `dispatch-updated-${tag}-`,
          rule_type: "individual",
          trunk_ids: trunkId ? [trunkId] : [],
        },
      });
    }

    await request("telephony.dispatch-rules.list", {
      path: `/api/telephony/dispatch-rules?project_id=${encodeURIComponent(projectId)}`,
      expected: [200],
    });

    await request("telephony.call-logs.list", {
      path: `/api/telephony/call-logs?project_id=${encodeURIComponent(projectId)}&limit=20`,
      expected: [200],
    });

    await request("telephony.outbound-call.validation", {
      method: "POST",
      path: "/api/telephony/outbound-call",
      expected: [404],
      body: {
        project_id: projectId,
        trunk_id: "does-not-exist",
        to_number: "+15550001111",
      },
    });

    await request("telephony.calls.end.not-found", {
      method: "POST",
      path: `/api/telephony/calls/${encodeURIComponent(`unknown-${tag}`)}/end?project_id=${encodeURIComponent(projectId)}`,
      expected: [404],
    });

    await request("settings.roles.list", {
      path: "/api/settings/roles",
      expected: [200],
    });

    const roleRes = await request("settings.roles.create", {
      method: "POST",
      path: "/api/settings/roles",
      expected: [201],
      body: {
        name: `QA Role ${tag}`,
        description: "Created by endpoint smoke test",
        permissions: ["project.read", "agent.read"],
      },
    });
    roleId = roleRes.data?.id || null;

    if (roleId) {
      await request("settings.roles.permissions", {
        path: `/api/settings/roles/${encodeURIComponent(roleId)}/permissions`,
        expected: [200],
      });

      await request("settings.roles.update", {
        method: "PUT",
        path: `/api/settings/roles/${encodeURIComponent(roleId)}`,
        expected: [200],
        body: {
          description: "Updated by endpoint smoke test",
          permissions: ["project.read"],
        },
      });
    }

    await request("settings.service-accounts.list", {
      path: "/api/settings/service-accounts",
      expected: [200],
    });

    await request("settings.service-accounts.create", {
      method: "POST",
      path: "/api/settings/service-accounts",
      expected: [201],
      body: {
        name: `svc-${tag}`,
        permissions: ["project.read"],
      },
    });

    await request("settings.storage.list", {
      path: "/api/settings/storage",
      expected: [200],
    });

    const storageRes = await request("settings.storage.create", {
      method: "POST",
      path: "/api/settings/storage",
      expected: [201],
      body: {
        name: `storage-${tag}`,
        storage_type: "s3",
        bucket: `bucket-${tag}`,
        region: "us-east-1",
        endpoint: "https://s3.amazonaws.com",
        access_key: "test-access",
        secret_key: "test-secret",
        is_default: false,
      },
    });
    storageId = storageRes.data?.id || null;

    await request("settings.members.list", {
      path: "/api/settings/members",
      expected: [200],
    });

    const memberRes = await request("settings.members.create", {
      method: "POST",
      path: "/api/settings/members",
      expected: [201],
      body: {
        email: `member-${tag}@example.com`,
        name: `Member ${tag}`,
        password: "Bb!1234567890",
        role: "Developer",
      },
    });
    memberId = memberRes.data?.id || null;

    await request("settings.webhooks.list.initial", {
      path: `/api/settings/webhooks?project_id=${encodeURIComponent(projectId)}`,
      expected: [200],
    });

    const webhookRes = await request("settings.webhooks.create", {
      method: "POST",
      path: "/api/settings/webhooks",
      expected: [201],
      body: {
        name: `Webhook ${tag}`,
        url: "https://example.com/webhook",
        events: ["room.started", "room.ended"],
        project_id: projectId,
      },
    });
    webhookId = webhookRes.data?.id || null;

    await request("settings.webhooks.list", {
      path: `/api/settings/webhooks?project_id=${encodeURIComponent(projectId)}`,
      expected: [200],
    });

    await request("room-templates.list", {
      path: "/api/room-templates",
      expected: [200],
    });

    await request("room-templates.create", {
      method: "POST",
      path: "/api/room-templates",
      expected: [201],
      body: {
        name: `Room Template ${tag}`,
        description: "Smoke test template",
        config: { max_participants: 10 },
      },
    });

    await request("layout-templates.list", {
      path: "/api/layout-templates",
      expected: [200],
    });

    await request("layout-templates.create", {
      method: "POST",
      path: "/api/layout-templates",
      expected: [201],
      body: {
        name: `Layout ${tag}`,
        layout_type: "grid",
        config: { grid: "2x2" },
      },
    });

    await request("auto-recording-rules.list.initial", {
      path: "/api/auto-recording-rules",
      expected: [200],
    });

    const autoRuleRes = await request("auto-recording-rules.create", {
      method: "POST",
      path: "/api/auto-recording-rules",
      expected: [201],
      body: {
        name: `Auto Rule ${tag}`,
        room_pattern: `audit-${tag}`,
        egress_type: "room_composite",
        is_active: true,
      },
    });
    autoRecordingRuleId = autoRuleRes.data?.id || null;

    await request("regions.list", {
      path: "/api/regions",
      expected: [200],
    });

    await request("regions.create", {
      method: "POST",
      path: "/api/regions",
      expected: [201],
      body: {
        region_name: `Audit Region ${tag}`,
        region_code: `RG${tag.slice(-4).toUpperCase()}`,
        livekit_url: "https://livekit.divithselvam.in",
        is_default: false,
      },
    });

    await request("metrics.system", {
      path: "/api/metrics/system",
      expected: [200],
    });

    await request("monitoring.metrics", {
      path: "/api/monitoring/metrics?hours=24",
      expected: [200],
    });

    await request("monitoring.errors.list", {
      path: "/api/monitoring/errors?unresolved_only=false",
      expected: [200],
    });

    await request("monitoring.errors.resolve", {
      method: "POST",
      path: `/api/monitoring/errors/${encodeURIComponent(`missing-${tag}`)}/resolve`,
      expected: [204],
    });

    await request("monitoring.prometheus", {
      path: "/api/monitoring/prometheus",
      expected: [200],
    });

    await request("status", {
      path: "/api/status",
      expected: [200],
    });

    await request("audit-logs", {
      path: "/api/audit-logs?page=1&limit=20",
      expected: [200],
    });

    await request("webhook-events.list", {
      path: "/api/webhooks/events?limit=20",
      expected: [200],
    });

    await request("webhook-events.deliveries.not-found", {
      path: `/api/webhooks/events/${encodeURIComponent(`missing-${tag}`)}/deliveries`,
      expected: [404],
    });

    await request("webhook-events.retry.not-found", {
      method: "POST",
      path: `/api/webhooks/events/${encodeURIComponent(`missing-${tag}`)}/retry`,
      expected: [404],
    });

    const transcriptSessionId = `sess-${tag}`;
    await request("transcripts.create", {
      method: "POST",
      path: "/api/transcripts",
      expected: [201],
      body: {
        session_id: transcriptSessionId,
        room_name: `room-${tag}`,
        participant_identity: `speaker-${tag}`,
        text: "Smoke transcript entry",
        language: "en",
        is_final: true,
        project_id: projectId,
      },
    });

    await request("transcripts.list", {
      path: `/api/transcripts?session_id=${encodeURIComponent(transcriptSessionId)}&limit=20`,
      expected: [200],
    });

    await request("transcripts.search", {
      path: `/api/transcripts/search?q=${encodeURIComponent("Smoke transcript")}&room_sid=${encodeURIComponent(transcriptSessionId)}`,
      expected: [200],
    });

    await request("transcripts.by-room-sid", {
      path: `/api/transcripts/${encodeURIComponent(transcriptSessionId)}?limit=20&offset=0`,
      expected: [200],
    });

    await request("agents.project.list.initial", {
      path: `/api/projects/${encodeURIComponent(projectId)}/agents`,
      expected: [200],
    });

    const agentRes = await request("agents.project.create", {
      method: "POST",
      path: `/api/projects/${encodeURIComponent(projectId)}/agents`,
      expected: [201],
      body: {
        name: `Agent ${tag}`,
        image: "ping",
        entrypoint: "127.0.0.1",
        is_enabled: true,
      },
    });
    agentId = agentRes.data?.agent_id || agentRes.data?.id || null;
    requireValue("agent_id", agentId);

    if (agentId) {
      await request("agents.project.get", {
        path: `/api/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}`,
        expected: [200],
      });

      await request("agents.project.update", {
        method: "PUT",
        path: `/api/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}`,
        expected: [200],
        body: {
          status: "active",
          auto_restart_policy: "always",
        },
      });

      await request("agents.project.logs", {
        path: `/api/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}/logs?limit=20`,
        expected: [200],
      });

      await request("agents.project.stats", {
        path: `/api/projects/${encodeURIComponent(projectId)}/agents/stats`,
        expected: [200],
      });

      await request("agents.global.get", {
        path: `/api/agents/${encodeURIComponent(agentId)}`,
        expected: [200],
      });

      await request("agents.global.metrics", {
        path: `/api/agents/${encodeURIComponent(agentId)}/metrics`,
        expected: [200],
      });

      const deployRes = await request("agents.deploy", {
        method: "POST",
        path: `/api/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}/deploy`,
        expected: [201],
        body: {
          deployment_type: "process",
          room_name: `agent-room-${tag}`,
        },
      });
      instanceId = deployRes.data?.instance_id || null;
    }

    await request("agent-instances.list", {
      path: `/api/agent-instances?project_id=${encodeURIComponent(projectId)}`,
      expected: [200],
    });

    if (instanceId) {
      await request("agent-instances.logs", {
        path: `/api/agent-instances/${encodeURIComponent(instanceId)}/logs?limit=20`,
        expected: [200],
      });
    }

    if (dispatchRuleId) {
      await request("telephony.dispatch-rules.delete", {
        method: "DELETE",
        path: `/api/telephony/dispatch-rules/${encodeURIComponent(dispatchRuleId)}?project_id=${encodeURIComponent(projectId)}`,
        expected: [200],
      });
    }

    if (trunkId) {
      await request("telephony.sip-trunks.delete", {
        method: "DELETE",
        path: `/api/telephony/sip-trunks/${encodeURIComponent(trunkId)}?project_id=${encodeURIComponent(projectId)}`,
        expected: [200],
      });
    }

    if (apiKeyId) {
      await request("livekit.api-keys.delete", {
        method: "DELETE",
        path: `/api/livekit/api-keys/${encodeURIComponent(apiKeyId)}?project_id=${encodeURIComponent(projectId)}`,
        expected: [204],
      });
    }

    if (ingressId) {
      await request("livekit.ingress.delete.rtmp", {
        method: "DELETE",
        path: `/api/livekit/ingress/${encodeURIComponent(ingressId)}?project_id=${encodeURIComponent(projectId)}`,
        expected: [200],
      });
    }

    if (urlIngressId) {
      await request("livekit.ingress.delete.url", {
        method: "DELETE",
        path: `/api/livekit/ingress/${encodeURIComponent(urlIngressId)}?project_id=${encodeURIComponent(projectId)}`,
        expected: [200],
      });
    }

    if (roomName) {
      await request("livekit.rooms.delete", {
        method: "DELETE",
        path: `/api/livekit/rooms/${encodeURIComponent(roomName)}`,
        expected: [204],
      });
    }

    if (agentId) {
      await request("agents.project.delete", {
        method: "DELETE",
        path: `/api/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}`,
        expected: [204],
      });
    }

    if (autoRecordingRuleId) {
      await request("auto-recording-rules.delete", {
        method: "DELETE",
        path: `/api/auto-recording-rules/${encodeURIComponent(autoRecordingRuleId)}`,
        expected: [204],
      });
    }

    if (webhookId) {
      await request("settings.webhooks.delete", {
        method: "DELETE",
        path: `/api/settings/webhooks/${encodeURIComponent(webhookId)}?project_id=${encodeURIComponent(projectId)}`,
        expected: [204],
      });
    }

    if (memberId) {
      await request("settings.members.delete", {
        method: "DELETE",
        path: `/api/settings/members/${encodeURIComponent(memberId)}`,
        expected: [204],
      });
    }

    if (storageId) {
      await request("settings.storage.delete", {
        method: "DELETE",
        path: `/api/settings/storage/${encodeURIComponent(storageId)}`,
        expected: [204],
      });
    }

    if (roleId) {
      await request("settings.roles.delete", {
        method: "DELETE",
        path: `/api/settings/roles/${encodeURIComponent(roleId)}`,
        expected: [204],
      });
    }

    await request("projects.delete", {
      method: "DELETE",
      path: `/api/projects/${encodeURIComponent(projectId)}`,
      expected: [204],
    });
  }

  console.log("");
  console.log("=== Endpoint Smoke Result ===");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Failures: ${failures.length}`);

  if (failures.length) {
    for (const failure of failures) {
      console.log(
        [
          `- ${failure.name || "unknown"}`,
          `status=${failure.status}`,
          `expected=${toText(failure.expected)}`,
          failure.path ? `path=${failure.path}` : "",
          failure.body ? `body=${toText(failure.body)}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
      );
    }
    process.exit(1);
  }
}

await main();
