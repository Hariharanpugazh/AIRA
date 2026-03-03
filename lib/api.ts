const CONFIGURED_API_BASE = (process.env.NEXT_PUBLIC_API_URL || "")
    .trim()
    .replace(/\/+$/, "");

function resolveApiBase(): string {
    // On the server we can only use configured env.
    if (typeof window === "undefined") {
        return CONFIGURED_API_BASE;
    }

    // When unset, browser should use same-origin by default.
    if (!CONFIGURED_API_BASE) {
        return "";
    }

    // In development, ignore stale cross-origin API base (common local port mismatch).
    if (process.env.NODE_ENV !== "production") {
        try {
            const configuredOrigin = new URL(CONFIGURED_API_BASE).origin;
            if (configuredOrigin !== window.location.origin) {
                return "";
            }
        } catch {
            return "";
        }
    }

    return CONFIGURED_API_BASE;
}

// Empty string means "same-origin" for fetch requests.
export const API_BASE = resolveApiBase();

export function getApiBaseUrl(): string {
    if (API_BASE) return API_BASE;
    if (typeof window !== "undefined") return window.location.origin;
    return "";
}

export function getApiWebSocketBaseUrl(): string {
    const normalized = getApiBaseUrl().replace(/\/+$/, "");
    if (!normalized) {
        if (typeof window !== "undefined") {
            return window.location.protocol === "https:"
                ? `wss://${window.location.host}`
                : `ws://${window.location.host}`;
        }
        return "";
    }
    if (normalized.startsWith("https://")) {
        return normalized.replace("https://", "wss://");
    }
    if (normalized.startsWith("http://")) {
        return normalized.replace("http://", "ws://");
    }
    return normalized;
}

export function getCurrentProjectId(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("projectId");
}

function resolveProjectId(projectId?: string): string | undefined {
    return projectId || getCurrentProjectId() || undefined;
}

function withProjectId(path: string, projectId?: string): string {
    const resolved = resolveProjectId(projectId);
    if (!resolved) return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}project_id=${encodeURIComponent(resolved)}`;
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let tokenExpiry: number | null = null;
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

export function setRefreshToken(token: string | null) {
    refreshToken = token;
    if (typeof window !== "undefined") {
        if (token) {
            localStorage.setItem("refreshToken", token);
        } else {
            localStorage.removeItem("refreshToken");
        }
    }
}

export function getRefreshToken(): string | null {
    if (refreshToken) return refreshToken;
    if (typeof window !== "undefined") {
        return localStorage.getItem("refreshToken");
    }
    return null;
}

export function setTokenExpiry(expiry: number | null) {
    tokenExpiry = expiry;
    if (typeof window !== "undefined") {
        if (expiry) {
            localStorage.setItem("tokenExpiry", String(expiry));
        } else {
            localStorage.removeItem("tokenExpiry");
        }
    }
}

export function getTokenExpiry(): number | null {
    if (tokenExpiry) return tokenExpiry;
    if (typeof window !== "undefined") {
        const stored = localStorage.getItem("tokenExpiry");
        return stored ? parseInt(stored, 10) : null;
    }
    return null;
}

export function isTokenExpired(): boolean {
    const expiry = getTokenExpiry();
    if (!expiry) return false;
    // Consider token expired 60 seconds before actual expiry
    return Date.now() >= (expiry - 60) * 1000;
}

async function refreshAccessToken(): Promise<string | null> {
    const rt = getRefreshToken();
    if (!rt) return null;

    try {
        const response = await fetch(`${API_BASE}/api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: rt }),
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        if (data.access_token) {
            setAccessToken(data.access_token);
            if (data.refresh_token) {
                setRefreshToken(data.refresh_token);
            }
            if (data.expires_in) {
                setTokenExpiry(Math.floor(Date.now() / 1000) + data.expires_in);
            }
            return data.access_token;
        }
    } catch (error) {
        console.error("Token refresh failed:", error);
    }
    return null;
}

