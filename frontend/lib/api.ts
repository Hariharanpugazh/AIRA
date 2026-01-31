/**
 * RELATIM API Client
 * Government-Grade LiveKit Platform for India
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Token management
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
    accessToken = token;
    if (token) {
        localStorage.setItem("token", token);
    } else {
        localStorage.removeItem("token");
    }
}

export function getAccessToken(): string | null {
    if (accessToken) return accessToken;
    if (typeof window !== "undefined") {
        accessToken = localStorage.getItem("token");
    }
    return accessToken;
}

export function clearAuth() {
    accessToken = null;
    if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
    }
}

// API fetch wrapper
async function apiFetch<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getAccessToken();

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        clearAuth();
        if (typeof window !== "undefined") {
            window.location.href = "/login";
        }
        throw new Error("Unauthorized");
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Request failed" }));
        throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
}

// =============================================================================
// AUTH API
// =============================================================================

export interface LoginResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

export interface User {
    id: string;
    email: string;
    name: string;
}

export async function login(email: string, password: string): Promise<User> {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Login failed" }));
        throw new Error(error.detail || "Invalid credentials");
    }

    const data: LoginResponse = await response.json();
    setAccessToken(data.access_token);

    // Get user info
    const user = await getMe();
    localStorage.setItem("user", JSON.stringify(user));
    return user;
}

export async function getMe(): Promise<User> {
    return apiFetch<User>("/api/auth/me");
}

export async function logout(): Promise<void> {
    try {
        await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
        clearAuth();
    }
}

// =============================================================================
// PROJECTS API
// =============================================================================

export interface Project {
    id: string;
    name: string;
    description: string | null;
    status: string;
    created_at: string;
    updated_at: string;
}

export async function getProjects(): Promise<Project[]> {
    return apiFetch<Project[]>("/api/projects");
}

export async function createProject(name: string, description?: string): Promise<Project> {
    return apiFetch<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name, description }),
    });
}

export async function getProject(id: string): Promise<Project> {
    return apiFetch<Project>(`/api/projects/${id}`);
}

export async function updateProject(id: string, data: Partial<Project>): Promise<Project> {
    return apiFetch<Project>(`/api/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
    });
}

export async function deleteProject(id: string): Promise<void> {
    await apiFetch(`/api/projects/${id}`, { method: "DELETE" });
}

// =============================================================================
// AI CONFIG API
// =============================================================================

export interface AIConfig {
    id: string;
    project_id: string;
    stt_mode: string;
    stt_provider: string;
    stt_model: string;
    tts_mode: string;
    tts_provider: string;
    tts_model: string;
    tts_voice: string;
    llm_mode: string;
    llm_provider: string;
    llm_model: string;
    api_keys: Record<string, string>;
}

export async function getAIConfig(projectId: string): Promise<AIConfig> {
    return apiFetch<AIConfig>(`/api/projects/${projectId}/ai-config`);
}

export async function updateAIConfig(projectId: string, config: Partial<AIConfig>): Promise<AIConfig> {
    return apiFetch<AIConfig>(`/api/projects/${projectId}/ai-config`, {
        method: "PUT",
        body: JSON.stringify(config),
    });
}

// =============================================================================
// AGENTS API
// =============================================================================

export interface Agent {
    id: string;
    project_id: string;
    name: string;
    description: string | null;
    instructions: string | null;
    voice: string;
    model: string;
    language: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export async function getAgents(projectId: string): Promise<Agent[]> {
    return apiFetch<Agent[]>(`/api/projects/${projectId}/agents`);
}

export async function createAgent(projectId: string, agent: Partial<Agent>): Promise<Agent> {
    return apiFetch<Agent>(`/api/projects/${projectId}/agents`, {
        method: "POST",
        body: JSON.stringify(agent),
    });
}

export async function getAgent(projectId: string, agentId: string): Promise<Agent> {
    return apiFetch<Agent>(`/api/projects/${projectId}/agents/${agentId}`);
}

export async function updateAgent(projectId: string, agentId: string, data: Partial<Agent>): Promise<Agent> {
    return apiFetch<Agent>(`/api/projects/${projectId}/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
    });
}

export async function deleteAgent(projectId: string, agentId: string): Promise<void> {
    await apiFetch(`/api/projects/${projectId}/agents/${agentId}`, { method: "DELETE" });
}

// =============================================================================
// TELEPHONY API
// =============================================================================

export interface SipTrunk {
    id: string;
    project_id: string;
    name: string;
    trunk_type: string;
    sip_server?: string;
    username?: string;
    password?: string;
    numbers: string[];
    created_at: string;
}

export interface DispatchRule {
    id: string;
    project_id: string;
    name: string;
    rule_type: string;
    trunk_id?: string;
    agent_id?: string;
    trunk_name?: string;
    agent_name?: string;
    created_at: string;
}

export async function getSipTrunks(): Promise<SipTrunk[]> {
    return apiFetch<SipTrunk[]>("/api/telephony/trunks");
}

export async function createSipTrunk(data: Partial<SipTrunk>): Promise<SipTrunk> {
    return apiFetch<SipTrunk>("/api/telephony/trunks", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function deleteSipTrunk(id: string): Promise<void> {
    await apiFetch(`/api/telephony/trunks/${id}`, { method: "DELETE" });
}

export async function getDispatchRules(): Promise<DispatchRule[]> {
    return apiFetch<DispatchRule[]>("/api/telephony/rules");
}

export async function createDispatchRule(data: Partial<DispatchRule>): Promise<DispatchRule> {
    return apiFetch<DispatchRule>("/api/telephony/rules", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function deleteDispatchRule(id: string): Promise<void> {
    await apiFetch(`/api/telephony/rules/${id}`, { method: "DELETE" });
}

// =============================================================================
// LIVEKIT API
// =============================================================================

export interface LiveKitStats {
    active_rooms: number;
    total_participants: number;
    status: string;
}

export async function getLiveKitStats(): Promise<LiveKitStats> {
    return apiFetch<LiveKitStats>("/api/livekit/stats");
}

export interface Room {
    sid: string;
    name: string;
    num_participants: number;
}

export async function getRooms(): Promise<Room[]> {
    const data = await apiFetch<{ rooms: Room[] }>("/api/livekit/rooms");
    return data.rooms;
}

export interface Egress {
    egress_id: string;
    status: string;
    room_name: string;
    file_url?: string;
    started_at: string;
}

export async function getEgresses(): Promise<Egress[]> {
    const data = await apiFetch<{ egresses: Egress[] }>("/api/livekit/egresses");
    return data.egresses;
}

export async function startRoomEgress(roomName: string): Promise<Egress> {
    return apiFetch<Egress>("/api/livekit/egress/room-composite", {
        method: "POST",
        body: JSON.stringify({ room_name: roomName }),
    });
}

export async function stopEgress(egressId: string): Promise<void> {
    await apiFetch("/api/livekit/egress/stop", {
        method: "POST",
        body: JSON.stringify({ egress_id: egressId }),
    });
}

export interface Ingress {
    ingress_id: string;
    name: string;
    stream_key: string;
    url: string;
    ingress_type: string;
    status: string;
}

export async function getIngresses(): Promise<Ingress[]> {
    const data = await apiFetch<{ ingresses: Ingress[] }>("/api/livekit/ingresses");
    return data.ingresses;
}

export async function createIngress(name: string, type: "rtmp" | "whip"): Promise<Ingress> {
    return apiFetch<Ingress>("/api/livekit/ingress", {
        method: "POST",
        body: JSON.stringify({ name, ingress_type: type }),
    });
}

export async function deleteIngress(id: string): Promise<void> {
    await apiFetch(`/api/livekit/ingress/${id}`, { method: "DELETE" });
}

// =============================================================================
// SETTINGS API
// =============================================================================

export interface ApiKey {
    id: string;
    name: string;
    key_prefix: string;
    created_at: string;
    secret_key?: string; // Only on create
}

export interface Webhook {
    id: string;
    url: string;
    events: string[];
    secret: string;
    created_at: string;
}

export interface TeamMember {
    id: string;
    email: string;
    name: string;
    role: string;
}

export async function getApiKeys(): Promise<ApiKey[]> {
    return apiFetch<ApiKey[]>("/api/settings/keys");
}

export async function createApiKey(name: string): Promise<ApiKey> {
    return apiFetch<ApiKey>("/api/settings/keys", {
        method: "POST",
        body: JSON.stringify({ name }),
    });
}

export async function deleteApiKey(id: string): Promise<void> {
    await apiFetch(`/api/settings/keys/${id}`, { method: "DELETE" });
}

export async function getWebhooks(): Promise<Webhook[]> {
    return apiFetch<Webhook[]>("/api/settings/webhooks");
}

export async function createWebhook(url: string, events: string[]): Promise<Webhook> {
    return apiFetch<Webhook>("/api/settings/webhooks", {
        method: "POST",
        body: JSON.stringify({ url, events }),
    });
}

export async function deleteWebhook(id: string): Promise<void> {
    await apiFetch(`/api/settings/webhooks/${id}`, { method: "DELETE" });
}

export async function getTeamMembers(): Promise<TeamMember[]> {
    return apiFetch<TeamMember[]>("/api/settings/members");
}

export async function inviteMember(email: string, role: string): Promise<void> {
    await apiFetch("/api/settings/members/invite", {
        method: "POST",
        body: JSON.stringify({ email, role }),
    });
}
