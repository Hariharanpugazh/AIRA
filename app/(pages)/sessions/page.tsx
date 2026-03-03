"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/Header";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { DelayedLoader } from "../../../components/ui/DelayedLoader";
import {
  Search,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock3,
  Radio,
  Activity,
} from "lucide-react";
import {
  getAccessToken,
  getSessions,
  getSessionStats,
  getProjects,
  getAnalyticsDashboard,
  type Project,
  type SessionStats,
  type SessionsListResponse,
  type DashboardData,
} from "../../../lib/api";
import { cn } from "../../../lib/utils";

interface SessionsPageProps {
  projectId?: string;
}

const PAGE_SIZE = 10;

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
};

export default function SessionsPage({ projectId }: SessionsPageProps) {
  const router = useRouter();
  const [sessionsData, setSessionsData] = useState<SessionsListResponse | null>(null);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loading = loadingProjects || loadingSessions || loadingStats;
  const showNoProjects = !loadingProjects && projects.length === 0;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      if (!getAccessToken()) {
        router.push("/login");
        return;
      }
      const projectsRes = await getProjects();
      setProjects(projectsRes);
      const savedProjectId = localStorage.getItem("projectId");
      const project =
        projectsRes.find((p) => p.id === projectId || p.short_id === projectId) ||
        projectsRes.find((p) => p.id === savedProjectId || p.short_id === savedProjectId) ||
        projectsRes[0];
      if (project) {
        setCurrentProject(project);
        localStorage.setItem("projectId", project.id);
        localStorage.setItem("projectName", project.name);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setLoadingProjects(false);
    }
  }, [projectId, router]);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    setError(null);
    try {
      if (!getAccessToken()) {
        router.push("/login");
        return;
      }
      const sessionsRes = await getSessions(
        page,
        PAGE_SIZE,
        statusFilter === "all" ? undefined : statusFilter,
        debouncedSearch,
        currentProject?.id,
      );
      setSessionsData(sessionsRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions");
    } finally {
      setLoadingSessions(false);
    }
  }, [currentProject?.id, debouncedSearch, page, router, statusFilter]);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      if (!getAccessToken()) {
        router.push("/login");
        return;
      }
      const [statsRes, dashRes] = await Promise.all([
        getSessionStats("24h", currentProject?.id),
        getAnalyticsDashboard("24h", currentProject?.id),
      ]);
      setStats(statsRes);
      setDashboardData(dashRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
      setStats(null);
      setDashboardData(null);
    } finally {
      setLoadingStats(false);
    }
  }, [currentProject?.id, router]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!loadingProjects) {
      loadSessions();
      loadStats();
    }
  }, [loadSessions, loadStats, loadingProjects]);

  useEffect(() => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
    if (autoRefreshInterval > 0) {
      autoRefreshRef.current = setInterval(() => {
        loadSessions();
        loadStats();
      }, autoRefreshInterval);
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [autoRefreshInterval, loadSessions, loadStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadSessions(), loadStats()]);
    setRefreshing(false);
  };

  const activeSessions = sessionsData?.data.filter((s) => s.status === "active").length || 0;
  const avgDurationMinutes = dashboardData ? Math.round(dashboardData.rooms.avg_duration / 60) : 0;
  const totalParticipants = stats?.unique_participants || 0;
  const totalSessions = stats?.total_rooms || 0;

  return (
    <>
      {loading && <DelayedLoader />}
      <Header
        projectName={currentProject?.name || "Project"}
        pageName="Sessions"
        showTimeRange
        onRefresh={handleRefresh}
        onAutoRefreshChange={setAutoRefreshInterval}
      />

      {error && (
        <div className="mx-6 md:mx-8 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {showNoProjects ? (
        <div className="p-6 md:p-8">
          <div className="mx-auto max-w-3xl rounded-xl border border-dashed border-border bg-surface p-10 text-center">
            <h2 className="text-2xl font-semibold text-foreground">No Projects Found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a project first to view and monitor sessions.
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-[1600px] animate-fade-in space-y-6 p-6 md:p-8" style={{ fontFamily: "'Outfit', sans-serif" }}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card className="group relative overflow-hidden border-border/60 bg-background/50 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md">
              <div className="absolute right-0 top-0 h-20 w-20 translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 transition-transform duration-500 group-hover:scale-150" />
              <div className="relative">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Radio className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Sessions</span>
                </div>
                <div className="text-3xl font-semibold tracking-tight text-foreground">{totalSessions}</div>
              </div>
            </Card>

            <Card className="group relative overflow-hidden border-border/60 bg-background/50 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md">
              <div className="absolute right-0 top-0 h-20 w-20 translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/5 transition-transform duration-500 group-hover:scale-150" />
              <div className="relative">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Activity className="h-4 w-4 text-emerald-500" />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Live Now</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-semibold tracking-tight text-foreground">{activeSessions}</div>
                  {activeSessions > 0 && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}
                </div>
              </div>
            </Card>

            <Card className="group relative overflow-hidden border-border/60 bg-background/50 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md">
              <div className="absolute right-0 top-0 h-20 w-20 translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/5 transition-transform duration-500 group-hover:scale-150" />
              <div className="relative">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                    <Users className="h-4 w-4 text-blue-500" />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Participants</span>
                </div>
                <div className="text-3xl font-semibold tracking-tight text-foreground">{totalParticipants}</div>
              </div>
            </Card>

            <Card className="group relative overflow-hidden border-border/60 bg-background/50 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md">
              <div className="absolute right-0 top-0 h-20 w-20 translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/5 transition-transform duration-500 group-hover:scale-150" />
              <div className="relative">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                    <Clock3 className="h-4 w-4 text-violet-500" />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Avg Duration</span>
                </div>
                <div className="text-3xl font-semibold tracking-tight text-foreground">{avgDurationMinutes}m</div>
              </div>
            </Card>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold tracking-tight">Session Logs</h2>
                <span className="rounded-full bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {sessionsData?.total || 0}
                </span>
                {refreshing && (
                  <div className="flex items-center gap-1.5 text-xs text-primary animate-pulse">
                    <div className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
                    Refreshing...
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-2.5">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 bg-transparent text-xs text-foreground outline-none"
                  >
                    <option value="all">All status</option>
                    <option value="active">Active</option>
                    <option value="ended">Ended</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div className="group relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search sessions..."
                    className="h-9 w-64 rounded-lg border border-border/60 bg-background pl-9 pr-8 text-xs outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead className="border-b border-border/50 bg-muted/30 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-bold">Session ID</th>
                      <th className="px-5 py-3 font-bold">Room</th>
                      <th className="px-5 py-3 font-bold">Started</th>
                      <th className="px-5 py-3 font-bold">Ended</th>
                      <th className="px-5 py-3 font-bold">Duration</th>
                      <th className="px-5 py-3 font-bold">Participants</th>
                      <th className="px-5 py-3 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {loadingSessions ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-5 py-3.5"><div className="h-3.5 w-28 rounded bg-muted" /></td>
                          <td className="px-5 py-3.5"><div className="h-3.5 w-24 rounded bg-muted" /></td>
                          <td className="px-5 py-3.5"><div className="h-3.5 w-28 rounded bg-muted" /></td>
                          <td className="px-5 py-3.5"><div className="h-3.5 w-28 rounded bg-muted" /></td>
                          <td className="px-5 py-3.5"><div className="h-3.5 w-14 rounded bg-muted" /></td>
                          <td className="px-5 py-3.5"><div className="h-3.5 w-12 rounded bg-muted" /></td>
                          <td className="px-5 py-3.5"><div className="h-5 w-16 rounded-full bg-muted" /></td>
                        </tr>
                      ))
                    ) : sessionsData?.data.length ? (
                      sessionsData.data.map((session) => (
                        <tr
                          key={session.sid}
                          className="group cursor-pointer transition-colors hover:bg-muted/20"
                          onClick={() =>
                            session.status === "active"
                              ? router.push(`/sessions/${encodeURIComponent(session.room_name)}`)
                              : undefined
                          }
                        >
                          <td className="px-5 py-3.5 font-mono text-[11px] text-muted-foreground/80">{session.sid}</td>
                          <td className="px-5 py-3.5 text-foreground font-medium">{session.room_name}</td>
                          <td className="px-5 py-3.5 text-[12px] text-muted-foreground">{formatDate(session.start_time)}</td>
                          <td className="px-5 py-3.5 text-[12px] text-muted-foreground">
                            {session.end_time ? formatDate(session.end_time) : "-"}
                          </td>
                          <td className="px-5 py-3.5 text-foreground">
                            {session.status === "active" ? (
                              <span className="flex items-center gap-1.5 text-emerald-500">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                                Live
                              </span>
                            ) : (
                              formatDuration(session.duration)
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-foreground">{session.total_participants}</td>
                          <td className="px-5 py-3.5">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                                session.status === "active"
                                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "border-border/50 bg-muted text-muted-foreground",
                              )}
                            >
                              {session.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-20 text-center">
                          <div className="mx-auto flex max-w-[280px] flex-col items-center gap-2.5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
                              <Radio className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">No sessions found</p>
                            <p className="text-xs text-muted-foreground/60">
                              {searchQuery || statusFilter !== "all"
                                ? "Try adjusting search or filters"
                                : "Sessions will appear here as rooms are created"}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {sessionsData && sessionsData.total > PAGE_SIZE && !loadingSessions && (
                <div className="flex items-center justify-between border-t border-border/50 bg-muted/10 px-5 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="text-xs"
                  >
                    <ChevronLeft className="mr-1.5 h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">Page {page}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={sessionsData.data.length < PAGE_SIZE}
                    className="text-xs"
                  >
                    Next
                    <ChevronRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