function subscribeToRefresh(callback: (token: string) => void) {
    refreshSubscribers.push(callback);
}

function onTokenRefreshed(newToken: string) {
    refreshSubscribers.forEach(callback => callback(newToken));
    refreshSubscribers = [];
}

export function setAccessToken(token: string | null) {
    // sanitize token to remove any stray non-Latin1 characters that
    // can break the browser fetch headers (must be ISO-8859-1 compatible)
    function sanitize(t: string) {
        return t.replace(/\uFEFF/g, "").trim().replace(/[^\x00-\xFF]/g, "");
    }

    // Determine if we're in production (HTTPS)
    const isProduction = typeof window !== "undefined" && window.location.protocol === "https:";
    const secureFlag = isProduction ? "; secure" : "";

    if (token) {
        const clean = sanitize(token);
        accessToken = clean;
        if (typeof window !== "undefined") {
            localStorage.setItem("token", clean);
        }
        if (typeof document !== "undefined") {
            document.cookie = `token=${encodeURIComponent(clean)}; path=/; max-age=${24 * 60 * 60}; samesite=strict${secureFlag}`;
        }
    } else {
        accessToken = null;
        if (typeof window !== "undefined") {
            localStorage.removeItem("token");
        }
        if (typeof document !== "undefined") {
            document.cookie = `token=; path=/; max-age=0${secureFlag}`;
        }
    }
}

export function getAccessToken(): string | null {
    if (accessToken) return accessToken;
    if (typeof window !== "undefined") {
        const stored = localStorage.getItem("token");
        if (stored && stored.trim()) {
            accessToken = stored.replace(/\uFEFF/g, "").trim().replace(/[^\x00-\xFF]/g, "");
            return accessToken;
        }
    }
    if (typeof document !== "undefined") {
        const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
        if (match && match[1]) {
            const raw = decodeURIComponent(match[1]);
            accessToken = raw.replace(/\uFEFF/g, "").trim().replace(/[^\x00-\xFF]/g, "");
            if (typeof window !== "undefined") {
                localStorage.setItem("token", accessToken);
            }
        } else {
            accessToken = null;
        }
    }
    return accessToken;
}

export function clearAuth() {
    accessToken = null;
    refreshToken = null;
    tokenExpiry = null;
    if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("tokenExpiry");
        localStorage.removeItem("user");
        // Remove cookie token so it disappears from Application -> Cookies
        try {
            const isProduction = window.location.protocol === "https:";
            const secureFlag = isProduction ? "; secure" : "";
            document.cookie = `token=; path=/; max-age=0; samesite=strict${secureFlag}`;
        } catch (e) {
            // ignore in non-browser contexts
        }
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
        // ensure Authorization header contains only Latin1-safe characters
        const safeToken = token.replace(/\uFEFF/g, "").trim().replace(/[^\x00-\xFF]/g, "");
        headers["Authorization"] = `Bearer ${safeToken}`;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Add timeout handling
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
            
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers,
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);

            if (response.status === 401) {
                // Try to refresh token before giving up
                if (!isRefreshing) {
                    isRefreshing = true;
                    try {
                        const newToken = await refreshAccessToken();
                        isRefreshing = false;
                        
                        if (newToken) {
                            onTokenRefreshed(newToken);
                            // Retry the original request with new token
                            headers["Authorization"] = `Bearer ${newToken}`;
                            continue;
                        } else {
                            // Refresh failed, clear auth and redirect
                            clearAuth();
                            if (typeof window !== "undefined") {
                                window.location.href = "/login";
                            }
                            throw new Error("Session expired. Please login again.");
                        }
                    } catch (refreshError) {
                        isRefreshing = false;
                        clearAuth();
                        if (typeof window !== "undefined") {
                            window.location.href = "/login";
                        }
                        throw new Error("Session expired. Please login again.");
                    }
                } else {
                    // Wait for token refresh to complete
                    return new Promise<T>((resolve, reject) => {
                        subscribeToRefresh((newToken) => {
                            headers["Authorization"] = `Bearer ${newToken}`;
                            apiFetch<T>(endpoint, options, retryOptions)
                                .then(resolve)
                                .catch(reject);
                        });
                    });
                }
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
                    } catch { }
                }

                // Don't throw a full error for 404 on the 'me' endpoint, 
                // handle it gracefully in the caller or return a clear error.
                const apiError = new Error(errorMsg);
                (apiError as any).status = response.status;
                throw apiError;
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
            // Handle timeout specifically
            if (error instanceof Error && error.name === 'AbortError') {
                lastError = new Error("Request timeout - please try again");
            } else {
                lastError = error as Error;
            }

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

