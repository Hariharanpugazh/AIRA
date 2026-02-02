// Use relative paths in production (nginx proxies /api to backend)
// In development, set NEXT_PUBLIC_API_URL=http://localhost:8000
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

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

const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getRetryDelay(attempt: number): number {
    const delay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 200;
    return Math.min(delay + jitter, RETRY_CONFIG.maxDelay);
}

export async function apiFetch<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOptions?: { maxRetries?: number; retryOn?: number[] }
): Promise<T> {
    const token = getAccessToken();
    const maxRetries = retryOptions?.maxRetries ?? RETRY_CONFIG.maxRetries;
    const retryableStatuses = retryOptions?.retryOn ?? RETRY_CONFIG.retryableStatuses;

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
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

            if (!response.ok && retryableStatuses.includes(response.status) && attempt < maxRetries) {
                const delay = getRetryDelay(attempt);
                await sleep(delay);
                continue;
            }

            if (!response.ok) {
                let errorMsg = `HTTP ${response.status}`;
                try {
                    const error = await response.json();
                    errorMsg = error.detail || error.message || errorMsg;
                } catch {
                    try {
                        const text = await response.text();
                        if (text && text.length < 200) errorMsg = text;
                    } catch {}
                }
                
                // Don't throw a full error for 404 on the 'me' endpoint, 
                // handle it gracefully in the caller or return a clear error.
                const error = new Error(errorMsg);
                (error as any).status = response.status;
                throw error;
            }

            if (response.status === 204) {
                return {} as T;
            }

            const contentType = response.headers.get("Content-Type");
            if (!contentType || !contentType.includes("application/json")) {
                return {} as T;
            }

            return response.json();
        } catch (error) {
            lastError = error as Error;
            
            if (lastError.message === "Unauthorized") {
                throw lastError;
            }

            if (attempt < maxRetries && (error instanceof TypeError || (error as any).name === "TypeError")) {
                const delay = getRetryDelay(attempt);
                await sleep(delay);
                continue;
            }

            throw lastError;
        }
    }

    throw lastError || new Error("Request failed after retries");
}

export interface AnalyticsSummary {
    active_rooms: number;
    total_participants: number;
    status: string;
    last_updated: string;
}

export interface AnalyticsDataPoint {
    timestamp: string;
    active_rooms: number;
    total_participants: number;
}

export interface DashboardData {
    overview: {
        connection_success: number;
        connection_type: { udp: number; tcp: number };
        top_countries: { name: string; count: number }[];
    };
    platforms: Record<string, number>;
    participants: {
        webrtc_minutes: number;
        agent_minutes: number;
        sip_minutes: number;
        total_minutes: number;
    };
    agents: {
        session_minutes: number;
        concurrent: number;
    };
    telephony: {
        inbound: number;
        outbound: number;
    };
    rooms: {
        total_sessions: number;
        avg_size: number;
        avg_duration: number;
    };
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
    return apiFetch<AnalyticsSummary>("/api/analytics/summary");
}

export async function getAnalyticsDashboard(range: string = "24h"): Promise<DashboardData> {
    return apiFetch<DashboardData>(`/api/analytics/dashboard?range=${range}`);
}

export async function getAnalyticsTimeseries(range: string = "24h"): Promise<AnalyticsDataPoint[]> {
    return apiFetch<AnalyticsDataPoint[]>(`/api/analytics/timeseries?range=${range}`);
}


export interface Session {
    sid: string;
    room_name: string;
    status: string;
    start_time: string;
    end_time?: string;
    duration: number;
    total_participants: number;
    active_participants: number;
    features: string[];
    project_id?: string;
}

export interface SessionsListResponse {
    data: Session[];
    total: number;
    page: number;
    limit: number;
}

export interface SessionStats {
    unique_participants: number;
    total_rooms: number;
    timeseries: {
        timestamp: string;
        rooms: number;
        participants: number;
    }[];
}

export async function getSessions(page = 1, limit = 20, status?: string, search?: string): Promise<SessionsListResponse> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.append("status", status);
    if (search) params.append("search", search);
    return apiFetch<SessionsListResponse>(`/api/sessions/list?${params.toString()}`);
}

