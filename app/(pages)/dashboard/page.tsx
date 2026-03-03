"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
// DashboardLayout removed (handled by app wrapper)
import Header from "../../components/Header";
import { StatsCard } from "../../../components/StatsCard";
import { Card } from "../../../components/ui/Card";
import { ChevronRightIcon } from "../../components/icons";
import { getAccessToken, getProjects, getAnalyticsDashboard, getAnalyticsTimeseries, getAnalyticsSummary, getRooms, Project, DashboardData, AnalyticsDataPoint } from "../../../lib/api";
import { AnalyticsCard } from "../../../components/AnalyticsCard";
import { StatsLineChart, DonutChart } from "../../../components/Charts";
import { DelayedLoader } from "../../../components/ui/DelayedLoader";
import { extractProjectIdFromRoom } from "../../../lib/utils";

interface DashboardPageProps {
  projectId?: string;
}

export default function DashboardPage({ projectId }: DashboardPageProps) {
  const router = useRouter();
  // Analytics State
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("24h");

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [summaryData, setSummaryData] = useState<{ active_rooms: number; total_participants: number } | null>(null);
  const [timeseries, setTimeseries] = useState<AnalyticsDataPoint[]>([]);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);

  const loadData = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const projectsData = await getProjects();
      setProjects(projectsData);

      const savedProjectId = localStorage.getItem("projectId");
      const resolvedProject =
        projectsData.find((p) => p.id === projectId || p.short_id === projectId) ||
        projectsData.find((p) => p.id === savedProjectId) ||
        projectsData[0] ||
        null;

      if (resolvedProject) {
        setCurrentProject(resolvedProject);
        localStorage.setItem("projectId", resolvedProject.id);
        localStorage.setItem("projectName", resolvedProject.name);
      }

      const scopedProjectId = resolvedProject?.id;
      const [dashData, timeseriesData, summaryRes, roomsRes] = await Promise.allSettled([
        getAnalyticsDashboard(timeRange, scopedProjectId),
        getAnalyticsTimeseries(timeRange, scopedProjectId),
        getAnalyticsSummary(scopedProjectId),
        getRooms()
      ]);

      if (dashData.status === "fulfilled") setDashboardData(dashData.value);
      if (timeseriesData.status === "fulfilled") setTimeseries(timeseriesData.value);
      if (summaryRes.status === "fulfilled") setSummaryData(summaryRes.value);
      if (roomsRes.status === "fulfilled") {
        let rooms = roomsRes.value;
        if (scopedProjectId) {
          rooms = rooms.filter((room: any) => {
            const pid = extractProjectIdFromRoom(room.name);
            return pid === scopedProjectId;
          });
        }
        setLiveSessions(rooms);
      }
    } catch (e) {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router, projectId, timeRange]);

  useEffect(() => {
    loadData();
    // Auto-refresh live data every 15 seconds
    const interval = setInterval(() => {
      const scopedProjectId = currentProject?.id;
      getRooms().then(rooms => {
        if (scopedProjectId) {
          rooms = rooms.filter((r: any) => extractProjectIdFromRoom(r.name) === scopedProjectId);
        }
        setLiveSessions(rooms);
      });
      getAnalyticsSummary(scopedProjectId).then(summary => setSummaryData(summary));
    }, 15000);
    return () => clearInterval(interval);
  }, [loadData, currentProject]);

  const routeProjectId = currentProject?.short_id || currentProject?.id || projectId || "";
  const basePath = routeProjectId ? `/${routeProjectId}` : "";

  const links = [
    { name: "Rooms", path: "/sessions" },
    { name: "Telephony", path: "/telephony" },
    { name: "Egress", path: "/egresses" },
    { name: "Ingress", path: "/ingresses" },
    { name: "Settings", path: "/settings/project" },
  ];

  // Skeleton components
  const SkeletonStatsCard = () => (
    <Card className="p-6 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm">
      <div className="animate-pulse">
        <div className="h-4 bg-muted rounded w-24 mb-4"></div>
        <div className="h-8 bg-muted rounded w-16 mb-2"></div>
        <div className="h-3 bg-muted rounded w-12"></div>
      </div>
    </Card>
  );

  const SkeletonAnalyticsCard = ({ title }: { title: string }) => (
    <AnalyticsCard title={title}>
      <div className="animate-pulse">
        <div className="h-[200px] bg-muted rounded"></div>
      </div>
    </AnalyticsCard>
  );

  return (
    <>
      {loading && <DelayedLoader />}
      <Header
        projectName={currentProject?.name || "Project"}
        pageName="Overview"
        onRefresh={loadData}
        onTimeRangeChange={setTimeRange}
      />

      <div className="space-y-6 animate-fade-in pt-6 pb-8" style={{ fontFamily: "'Outfit', sans-serif" }}>
        {loading ? (
          <>
            {/* Skeleton Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <SkeletonStatsCard />
              <SkeletonStatsCard />
              <SkeletonStatsCard />
              <SkeletonStatsCard />
            </div>

            {/* Skeleton Analytics Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <SkeletonAnalyticsCard title="Platforms" />
              <SkeletonAnalyticsCard title="Connection Type" />
              <SkeletonAnalyticsCard title="Top Countries" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <SkeletonAnalyticsCard title="Total Minutes" />
              <div className="col-span-3">
                <AnalyticsCard title="Connection Trends">
                  <div className="animate-pulse h-[240px] bg-muted rounded"></div>
                </AnalyticsCard>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <SkeletonAnalyticsCard title="Agents" />
              <SkeletonAnalyticsCard title="Telephony" />
              <SkeletonAnalyticsCard title="Rooms" />
            </div>
          </>
        ) : (
          <>
            {/* Highlights Section */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Key Metrics</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                label="Connection Success"
                value={`${dashboardData?.overview.connection_success || 0}%`}
                subValue="Last 24h"
                chart={<div className="h-1.5 w-full bg-surface mt-3 rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-1000" style={{ width: `${dashboardData?.overview.connection_success || 0}%` }} /></div>}
              />
              <StatsCard label="Active Rooms" value={String(summaryData?.active_rooms ?? 0)} subValue="Real-time" />
              <StatsCard label="Participants" value={String(summaryData?.total_participants ?? 0)} subValue="Connected" />
              <StatsCard label="Total Projects" value={String(projects.length)} subValue="Active" />
            </div>

            {/* Analytics Section */}
            <div className="flex items-center gap-2 mt-6 mb-2">
              <div className="w-1.5 h-6 bg-accent rounded-full" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Infrastructure & Geolocation</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <AnalyticsCard title="Platforms">
                <div className="h-[200px]">
                  <DonutChart data={[
                    { name: "Linux", value: dashboardData?.platforms.linux || 0 },
                    { name: "Windows", value: dashboardData?.platforms.windows || 0 },
                    { name: "Android", value: dashboardData?.platforms.android || 0 },
                    { name: "iOS", value: dashboardData?.platforms.ios || 0 },
                    { name: "Browser", value: dashboardData?.platforms.browser || 0 },
                    { name: "Other", value: dashboardData?.platforms.other || 0 },
                  ].some(d => d.value > 0) ? [
                    { name: "Linux", value: dashboardData?.platforms.linux || 0 },
                    { name: "Windows", value: dashboardData?.platforms.windows || 0 },
                    { name: "Android", value: dashboardData?.platforms.android || 0 },
                    { name: "iOS", value: dashboardData?.platforms.ios || 0 },
                    { name: "Browser", value: dashboardData?.platforms.browser || 0 },
                    { name: "Other", value: dashboardData?.platforms.other || 0 },
                  ].filter(d => d.value > 0) : [{ name: "No Data", value: 100 }]} />
                </div>
              </AnalyticsCard>

              <AnalyticsCard title="Connection Type">
                <div className="h-[200px]">
                  <DonutChart data={[
                    { name: "UDP", value: dashboardData?.overview.connection_type.udp || 0 },
                    { name: "TCP", value: dashboardData?.overview.connection_type.tcp || 0 },
                  ].some(d => d.value > 0) ? [
                    { name: "UDP", value: dashboardData?.overview.connection_type.udp || 0 },
                    { name: "TCP", value: dashboardData?.overview.connection_type.tcp || 0 },
                  ].filter(d => d.value > 0) : [{ name: "No Data", value: 100 }]} />
                </div>
              </AnalyticsCard>

              <AnalyticsCard title="Top Countries">
                <div className="space-y-4 mt-2">
                  {(dashboardData?.overview.top_countries && dashboardData.overview.top_countries.length > 0) ? (
                    dashboardData.overview.top_countries.map((c, i) => (
                      <div key={c.name} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-foreground font-medium">{c.name}</span>
                          <span className="font-mono text-primary font-bold">{c.count}</span>
                        </div>
                        <div className="w-full bg-surface h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-primary h-full transition-all duration-1000"
                            style={{ width: `${Math.min(100, (c.count / (dashboardData.overview.top_countries?.[0]?.count || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center animate-pulse">
                        <svg className="w-6 h-6 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-foreground">Awaiting Connections</div>
                        <div className="text-[10px] text-muted-foreground leading-relaxed px-4">
                          Real-time geolocation will activate automatically when participants join from remote regions.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </AnalyticsCard>
            </div>

            {/* Usage Section */}
            <div className="flex items-center gap-2 mt-6 mb-2">
              <div className="w-1.5 h-6 bg-warning rounded-full" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider" style={{ fontFamily: "'Outfit', sans-serif" }}>Usage & Performance</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <AnalyticsCard title="Total Minutes" className="col-span-1">
                <div className="flex flex-col h-full justify-center">
                  <div className="text-3xl font-black text-foreground mb-0.5">
                    {Math.round((dashboardData?.participants.total_minutes || 0) / 60)} <span className="text-base text-muted-foreground font-normal">mins</span>
                  </div>
                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold">
                      <span className="text-muted-foreground">WebRTC</span>
                      <span className="text-foreground">{Math.round((dashboardData?.participants.webrtc_minutes || 0) / 60)}m</span>
                    </div>
                    <div className="w-full bg-surface h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full transition-all duration-1000" style={{ width: `${((dashboardData?.participants.webrtc_minutes || 0) / (dashboardData?.participants.total_minutes || 1)) * 100}%` }} />
                    </div>

                    <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold mt-3">
                      <span className="text-muted-foreground">Agents</span>
                      <span className="text-foreground">{Math.round((dashboardData?.participants.agent_minutes || 0) / 60)}m</span>
                    </div>
                    <div className="w-full bg-surface h-1.5 rounded-full overflow-hidden">
                      <div className="bg-accent h-full transition-all duration-1000" style={{ width: `${((dashboardData?.participants.agent_minutes || 0) / (dashboardData?.participants.total_minutes || 1)) * 100}%` }} />
                    </div>

                    <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold mt-3">
                      <span className="text-muted-foreground">SIP</span>
                      <span className="text-foreground">{Math.round((dashboardData?.participants.sip_minutes || 0) / 60)}m</span>
                    </div>
                    <div className="w-full bg-surface h-1.5 rounded-full overflow-hidden">
                      <div className="bg-warning h-full transition-all duration-1000" style={{ width: `${((dashboardData?.participants.sip_minutes || 0) / (dashboardData?.participants.total_minutes || 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </AnalyticsCard>

              <AnalyticsCard
                title="Connection Trends"
                className="col-span-3"
                headerAction={
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/5 border border-primary/10">
                    <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                    <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Real-time</span>
                  </div>
                }
              >
                <div className="h-[220px] mt-2">
                  <StatsLineChart data={timeseries} dataKey="total_participants" color="var(--primary)" />
                </div>
              </AnalyticsCard>
            </div>

            {/* Live Sessions Monitor */}
            <div className="flex items-center justify-between mt-8 mb-4 px-1">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-1.5 h-6 bg-primary rounded-full" />
                  <div className="absolute inset-0 w-1.5 h-6 bg-primary rounded-full animate-ping opacity-30" />
                </div>
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Live Tracking Monitor</h2>
                <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                  <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Real-time</span>
                </div>
              </div>
              <Link href={`${basePath}/sessions`} className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1 bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/10">
                View All Sessions <ChevronRightIcon className="w-3 h-3" />
              </Link>
            </div>

            <Card variant="glass" className="overflow-hidden border-border/40 shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px] border-collapse">
                  <thead className="bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-widest border-b border-border/50">
                    <tr>
                      <th className="px-6 py-3 font-bold">Room Name</th>
                      <th className="px-6 py-3 font-bold text-right">Participants</th>
                      <th className="px-6 py-3 font-bold text-right">Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {liveSessions.filter(room => !currentProject || room.name.startsWith(`prj-${currentProject.id}-`)).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-2 opacity-40">
                            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                            <span className="text-xs font-medium">No active sessions at the moment</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      liveSessions
                        .filter(room => !currentProject || room.name.startsWith(`prj-${currentProject.id}-`))
                        .slice(0, 5)
                        .map((room) => (
                          <tr key={room.sid} className="group hover:bg-muted/20 transition-all duration-200 cursor-pointer" onClick={() => router.push(`${basePath}/sessions/${encodeURIComponent(currentProject ? room.name.slice(`prj-${currentProject.id}-`.length) : room.name)}`)}>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                                  {currentProject ? room.name.slice(`prj-${currentProject.id}-`.length) : room.name}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground opacity-50">{room.sid}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-bold text-foreground">{room.num_participants}</span>
                                <div className="flex -space-x-1.5">
                                  {[...Array(Math.min(3, room.num_participants))].map((_, i) => (
                                    <div key={i} className="w-5 h-5 rounded-full border border-background bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                                    </div>
                                  ))}
                                  {room.num_participants > 3 && (
                                    <div className="w-5 h-5 rounded-full border border-background bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">
                                      +{room.num_participants - 3}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] font-bold text-primary border border-primary/20">
                                <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                                LIVE
                              </span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Management Section (Redesigned) */}
            <div className="flex items-center gap-2 mt-10 mb-2">
              <div className="w-1.5 h-6 bg-success rounded-full" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Historical Performance</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <AnalyticsCard title="Agents Peak" className="relative group">
                <div className="grid grid-cols-1 gap-4 mt-2">
                  <div className="bg-surface/50 p-4 rounded-xl border border-border/40 group-hover:border-primary/30 transition-all">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2 flex items-center justify-between">
                      Active Agents
                    </div>
                    <div className="text-4xl font-black text-foreground mb-3">{dashboardData?.agents.concurrent || 0}</div>
                  </div>
                </div>
              </AnalyticsCard>

              <AnalyticsCard title="Telephony Bandwidth">
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <div className="bg-surface/50 p-3 rounded-xl border border-border/40 hover:bg-muted/10 transition-colors">
                    <div className="text-[9px] uppercase font-bold text-muted-foreground mb-1">Inbound</div>
                    <div className="text-2xl font-black text-success">{Math.round((dashboardData?.telephony.inbound || 0) / 60)}m</div>
                  </div>
                  <div className="bg-surface/50 p-3 rounded-xl border border-border/40 hover:bg-muted/10 transition-colors">
                    <div className="text-[9px] uppercase font-bold text-muted-foreground mb-1">Outbound</div>
                    <div className="text-2xl font-black text-primary">{Math.round((dashboardData?.telephony.outbound || 0) / 60)}m</div>
                  </div>
                </div>
              </AnalyticsCard>

              <AnalyticsCard title="Session Quality">
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="text-center p-2 rounded-lg hover:bg-muted/10 transition-colors">
                    <div className="text-xl font-black text-foreground">{dashboardData?.rooms.total_sessions || 0}</div>
                    <div className="text-[9px] uppercase font-bold text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center p-2 rounded-lg hover:bg-muted/10 transition-colors">
                    <div className="text-xl font-black text-foreground">{dashboardData?.rooms.avg_size || 0}</div>
                    <div className="text-[9px] uppercase font-bold text-muted-foreground">Avg Size</div>
                  </div>
                  <div className="text-center p-2 rounded-lg hover:bg-muted/10 transition-colors">
                    <div className="text-xl font-black text-foreground">{Math.round((dashboardData?.rooms.avg_duration || 0) / 60)}m</div>
                    <div className="text-[9px] uppercase font-bold text-muted-foreground">Avg Dur</div>
                  </div>
                </div>
              </AnalyticsCard>
            </div>

            {/* Links Section */}
            <div className="flex items-center gap-2 mt-6 mb-2">
              <div className="w-1.5 h-6 bg-muted-foreground rounded-full" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Quick Navigation</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {links.map((link) => (
                <Link
                  key={link.name}
                  href={`${basePath}${link.path}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border hover:bg-surface-hover transition-all text-left group"
                >
                  <span className="text-foreground text-sm group-hover:text-primary transition-colors">{link.name}</span>
                  <ChevronRightIcon className="text-muted-foreground w-4 h-4 group-hover:text-primary transition-all" />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