export async function getAnalyticsSummary(projectId?: string): Promise<AnalyticsSummary> {
    return apiFetch<AnalyticsSummary>(withProjectId("/api/analytics/summary", projectId));
}

export async function getAnalyticsDashboard(range: string = "24h", projectId?: string): Promise<DashboardData> {
    return apiFetch<DashboardData>(withProjectId(`/api/analytics/dashboard?range=${range}`, projectId));
}

export async function getAnalyticsTimeseries(range: string = "24h", projectId?: string): Promise<AnalyticsDataPoint[]> {
    return apiFetch<AnalyticsDataPoint[]>(withProjectId(`/api/analytics/timeseries?range=${range}`, projectId));
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

export async function getSessions(page = 1, limit = 20, status?: string, search?: string, projectId?: string): Promise<SessionsListResponse> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.append("status", status);
    if (search) params.append("search", search);
    const scopedProjectId = resolveProjectId(projectId);
    if (scopedProjectId) params.append("project_id", scopedProjectId);
    return apiFetch<SessionsListResponse>(`/api/sessions/list?${params.toString()}`);
}

export async function getProjectSessions(projectId: string, page = 1, limit = 20, status?: string, search?: string): Promise<SessionsListResponse> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.append("status", status);
    if (search) params.append("search", search);
    return apiFetch<SessionsListResponse>(`/api/projects/${projectId}/sessions?${params.toString()}`);
}

export async function getSessionStats(range = "24h", projectId?: string): Promise<SessionStats> {
    return apiFetch<SessionStats>(withProjectId(`/api/sessions/stats?range=${range}`, projectId));
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
    const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    // Read body once to avoid "body stream already read" errors
    const bodyText = await response.text();

    if (!response.ok) {
        // Try to parse error JSON
        try {
            const errorJson = JSON.parse(bodyText);
            throw new Error(errorJson.message || errorJson.error || "Invalid credentials");
        } catch {
            throw new Error(bodyText || "Invalid credentials");
        }
    }

    let token: string = "";
    let userData: User | null = null;
    let returnedRefreshToken: string | null = null;
    let returnedExpiresIn: number | null = null;
    
    try {
        const parsed = JSON.parse(bodyText);
        // New API format returns { access_token, token_type, expires_in, user }
        if (parsed.access_token) {
            token = parsed.access_token;
            userData = parsed.user;
            returnedRefreshToken =
                typeof parsed.refresh_token === "string" ? parsed.refresh_token : null;
            returnedExpiresIn =
                typeof parsed.expires_in === "number" ? parsed.expires_in : null;
        } else {
            // Legacy format - just a string token
            token = typeof parsed === "string" ? parsed : "";
        }
    } catch {
        // Legacy format - plain text token
        token = bodyText.trim();
    }

    if (!token) throw new Error("No token returned from server");

    setAccessToken(token);
    setRefreshToken(returnedRefreshToken);
    setTokenExpiry(
        returnedExpiresIn ? Math.floor(Date.now() / 1000) + returnedExpiresIn : null,
    );

    // If user data was included in response, return it directly
    if (userData) {
        return userData;
    }

    // Otherwise fetch user data
    return getMe();
}

export async function logout(): Promise<void> {
    try {
        await fetch(`${API_BASE}/api/auth/logout`, {
            method: "POST",
            credentials: "include",
        });
    } catch {
        // Ignore network/logout endpoint failures and clear local auth anyway.
    }
    clearAuth();
}

