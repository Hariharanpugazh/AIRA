"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/layouts/DashboardLayout";
import Header from "../../components/Header";
import { StatsCard } from "../../../components/StatsCard";
import { Card } from "../../../components/ui/Card";
import { ChevronRightIcon } from "../../components/icons";
import { getAccessToken, getMe, getLiveKitStats, getProjects, User, LiveKitStats, Project } from "../../../lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<LiveKitStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const token = getAccessToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const [userData, statsData, projectsData] = await Promise.all([
          getMe(),
          getLiveKitStats(),
          getProjects(),
        ]);

        setUser(userData);
        setStats(statsData);
        setProjects(projectsData);

        if (projectsData.length > 0) {
          setCurrentProject(projectsData[0]);
          localStorage.setItem("projectId", projectsData[0].id);
          localStorage.setItem("projectName", projectsData[0].name);
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-primary"></div>
      </div>
    );
  }

  const links = [
    { name: "Rooms", path: "/sessions" },
    { name: "Agents", path: "/agents" },
    { name: "Telephony", path: "/telephony" },
    { name: "Egress", path: "/egresses" },
    { name: "Ingress", path: "/ingresses" },
    { name: "Settings", path: "/settings/project" },
  ];

  return (
    <DashboardLayout user={user}>
      <Header projectName={currentProject?.name || "Project"} pageName="Overview" />

      <div className="space-y-6 animate-fade-in pb-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatsCard
            label="Status"
            value={stats?.status === "online" ? "Online" : "Offline"}
            subValue={stats?.status === "online" ? "All systems operational" : "Check connection"}
            chart={
              <div className="relative mt-2">
                <div className={`w-2 h-2 rounded-full ${stats?.status === "online" ? "bg-green-500" : "bg-red-500"}`} />
              </div>
            }
          />
          <StatsCard label="Active Rooms" value={String(stats?.active_rooms || 0)} subValue="Real-time" />
          <StatsCard label="Participants" value={String(stats?.total_participants || 0)} subValue="Connected" />
          <StatsCard label="Projects" value={String(projects.length)} subValue="Total" />
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {links.map((link) => (
            <button
              key={link.name}
              onClick={() => router.push(link.path)}
              className="flex items-center justify-between p-3 rounded-lg bg-surface/50 border border-white/5 hover:bg-white/10 transition-all text-left group"
            >
              <span className="text-foreground text-sm group-hover:text-primary transition-colors">{link.name}</span>
              <ChevronRightIcon className="text-muted-foreground w-4 h-4 group-hover:text-primary transition-all" />
            </button>
          ))}
        </div>

        {/* Projects */}
        {projects.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-foreground font-medium text-sm">Projects</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  variant="glass"
                  className="p-3 cursor-pointer hover:border-primary/30 transition-all"
                  onClick={() => {
                    setCurrentProject(project);
                    localStorage.setItem("projectId", project.id);
                    localStorage.setItem("projectName", project.name);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-foreground font-medium text-sm">{project.name}</h4>
                      <p className="text-muted-foreground text-xs">{project.description || "No description"}</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${project.id === currentProject?.id ? "bg-primary" : "bg-white/20"}`} />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
