"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
// DashboardLayout removed (handled by app wrapper)
import Header from "../../components/Header";
import { StatsCard } from "../../../components/StatsCard";
import { Card } from "../../../components/ui/Card";
import { ChevronRightIcon } from "../../components/icons";
import { getAccessToken, getProjects, getAnalyticsDashboard, getAnalyticsTimeseries, Project, DashboardData, AnalyticsDataPoint } from "../../../lib/api";
import { AnalyticsCard } from "../../../components/AnalyticsCard";
import { StatsLineChart, PlatformDonutChart } from "../../../components/Charts";

export default function DashboardPage() {
  const router = useRouter();
  // Analytics State
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("24h");

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [timeseries, setTimeseries] = useState<AnalyticsDataPoint[]>([]);

  const loadData = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      // 1. Verify Auth First (Handled by global AuthContext now)

      // 2. Load Content
      const [dashData, timeseriesData, projectsData] = await Promise.allSettled([
        getAnalyticsDashboard(timeRange),
        getAnalyticsTimeseries(timeRange),
        getProjects(),
      ]);

      if (dashData.status === 'fulfilled') setDashboardData(dashData.value);
      if (timeseriesData.status === 'fulfilled') setTimeseries(timeseriesData.value);
      if (projectsData.status === 'fulfilled') {
        setProjects(projectsData.value);
        if (projectsData.value.length > 0 && !currentProject) {
          setCurrentProject(projectsData.value[0]);
          localStorage.setItem("projectId", projectsData.value[0].id);
          localStorage.setItem("projectName", projectsData.value[0].name);
        }
      }

    } catch (e) {

      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router, currentProject, timeRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const links = [
    { name: "Rooms", path: "/sessions" },
    { name: "Agents", path: "/agents" },
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
      <Header
        projectName={currentProject?.name || "Project"}
        pageName="Overview"
        onRefresh={loadData}
        onTimeRangeChange={setTimeRange}
      />

      <div className="space-y-6 animate-fade-in pb-8">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <StatsCard
                label="Connection Success"
                value={`${dashboardData?.overview.connection_success || 100}%`}
                subValue="Last 24h"
                chart={<div className="h-2 w-full bg-surface mt-2 rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${dashboardData?.overview.connection_success || 100}%` }} /></div>}
              />
              <StatsCard label="Active Rooms" value={String(timeseries[timeseries.length - 1]?.active_rooms || 0)} subValue="Real-time" />
              <StatsCard label="Participants" value={String(timeseries[timeseries.length - 1]?.total_participants || 0)} subValue="Connected" />
              <StatsCard label="Total Projects" value={String(projects.length)} subValue="Active" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <AnalyticsCard title="Platforms">
                <div className="h-[200px]">
                  <PlatformDonutChart data={[
                    { name: "Linux", value: dashboardData?.platforms.linux || 0 },
                    { name: "Windows", value: dashboardData?.platforms.windows || 0 },
                    { name: "Android", value: dashboardData?.platforms.android || 0 },
                    { name: "iOS", value: dashboardData?.platforms.ios || 0 },
                  ].some(d => d.value > 0) ? [
                    { name: "Linux", value: dashboardData?.platforms.linux || 0 },
                    { name: "Windows", value: dashboardData?.platforms.windows || 0 },
                    { name: "Android", value: dashboardData?.platforms.android || 0 },
                    { name: "iOS", value: dashboardData?.platforms.ios || 0 },
                  ] : [{ name: "No Data", value: 100 }]} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground text-center">
                  <div>Linux <span className="text-foreground block">{dashboardData?.platforms.linux || 0}%</span></div>
                  <div>Win <span className="text-foreground block">{dashboardData?.platforms.windows || 0}%</span></div>
                  <div>Mob <span className="text-foreground block">{(dashboardData?.platforms.android || 0) + (dashboardData?.platforms.ios || 0)}%</span></div>
                </div>
              </AnalyticsCard>

              <AnalyticsCard title="Connection Type">
                <div className="h-[200px] flex items-center justify-center">
                  <div className="relative w-32 h-32 rounded-full border-8 border-primary/20 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-primary font-bold text-xl">{dashboardData?.overview.connection_type.udp || 0}%</div>
                      <div className="text-[10px] text-muted-foreground">UDP</div>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-center text-xs text-muted-foreground">
                  TCP: <span className="text-foreground">{dashboardData?.overview.connection_type.tcp || 0}%</span>
                </div>
              </AnalyticsCard>

              <AnalyticsCard title="Top Countries">
                <div className="space-y-3 mt-2">
                  {(dashboardData?.overview.top_countries || []).map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">#{i + 1}</span>
                        <span className="text-foreground">{c.name}</span>
                      </div>
                      <span className="font-mono text-primary">{c.count}</span>
                    </div>
                  ))}
                  {(!dashboardData?.overview.top_countries || dashboardData?.overview.top_countries.length === 0) && (
                    <div className="text-muted-foreground text-xs text-center py-8">
                      No geolocation data available<br/>
                      <span className="text-[10px]">Requires client-side geolocation permissions and server-side IP geolocation service</span>
                    </div>
                  )}
                </div>
              </AnalyticsCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <AnalyticsCard title="Total Minutes" className="col-span-1">
                <div className="flex flex-col h-full justify-center">
                  <div className="text-4xl font-bold text-foreground mb-1">
                    {Math.round((dashboardData?.participants.total_minutes || 0) / 60)} <span className="text-lg text-muted-foreground font-normal">mins</span>
                  </div>
                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">WebRTC</span>
                      <span className="text-foreground">{Math.round((dashboardData?.participants.webrtc_minutes || 0) / 60)}m</span>
                    </div>
                    <div className="w-full bg-surface h-1 rounded-full overflow-hidden">
                      <div className="bg-primary h-full" style={{ width: `${((dashboardData?.participants.webrtc_minutes || 0) / (dashboardData?.participants.total_minutes || 1)) * 100}%` }} />
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Agents</span>
                      <span className="text-foreground">{Math.round((dashboardData?.participants.agent_minutes || 0) / 60)}m</span>
                    </div>
                    <div className="w-full bg-surface h-1 rounded-full overflow-hidden">
                      <div className="bg-accent h-full" style={{ width: `${((dashboardData?.participants.agent_minutes || 0) / (dashboardData?.participants.total_minutes || 1)) * 100}%` }} />
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">SIP</span>
                      <span className="text-foreground">{Math.round((dashboardData?.participants.sip_minutes || 0) / 60)}m</span>
                    </div>
                    <div className="w-full bg-surface h-1 rounded-full overflow-hidden">
                      <div className="bg-warning h-full" style={{ width: `${((dashboardData?.participants.sip_minutes || 0) / (dashboardData?.participants.total_minutes || 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </AnalyticsCard>

              <AnalyticsCard title="Connection Trends" className="col-span-3">
                <div className="h-[240px]">
                  <StatsLineChart data={timeseries} dataKey="total_participants" color="#6366f1" />
                </div>
              </AnalyticsCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <AnalyticsCard title="Agents">
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="bg-surface p-3 rounded-lg border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Session Minutes</div>
                    <div className="text-2xl font-bold text-foreground">{Math.round((dashboardData?.agents.session_minutes || 0) / 60)}m</div>
                  </div>
                  <div className="bg-surface p-3 rounded-lg border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Concurrent</div>
                    <div className="text-2xl font-bold text-foreground">{dashboardData?.agents.concurrent || 0}</div>
                  </div>
                </div>
              </AnalyticsCard>

              <AnalyticsCard title="Telephony">
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="bg-surface p-3 rounded-lg border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Inbound</div>
                    <div className="text-2xl font-bold text-foreground">{Math.round((dashboardData?.telephony.inbound || 0) / 60)}m</div>
                  </div>
                  <div className="bg-surface p-3 rounded-lg border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Outbound</div>
                    <div className="text-2xl font-bold text-foreground">{Math.round((dashboardData?.telephony.outbound || 0) / 60)}m</div>
                  </div>
                </div>
              </AnalyticsCard>

              <AnalyticsCard title="Rooms">
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="text-center">
                    <div className="text-xl font-bold text-foreground">{dashboardData?.rooms.total_sessions || 0}</div>
                    <div className="text-[10px] text-muted-foreground">Sessions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-foreground">{dashboardData?.rooms.avg_size || 0}</div>
                    <div className="text-[10px] text-muted-foreground">Avg Size</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-foreground">{Math.round((dashboardData?.rooms.avg_duration || 0) / 60)}m</div>
                    <div className="text-[10px] text-muted-foreground">Avg Dur</div>
                  </div>
                </div>
              </AnalyticsCard>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {links.map((link) => (
                <Link
                  key={link.name}
                  href={link.path}
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