export async function getMe(): Promise<User> {
    return await apiFetch<User>("/api/auth/me");
}


export interface Project {
    id: string;
    name: string;
    description?: string;
    status: string;
    short_id?: string;
    user_id?: string;
    created_at: string;
    updated_at?: string;
}

export async function getProjects(): Promise<Project[]> {
    return await apiFetch<Project[]>("/api/projects");
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
    agent_id: string;
    name: string;
    backend_id?: string;
    description?: string;
    instructions?: string;
    welcome_message?: string;
    voice?: string;
    model?: string;
    status: string;
    created_at: string;
    updated_at: string;
    active_sessions?: number;
    allow_interruption?: boolean;
    image?: string;
    entrypoint?: string | null;
    env_vars?: Record<string, string>;
    livekit_permissions?: Record<string, boolean>;
    default_room_behavior?: string;
    auto_restart_policy?: string;
    resource_limits?: {
        cpu_cores?: number;
        memory_mb?: number;
        max_instances?: number;
    };
    is_enabled?: boolean;
}

interface BackendAgent {
    id: string;
    agent_id: string;
    display_name: string;
    image: string;
    entrypoint?: string | null;
    env_vars?: Record<string, string>;
    livekit_permissions?: Record<string, boolean>;
    default_room_behavior?: string;
    auto_restart_policy?: string;
    resource_limits?: {
        cpu_cores?: number;
        memory_mb?: number;
        max_instances?: number;
    };
    is_enabled: boolean;
    created_at: string;
    updated_at: string;
}

function mapBackendAgent(agent: BackendAgent): Agent {
    return {
        id: agent.agent_id || agent.id,
        agent_id: agent.agent_id,
        backend_id: agent.id,
        name: agent.display_name || agent.agent_id,
        status: agent.is_enabled ? "active" : "paused",
        created_at: agent.created_at,
        active_sessions: (agent as any).active_sessions || 0,
        voice: "alloy",
        model: "gpt-4o-mini",
        image: agent.image,
        entrypoint: agent.entrypoint ?? undefined,
        env_vars: agent.env_vars || {},
        livekit_permissions: agent.livekit_permissions || {},
        default_room_behavior: agent.default_room_behavior,
        auto_restart_policy: agent.auto_restart_policy,
        resource_limits: agent.resource_limits || {},
        is_enabled: agent.is_enabled,
        updated_at: agent.updated_at || agent.created_at,
    };
}

function toBackendAgentPayload(agent: Partial<Agent>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (agent.name !== undefined) payload.name = agent.name;
    if (agent.image !== undefined) payload.image = agent.image;
    if (agent.entrypoint !== undefined) payload.entrypoint = agent.entrypoint;
    if (agent.env_vars !== undefined) payload.environment = agent.env_vars;
    if (agent.livekit_permissions !== undefined) payload.livekit_permissions = agent.livekit_permissions;
    if (agent.default_room_behavior !== undefined) payload.default_room_behavior = agent.default_room_behavior;
    if (agent.auto_restart_policy !== undefined) payload.auto_restart_policy = agent.auto_restart_policy;
    if (agent.resource_limits !== undefined) payload.resource_limits = agent.resource_limits;
    if (agent.is_enabled !== undefined) payload.is_enabled = agent.is_enabled;
    if (agent.status !== undefined) payload.status = agent.status;
    if (agent.welcome_message !== undefined) payload.welcome_message = agent.welcome_message;

    // Forward optional UX fields for future backend support.
    if (agent.description !== undefined) payload.description = agent.description;
    if (agent.instructions !== undefined) payload.instructions = agent.instructions;
    if (agent.welcome_message !== undefined) payload.welcome_message = agent.welcome_message;
    if (agent.allow_interruption !== undefined) payload.allow_interruption = agent.allow_interruption;

    return payload;
}

export async function getAgents(projectId: string): Promise<Agent[]> {
    const agents = await apiFetch<BackendAgent[]>(`/api/projects/${projectId}/agents`);
    return agents.map(mapBackendAgent);
}