export async function getSessionStats(range = "24h"): Promise<SessionStats> {
    return apiFetch<SessionStats>(`/api/sessions/stats?range=${range}`);
}


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
    // Mock login for development
    if (email === "admin@admin.con" && password === "admin") {
        const mockToken = "mock_token_" + Date.now();
        setAccessToken(mockToken);
        const mockUser: User = {
            id: "mock-admin-001",
            email: "admin@admin.con",
            name: "Admin User",
        };
        if (typeof window !== "undefined") {
            localStorage.setItem("user", JSON.stringify(mockUser));
        }
        return mockUser;
    }

    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
    });

    if (!response.ok) {
        throw new Error("Invalid credentials");
    }

    const data: LoginResponse = await response.json();
    setAccessToken(data.access_token);

    // Get user info
    return getMe();
}

export async function logout(): Promise<void> {
    clearAuth();
}

export async function getMe(): Promise<User> {
    // Return cached mock user if using mock token
    const token = getAccessToken();
    if (token?.startsWith("mock_token_") && typeof window !== "undefined") {
        const cachedUser = localStorage.getItem("user");
        if (cachedUser) {
            return JSON.parse(cachedUser);
        }
    }
    
    try {
        return await apiFetch<User>("/api/auth/me");
    } catch (error: any) {
        // If the backend isn't ready or endpoint is missing, return a fallback in development
        if (error.status === 404 || error.message?.includes("404")) {
            console.warn("Auth endpoint /api/auth/me not found. Using fallback user.");
            return {
                id: "dev-user",
                email: "admin@relatim.io",
                name: "Developer Admin",
                avatar: ""
            };
        }
        throw error;
    }
}


export interface Project {
    id: string;
    name: string;
    description?: string;
    status: string;
    created_at: string;
}

export async function getProjects(): Promise<Project[]> {
    try {
        return await apiFetch<Project[]>("/api/projects");
    } catch (error: any) {
        if (error.status === 404 || error.message?.includes("404")) {
            console.warn("Projects endpoint not found, using mock projects");
            return [
                { id: "default", name: "Default Project", status: "active", created_at: new Date().toISOString() }
            ];
        }
        throw error;
    }
}

export async function getProject(id: string): Promise<Project> {
    return apiFetch<Project>(`/api/projects/${id}`);
}

export async function createProject(name: string, description?: string): Promise<Project> {
    return apiFetch<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name, description }),
    });
}