export async function getAgent(projectId: string, agentId: string): Promise<Agent> {
    const agent = await apiFetch<BackendAgent>(`/api/projects/${projectId}/agents/${agentId}`);
    return mapBackendAgent(agent);
}

export async function createAgent(projectId: string, agent: Partial<Agent>): Promise<Agent> {
    const created = await apiFetch<BackendAgent>(`/api/projects/${projectId}/agents`, {
        method: "POST",
        body: JSON.stringify(toBackendAgentPayload(agent)),
    });
    return mapBackendAgent(created);
}

export async function updateAgent(projectId: string, agentId: string, agent: Partial<Omit<Agent, 'id' | 'created_at' | 'updated_at'>> & { welcome_message?: string | null }): Promise<Agent> {
    const updated = await apiFetch<BackendAgent>(`/api/projects/${projectId}/agents/${agentId}`, {
        method: "PUT",
        body: JSON.stringify(toBackendAgentPayload(agent)),
    });
    return mapBackendAgent(updated);
}

export async function deleteAgent(projectId: string, agentId: string): Promise<void> {
    await apiFetch(`/api/projects/${projectId}/agents/${agentId}`, { method: "DELETE" });
}

// Direct agent access without projectId (for agent detail pages)
export async function getAgentById(agentId: string): Promise<Agent> {
    const agent = await apiFetch<BackendAgent>(`/api/agents/${agentId}`);
    return mapBackendAgent(agent);
}

export interface AgentMetrics {
    total_sessions: number;
    avg_latency_ms: number;
    uptime_percent: number;
    success_rate_percent: number;
    cpu_usage?: number;
    memory_usage?: number;
}

export async function getAgentMetrics(agentId: string): Promise<AgentMetrics> {
    return apiFetch<AgentMetrics>(`/api/agents/${agentId}/metrics`);
}

export interface DeployAgentResponse {
    instance_id: string;
    status: string;
    container_id?: string;
    process_pid?: number;
}

export async function deployAgent(
    projectId: string,
    agentId: string,
    options: { deployment_type?: "process"; room_name?: string } = {},
): Promise<DeployAgentResponse> {
    return apiFetch<DeployAgentResponse>(`/api/projects/${projectId}/agents/${agentId}/deploy`, {
        method: "POST",
        body: JSON.stringify({
            deployment_type: options.deployment_type || "process",
            room_name: options.room_name,
        }),
    });
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
    room_prefix?: string;
    randomize?: boolean;
    agent_id?: string;
    trunk_id?: string;
    agent_name?: string;
    trunk_name?: string;
    created_at: string;
}

export interface CreateDispatchRulePayload {
    name: string;
    rule_type: "individual" | "direct" | "callee";
    room_prefix?: string;
    randomize?: boolean;
    pin?: string;
    room_name?: string;
    trunk_ids?: string[];
    trunk_id?: string;
    agent_id?: string;
    inbound_numbers?: string[];
    hide_phone_number?: boolean;
    metadata?: string;
}

export interface CallLog {
    id: string;
    call_id: string;
    from_number: string;
    to_number: string;
    direction: "inbound" | "outbound";
    started_at: string;
    ended_at?: string;
    duration_seconds?: number;
    status: string;
    trunk_id?: string;
    room_name?: string;
    participant_identity?: string;
    project_id?: string;
    // Extended SIP tracking fields
    sip_call_id?: string;
    room_sid?: string;
    from_sip_uri?: string;
    to_sip_uri?: string;
    hangup_cause?: string;
    hangup_source?: string;
    recording_url?: string;
    recording_duration?: number;
}

interface BackendSipTrunk {
    id: string;
    sip_trunk_id: string;
    name?: string;
    inbound_numbers_regex?: string[];
    outbound_address?: string;
    sip_server?: string;
    username?: string;
    created_at?: string;
}

function mapBackendSipTrunk(trunk: BackendSipTrunk): SipTrunk {
    const sipServer = trunk.sip_server || trunk.outbound_address;
    return {
        id: trunk.id || trunk.sip_trunk_id,
        name: trunk.name || trunk.id || trunk.sip_trunk_id,
        numbers: trunk.inbound_numbers_regex || [],
        sip_server: sipServer,
        sip_uri: sipServer ? `sip:${sipServer}` : undefined,
        username: trunk.username,
        created_at: trunk.created_at || new Date().toISOString(),
    };
}

interface BackendDispatchRule {
    id: string;
    name?: string;
    rule_type?: string;
    room_prefix?: string;
    randomize?: boolean;
    agent_id?: string;
    trunk_id?: string;
}

function mapBackendDispatchRule(rule: BackendDispatchRule): DispatchRule {
    return {
        id: rule.id,
        name: rule.name || rule.id,
        rule_type: rule.rule_type || "direct",
        room_prefix: rule.room_prefix,
        randomize: rule.randomize,
        agent_id: rule.agent_id,
        trunk_id: rule.trunk_id,
        created_at: new Date().toISOString(),
    };
}

export async function getSipTrunks(projectId?: string): Promise<SipTrunk[]> {
    const trunks = await apiFetch<BackendSipTrunk[]>(withProjectId("/api/telephony/sip-trunks", projectId));
    return trunks.map(mapBackendSipTrunk);
}

export async function createSipTrunk(trunk: Partial<SipTrunk>, projectId?: string): Promise<SipTrunk> {
    const created = await apiFetch<BackendSipTrunk>("/api/telephony/sip-trunks", {
        method: "POST",
        body: JSON.stringify({ ...trunk, project_id: resolveProjectId(projectId) }),
    });
    return mapBackendSipTrunk(created);
}

export async function updateSipTrunk(
    id: string,
    trunk: Partial<SipTrunk>,
    projectId?: string,
): Promise<SipTrunk> {
    const updated = await apiFetch<BackendSipTrunk>(`/api/telephony/sip-trunks/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...trunk, project_id: resolveProjectId(projectId) }),
    });
    return mapBackendSipTrunk(updated);
}

export async function deleteSipTrunk(id: string, projectId?: string): Promise<void> {
    await apiFetch(withProjectId(`/api/telephony/sip-trunks/${id}`, projectId), { method: "DELETE" });
}

export async function getDispatchRules(projectId?: string): Promise<DispatchRule[]> {
    const rules = await apiFetch<BackendDispatchRule[]>(withProjectId("/api/telephony/dispatch-rules", projectId));
    return rules.map(mapBackendDispatchRule);
}

export async function createDispatchRule(rule: CreateDispatchRulePayload, projectId?: string): Promise<DispatchRule> {
    const created = await apiFetch<BackendDispatchRule>("/api/telephony/dispatch-rules", {
        method: "POST",
        body: JSON.stringify({ ...rule, project_id: resolveProjectId(projectId) }),
    });
    return mapBackendDispatchRule(created);
}

export async function updateDispatchRule(
    id: string,
    rule: Partial<CreateDispatchRulePayload>,
    projectId?: string,
): Promise<DispatchRule> {
    const updated = await apiFetch<BackendDispatchRule>(`/api/telephony/dispatch-rules/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...rule, project_id: resolveProjectId(projectId) }),
    });
    return mapBackendDispatchRule(updated);
}

export async function deleteDispatchRule(id: string, projectId?: string): Promise<void> {
    await apiFetch(withProjectId(`/api/telephony/dispatch-rules/${id}`, projectId), { method: "DELETE" });
}

export async function getCallLogs(limit: number = 50, projectId?: string): Promise<CallLog[]> {
    return apiFetch<CallLog[]>(withProjectId(`/api/telephony/call-logs?limit=${limit}`, projectId));
}

export async function createOutboundCall(
    payload: {
        trunk_id: string;
        to_number: string;
        room_name?: string;
        participant_identity?: string;
    },
    projectId?: string,
): Promise<CallLog> {
    return apiFetch<CallLog>("/api/telephony/outbound-call", {
        method: "POST",
        body: JSON.stringify({
            ...payload,
            project_id: resolveProjectId(projectId),
        }),
    });
}