export async function updateProject(id: string, name: string, description?: string): Promise<Project> {
    return apiFetch<Project>(`/api/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name, description }),
    });
}

export async function deleteProject(id: string): Promise<void> {
    await apiFetch(`/api/projects/${id}`, { method: "DELETE" });
}


export interface AIConfig {
    stt_mode: string;
    stt_provider: string;
    stt_model?: string;
    tts_mode: string;
    tts_provider: string;
    tts_model?: string;
    tts_voice?: string;
    llm_mode: string;
    llm_provider: string;
    llm_model?: string;
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


export interface Agent {
    id: string;
    name: string;
    description?: string;
    instructions?: string;
    voice: string;
    model: string;
    status: string;
    created_at: string;
}

export async function getAgents(projectId: string): Promise<Agent[]> {
    try {
        return await apiFetch<Agent[]>(`/api/projects/${projectId}/agents`);
    } catch (error: any) {
        if (error.status === 404 || error.message?.includes("404")) {
            console.warn("Agents endpoint not found, returning empty list");
            return [];
        }
        throw error;
    }
}

export async function getAgent(projectId: string, agentId: string): Promise<Agent> {
    return apiFetch<Agent>(`/api/projects/${projectId}/agents/${agentId}`);
}

export async function createAgent(projectId: string, agent: Partial<Agent>): Promise<Agent> {
    try {
        return await apiFetch<Agent>(`/api/projects/${projectId}/agents`, {
            method: "POST",
            body: JSON.stringify(agent),
        });
    } catch (error: any) {
        // If the backend isn't ready or endpoint is missing, return a fallback in development
        if (error.status === 404 || error.message?.includes("404")) {
            const mockAgent: Agent = {
                id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                project_id: projectId,
                name: agent.name || "New Agent",
                description: agent.description || "",
                instructions: "",
                model: "openai/gpt-4",
                voice: "default",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: "active",
            };
            return mockAgent;
        }
        throw error;
    }
}

export async function updateAgent(projectId: string, agentId: string, agent: Partial<Agent>): Promise<Agent> {
    return apiFetch<Agent>(`/api/projects/${projectId}/agents/${agentId}`, {
        method: "PUT",
        body: JSON.stringify(agent),
    });
}

export async function deleteAgent(projectId: string, agentId: string): Promise<void> {
    await apiFetch(`/api/projects/${projectId}/agents/${agentId}`, { method: "DELETE" });
}


export interface SipTrunk {
    id: string;
    name: string;
    numbers: string[];
    sip_uri?: string;
    sip_server?: string;
    username?: string;
    password?: string;
    created_at: string;
}

export interface DispatchRule {
    id: string;
    name: string;
    rule_type: string;
    agent_id?: string;
    trunk_id?: string;
    agent_name?: string;
    trunk_name?: string;
    created_at: string;
}

export async function getSipTrunks(): Promise<SipTrunk[]> {
    return apiFetch<SipTrunk[]>("/api/telephony/sip-trunks");
}

export async function createSipTrunk(trunk: Partial<SipTrunk>): Promise<SipTrunk> {
    return apiFetch<SipTrunk>("/api/telephony/sip-trunks", {
        method: "POST",
        body: JSON.stringify(trunk),
    });
}

export async function deleteSipTrunk(id: string): Promise<void> {
    await apiFetch(`/api/telephony/sip-trunks/${id}`, { method: "DELETE" });
}

export async function getDispatchRules(): Promise<DispatchRule[]> {
    return apiFetch<DispatchRule[]>("/api/telephony/dispatch-rules");
}

export async function createDispatchRule(rule: Partial<DispatchRule>): Promise<DispatchRule> {
    return apiFetch<DispatchRule>("/api/telephony/dispatch-rules", {
        method: "POST",
        body: JSON.stringify(rule),
    });
}

export async function deleteDispatchRule(id: string): Promise<void> {
    await apiFetch(`/api/telephony/dispatch-rules/${id}`, { method: "DELETE" });
}


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

export interface RoomDetail {
    room: {
        sid: string;
        name: string;
        participants: number;
        active_recording: boolean;
        creation_time: number;
        enabled_codecs: string[];
    };
    participants: Participant[];
    participant_count: number;
}

export interface Participant {
    sid: string;
    identity: string;
    name: string;
    state: string;
    joined_at: number;
    is_publisher: boolean;
    tracks: Track[];
}

export interface Track {
    sid: string;
    source: string;
    mime_type: string;
    muted: boolean;
}

export interface TokenResponse {
    token: string;
    ws_url: string;
    room: string;
    identity: string;
}

export async function getRooms(): Promise<Room[]> {
    const data = await apiFetch<{ rooms: Room[] }>("/api/livekit/rooms");
    return data.rooms;
}

export async function getRoomDetail(roomName: string): Promise<RoomDetail> {
    return apiFetch<RoomDetail>(`/api/livekit/rooms/${encodeURIComponent(roomName)}`);
}

export async function createRoom(name: string, options?: { empty_timeout?: number; max_participants?: number }): Promise<Room> {
    return apiFetch<Room>("/api/livekit/rooms", {
        method: "POST",
        body: JSON.stringify({ name, ...options }),
    });
}

export async function deleteRoom(roomName: string): Promise<void> {
    await apiFetch(`/api/livekit/rooms/${encodeURIComponent(roomName)}`, { method: "DELETE" });
}

export async function muteParticipant(roomName: string, identity: string, muted: boolean = true, trackSid?: string): Promise<void> {
    await apiFetch(`/api/livekit/rooms/${encodeURIComponent(roomName)}/participants/${encodeURIComponent(identity)}/mute`, {
        method: "POST",
        body: JSON.stringify({ muted, track_sid: trackSid }),
    });
}

export async function removeParticipant(roomName: string, identity: string): Promise<void> {
    await apiFetch(`/api/livekit/rooms/${encodeURIComponent(roomName)}/participants/${encodeURIComponent(identity)}`, {
        method: "DELETE",
    });
}

export async function generateToken(roomName: string, identity?: string, options?: { can_publish?: boolean; can_subscribe?: boolean }): Promise<TokenResponse> {
    return apiFetch<TokenResponse>("/api/livekit/token", {
        method: "POST",
        body: JSON.stringify({ room_name: roomName, identity, ...options }),
    });
}

export interface Egress {
    egress_id: string;
    status: string;
    room_name: string;
    file_url?: string;
    started_at: string;
    type?: string;
    url?: string;
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

export async function startParticipantEgress(roomName: string, participantIdentity: string, outputType: string = "file"): Promise<{ ok: boolean; jobs: any[] }> {
    return apiFetch<{ ok: boolean; jobs: any[] }>("/api/livekit/egress/participant", {
        method: "POST",
        body: JSON.stringify({ room_name: roomName, participant_identity: participantIdentity, output_type: outputType }),
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
    is_active?: boolean;
    created_at?: string;
}

export interface Role {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    is_system: boolean;
}

export async function createTeamMember(email: string, name: string, password: string, role: string): Promise<TeamMember> {
    return apiFetch<TeamMember>("/api/settings/members", {
        method: "POST",
        body: JSON.stringify({ email, name, password, role }),
    });
}

export async function deleteTeamMember(userId: string): Promise<void> {
    await apiFetch(`/api/settings/members/${userId}`, { method: "DELETE" });
}

export async function getRoles(): Promise<Role[]> {
    return apiFetch<Role[]>("/api/settings/roles");
}

export async function createRole(name: string, description: string, permissions: string[]): Promise<Role> {
    return apiFetch<Role>("/api/settings/roles", {
        method: "POST",
        body: JSON.stringify({ name, description, permissions }),
    });
}

export async function updateRole(roleId: string, data: Partial<Role>): Promise<Role> {
    return apiFetch<Role>(`/api/settings/roles/${roleId}`, {
        method: "PUT",
        body: JSON.stringify(data),
    });
}

export async function deleteRole(roleId: string): Promise<void> {
    await apiFetch(`/api/settings/roles/${roleId}`, { method: "DELETE" });
}

export async function getRolePermissions(roleId: string): Promise<{ role: Role; assigned_permissions: string[]; available_permissions: any[] }> {
    return apiFetch(`/api/settings/roles/${roleId}/permissions`);
}


export interface StorageConfig {
    id: string;
    name: string;
    storage_type: string;
    bucket: string;
    region?: string;
    endpoint?: string;
    path_prefix?: string;
    is_default: boolean;
    created_at: string;
}

export async function getStorageConfigs(): Promise<StorageConfig[]> {
    return apiFetch<StorageConfig[]>("/api/settings/storage");
}

export async function createStorageConfig(config: Partial<StorageConfig>): Promise<StorageConfig> {
    return apiFetch<StorageConfig>("/api/settings/storage", {
        method: "POST",
        body: JSON.stringify(config),
    });
}

export async function deleteStorageConfig(id: string): Promise<void> {
    await apiFetch(`/api/settings/storage/${id}`, { method: "DELETE" });
}


export interface ServiceAccount {
    id: string;
    name: string;
    client_id: string;
    permissions: string[];
    is_active: boolean;
    created_at: string;
}

export async function getServiceAccounts(): Promise<ServiceAccount[]> {
    return apiFetch<ServiceAccount[]>("/api/settings/service-accounts");
}

export async function createServiceAccount(data: Partial<ServiceAccount>): Promise<ServiceAccount & { client_secret: string }> {
    return apiFetch<ServiceAccount & { client_secret: string }>("/api/settings/service-accounts", {
        method: "POST",
        body: JSON.stringify(data),
    });
}


export interface RoomTemplate {
    id: string;
    name: string;
    description?: string;
    config: any;
    is_default: boolean;
    created_at: string;
}

export async function getRoomTemplates(): Promise<RoomTemplate[]> {
    return apiFetch<RoomTemplate[]>("/api/room-templates");
}

export async function createRoomTemplate(data: Partial<RoomTemplate>): Promise<RoomTemplate> {
    return apiFetch<RoomTemplate>("/api/room-templates", {
        method: "POST",
        body: JSON.stringify(data),
    });
}


export interface LayoutTemplate {
    id: string;
    name: string;
    layout_type: string;
    is_default: boolean;
}

export async function getLayoutTemplates(): Promise<LayoutTemplate[]> {
    return apiFetch<LayoutTemplate[]>("/api/layout-templates");
}

export async function createLayoutTemplate(data: Partial<LayoutTemplate>): Promise<LayoutTemplate> {
    return apiFetch<LayoutTemplate>("/api/layout-templates", {
        method: "POST",
        body: JSON.stringify(data),
    });
}


export interface AutoRecordingRule {
    id: string;
    name: string;
    room_pattern?: string;
    egress_type: string;
    is_active: boolean;
}

export async function getAutoRecordingRules(): Promise<AutoRecordingRule[]> {
    return apiFetch<AutoRecordingRule[]>("/api/auto-recording-rules");
}

export async function createAutoRecordingRule(data: Partial<AutoRecordingRule>): Promise<AutoRecordingRule> {
    return apiFetch<AutoRecordingRule>("/api/auto-recording-rules", {
        method: "POST",
        body: JSON.stringify(data),
    });
}


export interface Region {
    id: string;
    region_name: string;
    region_code: string;
    livekit_url?: string;
    is_default: boolean;
}

export async function getRegions(): Promise<Region[]> {
    return apiFetch<Region[]>("/api/regions");
}

export async function createRegion(data: Partial<Region>): Promise<Region> {
    return apiFetch<Region>("/api/regions", {
        method: "POST",
        body: JSON.stringify(data),
    });
}


export interface SystemMetric {
    metric_name: string;
    metric_value: number;
    timestamp: string;
}

export interface ErrorLog {
    id: string;
    error_type: string;
    message: string;
    is_resolved: boolean;
    created_at: string;
}

export async function getSystemMetrics(hours: number = 24): Promise<SystemMetric[]> {
    return apiFetch<SystemMetric[]>(`/api/monitoring/metrics?hours=${hours}`);
}

export async function getErrorLogs(unresolvedOnly: boolean = false): Promise<ErrorLog[]> {
    return apiFetch<ErrorLog[]>(`/api/monitoring/errors?unresolved_only=${unresolvedOnly}`);
}

export async function resolveError(errorId: string): Promise<void> {
    await apiFetch(`/api/monitoring/errors/${errorId}/resolve`, { method: "POST" });
}

export async function getPrometheusMetrics(): Promise<string> {
    return apiFetch<string>("/api/monitoring/prometheus");
}


export interface ServiceStatusData {
    status: string;
    timestamp: string;
    services: {
        [key: string]: {
            status: string;
            latency_ms: number;
            details?: string;
            error?: string;
            rooms?: number;
        };
    };
    latency_ms: number;
}

export async function getServiceStatus(): Promise<ServiceStatusData> {
    return apiFetch<ServiceStatusData>("/api/status");
}


export interface WebhookEvent {
    id: string;
    event_type: string;
    payload: any;
    processed: boolean;
    created_at: string;
}

export async function getWebhookEvents(limit: number = 100): Promise<{ events: WebhookEvent[]; count: number }> {
    return apiFetch(`/api/webhooks/events?limit=${limit}`);
}

export async function retryWebhookEvent(eventId: string): Promise<{ ok: boolean; deliveries_queued: number }> {
    return apiFetch(`/api/webhooks/events/${eventId}/retry`, { method: "POST" });
}

export async function getEventDeliveries(eventId: string): Promise<{ event_id: string; deliveries: any[] }> {
    return apiFetch(`/api/webhooks/events/${eventId}/deliveries`);
}


export interface AuditLogEntry {
    id: string;
    user_id: string;
    action: string;
    resource: string;
    resource_id?: string;
    details?: any;
    ip_address?: string;
    created_at: string;
}

export async function getAuditLog(limit: number = 100, offset: number = 0): Promise<{ logs: AuditLogEntry[]; total: number }> {
    return apiFetch(`/api/audit-log?limit=${limit}&offset=${offset}`);
}

// API KEYS & WEBHOOKS

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


export interface Transcript {
    id: string;
    room_sid: string;
    room_name?: string;
    participant_identity?: string;
    speaker_type: 'user' | 'agent' | 'system';
    content: string;
    confidence?: number;
    language: string;
    start_time?: string;
    end_time?: string;
    duration_ms?: number;
    metadata?: Record<string, unknown>;
    created_at: string;
}

export interface TranscriptsResponse {
    transcripts: Transcript[];
    total: number;
    room_sid: string;
}

export interface TranscriptSearchResponse {
    results: Transcript[];
    query: string;
}

export async function getRoomTranscripts(
    roomSid: string, 
    limit: number = 100, 
    offset: number = 0
): Promise<TranscriptsResponse> {
    return apiFetch<TranscriptsResponse>(`/api/transcripts/${roomSid}?limit=${limit}&offset=${offset}`);
}

export async function searchTranscripts(
    query: string,
    options?: { roomSid?: string; speakerType?: string; limit?: number }
): Promise<TranscriptSearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (options?.roomSid) params.append('room_sid', options.roomSid);
    if (options?.speakerType) params.append('speaker_type', options.speakerType);
    if (options?.limit) params.append('limit', options.limit.toString());
    
    return apiFetch<TranscriptSearchResponse>(`/api/transcripts/search?${params.toString()}`);
}

export async function createTranscript(entry: Omit<Transcript, 'id' | 'created_at'>): Promise<{ id: string; created_at: string }> {
    return apiFetch<{ id: string; created_at: string }>("/api/transcripts", {
        method: "POST",
        body: JSON.stringify(entry),
    });
}