export async function endCall(callId: string, projectId?: string): Promise<void> {
    await apiFetch(withProjectId(`/api/telephony/calls/${callId}/end`, projectId), {
        method: "POST",
    });
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
    // Backend returns direct array, not wrapped object
    const data = await apiFetch<Room[]>("/api/livekit/rooms");
    return data;
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
    started_at: string | number;
    ended_at?: string | number;
    room_id?: string;
    project_id?: string;
    type?: string;
    source_type?: string;
    url?: string;
    web_url?: string;
    error?: string;
    error_code?: string;
    error_message?: string;
    // Output results
    file_results?: Array<{
        filename?: string;
        location?: string;
        duration?: number;
        size?: number;
    }>;
    stream_results?: Array<{
        url?: string;
        duration?: number;
        status?: string;
    }>;
    segment_results?: Array<{
        playlistName?: string;
        duration?: number;
        size?: number;
    }>;
    image_results?: Array<{
        filename?: string;
        location?: string;
        capturedAt?: number;
    }>;
    // Source tracking
    participant_identity?: string;
    track_id?: string;
    audio_only?: boolean;
    video_only?: boolean;
    layout?: string;
}

export async function getEgresses(projectId?: string): Promise<Egress[]> {
    const data = await apiFetch<Egress[]>(withProjectId("/api/livekit/egresses", projectId));
    return data.map((item) => ({
        ...item,
        status: item.status.toLowerCase().replace("egress_", ""),
    }));
}

export async function startRoomEgress(roomName: string, projectId?: string): Promise<Egress> {
    return apiFetch<Egress>("/api/livekit/egress/room-composite", {
        method: "POST",
        body: JSON.stringify({ room_name: roomName, project_id: resolveProjectId(projectId) }),
    });
}

export async function startWebEgress(
    payload: {
        url: string;
        audio_only?: boolean;
        video_only?: boolean;
        output_format?: string;
    },
    projectId?: string,
): Promise<Egress> {
    return apiFetch<Egress>("/api/livekit/egress/web", {
        method: "POST",
        body: JSON.stringify({
            ...payload,
            project_id: resolveProjectId(projectId),
        }),
    });
}

export async function startParticipantEgress(roomName: string, participantIdentity: string, outputType: string = "file", projectId?: string): Promise<Egress> {
    return apiFetch<Egress>("/api/livekit/egress/participant", {
        method: "POST",
        body: JSON.stringify({ room_name: roomName, identity: participantIdentity, output_type: outputType, project_id: resolveProjectId(projectId) }),
    });
}

export async function startTrackEgress(
    payload: {
        room_name: string;
        track_sid: string;
        output_format?: string;
        filepath?: string;
        disable_manifest?: boolean;
    },
    projectId?: string,
): Promise<Egress> {
    return apiFetch<Egress>("/api/livekit/egress/track", {
        method: "POST",
        body: JSON.stringify({
            ...payload,
            project_id: resolveProjectId(projectId),
        }),
    });
}

export async function startImageEgress(
    payload: {
        room_name: string;
        width: number;
        height: number;
        filename_prefix?: string;
        capture_interval?: number;
    },
    projectId?: string,
): Promise<Egress> {
    return apiFetch<Egress>("/api/livekit/egress/image", {
        method: "POST",
        body: JSON.stringify({
            ...payload,
            project_id: resolveProjectId(projectId),
        }),
    });
}

export async function stopEgress(egressId: string, projectId?: string): Promise<void> {
    await apiFetch("/api/livekit/egress/stop", {
        method: "POST",
        body: JSON.stringify({ egress_id: egressId, project_id: resolveProjectId(projectId) }),
    });
}

export interface Ingress {
    ingress_id: string;
    name: string;
    stream_key: string;
    url: string;
    ingress_type: string;
    input_type?: number;
    status: string;
    room_name?: string;
    participant_identity?: string;
    participant_name?: string;
    resource_id?: string;
    room_id?: string;
    reusable?: boolean;
    started_at?: number;
    ended_at?: number;
    error?: string;
    track_count?: number;
    track_sids?: string[];
    audio_codec?: string;
    video_codec?: string;
    audio_bitrate?: number;
    video_bitrate?: number;
    video_resolution?: string;
    project_id?: string;
    created_at?: number;
}

export async function getIngresses(projectId?: string): Promise<Ingress[]> {
    // Backend returns direct array, not wrapped object
    const data = await apiFetch<Ingress[]>(withProjectId("/api/livekit/ingresses", projectId));
    return data;
}

export async function createIngress(name: string, type: "rtmp" | "whip", projectId?: string): Promise<Ingress> {
    return apiFetch<Ingress>("/api/livekit/ingress", {
        method: "POST",
        body: JSON.stringify({ name, ingress_type: type, project_id: resolveProjectId(projectId) }),
    });
}

export async function createUrlIngress(
    payload: {
        name: string;
        url: string;
        room_name: string;
        participant_identity: string;
        participant_name: string;
        audio_enabled: boolean;
        video_enabled: boolean;
    },
    projectId?: string,
): Promise<Ingress> {
    return apiFetch<Ingress>("/api/livekit/ingress/url", {
        method: "POST",
        body: JSON.stringify({
            ...payload,
            project_id: resolveProjectId(projectId),
        }),
    });
}

export async function deleteIngress(id: string, projectId?: string): Promise<void> {
    await apiFetch(withProjectId(`/api/livekit/ingress/${id}`, projectId), { method: "DELETE" });
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
    name: string;
    url: string;
    events: string[];
    secret?: string;
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
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE}/api/monitoring/prometheus`, { headers });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.text();
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
    const page = Math.floor(offset / Math.max(limit, 1)) + 1;
    const logs = await apiFetch<AuditLogEntry[]>(`/api/audit-logs?limit=${limit}&page=${page}`);
    return { logs, total: logs.length };
}

// API KEYS & WEBHOOKS

export async function getApiKeys(projectId?: string): Promise<ApiKey[]> {
    return apiFetch<ApiKey[]>(withProjectId("/api/livekit/api-keys", projectId));
}

export async function createApiKey(name: string, projectId?: string): Promise<ApiKey> {
    return apiFetch<ApiKey>("/api/livekit/api-keys", {
        method: "POST",
        body: JSON.stringify({ name, project_id: resolveProjectId(projectId) }),
    });
}

export async function deleteApiKey(id: string, projectId?: string): Promise<void> {
    await apiFetch(withProjectId(`/api/livekit/api-keys/${id}`, projectId), { method: "DELETE" });
}

export async function getWebhooks(projectId?: string): Promise<Webhook[]> {
    return apiFetch<Webhook[]>(withProjectId("/api/settings/webhooks", projectId));
}

export async function createWebhook(name: string, url: string, events: string[], projectId?: string): Promise<Webhook> {
    return apiFetch<Webhook>("/api/settings/webhooks", {
        method: "POST",
        body: JSON.stringify({ name, url, events, project_id: resolveProjectId(projectId) }),
    });
}

export async function deleteWebhook(id: string, projectId?: string): Promise<void> {
    await apiFetch(withProjectId(`/api/settings/webhooks/${id}`, projectId), { method: "DELETE" });
}

export async function getTeamMembers(): Promise<TeamMember[]> {
    return apiFetch<TeamMember[]>("/api/settings/members");
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

export interface LiveKitEnvConfig {
    LIVEKIT_URL: string;
    LIVEKIT_API_URL: string;
    LIVEKIT_API_KEY: string;
    LIVEKIT_API_SECRET: string;
    provider: string;
    status: string;
}

export async function getLiveKitEnvConfig(): Promise<LiveKitEnvConfig> {
    return apiFetch<LiveKitEnvConfig>("/api/settings/livekit-config");
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
