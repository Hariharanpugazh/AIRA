"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/layouts/DashboardLayout";
import Header from "../../components/Header";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import Link from "next/link";
import { Plus, Bot, Trash2, Play, Pause, ChevronDown, Terminal, Globe, MoreVertical, ExternalLink, BookOpen, User as UserIcon, LifeBuoy, Check, Cloud, Code, ArrowRight, Activity, LayoutGrid } from "lucide-react";
import { getAccessToken, getProjects, getAgents, createAgent, deleteAgent, updateAgent, User, Agent, Project, apiFetch } from "../../../lib/api";
import { AgentStatCard, AgentSessionsChart } from "../../../components/AgentsCharts";
import { useClickOutside } from "../../../hooks/useClickOutside";
import { DeployAgentModal } from "../../../components/modals/DeployAgentModal";
import { cn } from "../../../lib/utils";

export default function AgentsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useClickOutside(dropdownRef as React.RefObject<HTMLElement>, () => setIsDropdownOpen(false));

  // Modal State
  const [showDeploy, setShowDeploy] = useState(false);
  const [creating, setCreating] = useState(false);

  // Agent stats state
  const [agentStats, setAgentStats] = useState({
    activeSessions: 0,
    totalMinutes: 0,
    quotaMinutes: 1000,
  });

  // Derive project URL (simplified for self-host)
  const projectUrl = typeof window !== 'undefined'
    ? window.location.protocol.replace('http', 'ws') + '//' + window.location.host
    : 'ws://localhost:7880';

  useEffect(() => {
    const loadData = async () => {
      const token = getAccessToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const [projectsData] = await Promise.all([
          getProjects(),
        ]);

        setProjects(projectsData);

        const savedProjectId = localStorage.getItem("projectId");
        const project = projectsData.find((p: Project) => p.id === savedProjectId) || projectsData[0];

        if (project) {
          setCurrentProject(project);
          const agentsData = await getAgents(project.id);
          setAgents(agentsData);

          // Fetch agent stats
          try {
            const statsResponse = await apiFetch<{ activeSessions: number; totalMinutes: number; quotaMinutes: number }>(
              `/api/projects/${project.id}/agents/stats`
            );
            setAgentStats(statsResponse);
          } catch (e) {
            console.warn("Agent stats endpoint not available yet");
          }
        }
      } catch (error) {

      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleCreateAgent = async () => {
    if (!currentProject) return;
    setCreating(true);
    try {
      const agent = await createAgent(currentProject.id, {
        name: "New Agent",
        description: "",
      });
      setAgents([agent, ...agents]);
      router.push(`/agents/${agent.id}/instructions`);
    } catch (error) {

    } finally {
      setCreating(false);
    }
  };

  const handleStartInBrowser = async () => {
    if (!currentProject) return;
    setCreating(true);
    try {
      // Create a new agent with a default name
      const agent = await createAgent(currentProject.id, {
        name: "New Agent",
        description: "",
      });
      setAgents([agent, ...agents]);
      // Immediately navigate to the builder
      router.push(`/agents/${agent.id}/instructions`);
    } catch (error) {
      console.error("Failed to create agent:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!currentProject) return;
    if (!confirm("Are you sure you want to delete this agent?")) return;
    try {
      await deleteAgent(currentProject.id, agentId);
      setAgents(agents.filter(a => a.id !== agentId));
    } catch (error) {

    }
  };

  const handleToggleStatus = async (agent: Agent) => {
    if (!currentProject) return;
    const newStatus = agent.status === "active" ? "paused" : "active";
    try {
      const updated = await updateAgent(currentProject.id, agent.id, { status: newStatus });
      setAgents(agents.map(a => a.id === agent.id ? updated : a));
    } catch (error) {

    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    );
  }

  // Calculate stats from state
  const deployedAgents = agents.length;
  // Use real count if available, otherwise 0
  const activeSessions = agentStats.activeSessions || 0;
  const sessionMinutes = agentStats.totalMinutes || 0;

  // Helper function to format relative time
  const formatDeployedTime = (dateString: string) => {
    if (!dateString) return "Deployed —";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Deployed today";
    if (diffDays === 1) return "Deployed yesterday";
    if (diffDays < 7) return `Deployed ${diffDays} days ago`;
    return `Deployed ${new Date(dateString).toLocaleDateString()}`;
  };

  return (
    <DashboardLayout>
      <Header
        projectName={currentProject?.name || "Relatim"}
        pageName="Agents"
        showTimeRange={false}
        actionButton={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 px-3 text-[13px] font-medium text-muted-foreground border-border/60 hover:bg-muted flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Auto-refresh off
                <ChevronDown className="w-3.5 h-3.5" />
            </Button>
            <div className="relative" ref={dropdownRef}>
                <Button
                size="sm"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="bg-primary hover:bg-primary/90 text-white font-bold h-9 px-4 rounded-lg flex items-center gap-2 shadow-sm"
                >
                <Plus className="w-4 h-4" />
                Deploy new agent
                <ChevronDown className={cn("w-4 h-4 transition-transform", isDropdownOpen && "rotate-180")} />
                </Button>

                {isDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-border/40 rounded-xl shadow-2xl z-[100] p-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                    onClick={handleStartInBrowser}
                    disabled={creating}
                    className="w-full text-left p-2.5 hover:bg-muted/50 rounded-lg transition-all flex items-start gap-3 group disabled:opacity-60"
                    >
                    <div className="mt-0.5 p-1.5 rounded-lg bg-primary/5 text-primary">
                        <Cloud className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <div className="font-bold text-[12px] text-foreground">Build agent in browser</div>
                        <div className="text-[10px] text-muted-foreground">Prototype agent ideas through prompts</div>
                    </div>
                    </button>
                    <button
                    onClick={() => { setShowDeploy(true); setIsDropdownOpen(false); }}
                    className="w-full text-left p-2.5 hover:bg-muted/50 rounded-lg transition-all flex items-start gap-3 group"
                    >
                    <div className="mt-0.5 p-1.5 rounded-lg bg-muted text-muted-foreground group-hover:bg-muted group-hover:text-foreground">
                        <Code className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <div className="font-bold text-[12px] text-foreground">Deploy agent with code</div>
                        <div className="text-[10px] text-muted-foreground">Develop complex voice agent workflows</div>
                    </div>
                    </button>
                </div>
                )}
            </div>
          </div>
        }
      />

      <div className="flex-1 flex flex-col p-6 space-y-10 max-w-[1400px] mx-auto w-full animate-fade-in transition-all">
        {agents.length > 0 && (
          <>
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 bg-card border-border/40 shadow-sm flex flex-col justify-between min-h-[140px]">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">Agents Deployed</span>
                        <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 flex items-center justify-center text-[8px] text-muted-foreground shrink-0">i</div>
                    </div>
                    <div className="text-3xl font-bold text-foreground tracking-tight">{deployedAgents}</div>
                </Card>
                <Card className="p-6 bg-card border-border/40 shadow-sm flex flex-col justify-between min-h-[140px]">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">Concurrent Agent Sessions</span>
                        <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 flex items-center justify-center text-[8px] text-muted-foreground shrink-0">i</div>
                    </div>
                    <div className="text-3xl font-bold text-foreground tracking-tight">{activeSessions}</div>
                </Card>
                <Card className="p-6 bg-card border-border/40 shadow-sm flex flex-col justify-between min-h-[140px]">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 whitespace-nowrap overflow-hidden text-ellipsis">Agent Session Minutes This Billing Pe...</span>
                        <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 flex items-center justify-center text-[8px] text-muted-foreground shrink-0">i</div>
                    </div>
                    <div className="text-3xl font-bold text-foreground tracking-tight">{sessionMinutes} <span className="text-sm font-medium text-muted-foreground ml-1">sec</span></div>
                </Card>
            </div>

            {/* Overview Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold tracking-tight text-foreground">Overview</h3>
                <Button variant="outline" size="sm" className="h-8 px-3 text-[11px] font-bold border-border/40 bg-card text-muted-foreground flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" />
                    Past 7 days
                    <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </div>
              <AgentSessionsChart />
            </div>

            {/* Your Agents Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold tracking-tight text-foreground">Your agents</h3>
                <div className="flex items-center p-1 bg-muted/20 rounded-lg border border-border/40">
                   <button className="p-1 px-2 rounded-md bg-card shadow-sm border border-border/20 text-primary">
                      <LayoutGrid className="w-4 h-4" />
                   </button>
                   <button className="p-1 px-2 rounded-md text-muted-foreground/60 hover:text-foreground transition-colors">
                      <MoreVertical className="w-4 h-4 rotate-90" />
                   </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map((agent) => (
                  <Link key={agent.id} href={`/agents/${agent.id}/instructions`}>
                    <Card className="p-0 overflow-hidden group hover:border-primary/40 hover:shadow-[0_12px_30px_rgba(79,70,229,0.06)] transition-all cursor-pointer bg-card border-border/40 min-h-[220px] flex flex-col">
                      <div className="p-5 flex-1 relative">
                        <div className="flex items-start justify-between gap-4 mb-6">
                          <div className="flex items-center gap-3 min-w-0">
                            <h4 className="font-bold text-[15px] tracking-tight text-foreground group-hover:text-primary transition-colors truncate">
                                {agent.name}
                            </h4>
                            <div className="flex items-center gap-1.5 p-1 rounded-md bg-primary/5 text-primary">
                                <Cloud className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground/40 tracking-tight truncate shrink-0">{agent.id.slice(0, 12)}</span>
                          </div>
                          <button className="p-1 hover:bg-muted rounded-md transition-colors text-muted-foreground/60 shrink-0">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="space-y-1.5">
                           <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">CONCURRENT SESSIONS</div>
                           <div className="text-xl font-mono text-foreground font-medium">0</div>
                        </div>
                      </div>

                      <div className="px-5 py-3 bg-muted/5 border-t border-border/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className={cn("w-1.5 h-1.5 rounded-full", agent.status === 'active' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-slate-400")} />
                           <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">{agent.status || 'PENDING'}</span>
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground/40">{formatDeployedTime(agent.created_at)}</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {agents.length === 0 && (
          <div className="w-full space-y-16 py-10">
            {/* Hero Section */}
            <div className="text-center space-y-5">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-2 text-primary">
                <Bot className="w-8 h-8" />
              </div>
              <h2 className="text-4xl font-black tracking-tight text-foreground">Agents</h2>
              <p className="text-muted-foreground max-w-[500px] mx-auto text-[15px] leading-relaxed font-medium">
                Build and deploy AI-powered voice agents that can talk, listen, and reason in real-time.
              </p>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-[850px] mx-auto">
              {/* Card 1: Browser */}
              <button 
                onClick={handleStartInBrowser}
                disabled={creating}
                className="group flex flex-col text-left bg-card border border-border/60 rounded-[32px] overflow-hidden hover:border-primary/40 hover:shadow-[0_20px_50px_rgba(79,70,229,0.1)] transition-all duration-500 disabled:opacity-60"
              >
                <div className="p-8 bg-muted aspect-[16/10] flex items-center justify-center border-b border-border/40 relative overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                   <div className="w-full h-full p-4 flex flex-col gap-3 opacity-60 group-hover:opacity-100 transition-opacity duration-500 relative z-10">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-card shadow-sm border border-border/50 flex items-center justify-center">
                            <Cloud className="w-4 h-4 text-primary" />
                        </div>
                        <div className="w-24 h-2 bg-foreground/10 rounded-full" />
                      </div>
                      <div className="w-full h-4 bg-foreground/5 rounded-md" />
                      <div className="w-3/4 h-4 bg-foreground/5 rounded-md" />
                      <div className="mt-auto w-full flex justify-center pb-6">
                        <div className="flex items-end gap-1.5 h-12">
                           {[0.4, 0.6, 0.9, 0.5, 0.8, 1, 0.6, 0.4].map((h, i) => (
                             <div 
                                key={i} 
                                className="w-1.5 bg-primary/80 rounded-full animate-wave" 
                                style={{ 
                                    height: `${h * 100}%`,
                                    animationDelay: `${i * 0.1}s` 
                                }} 
                             />
                           ))}
                        </div>
                      </div>
                   </div>
                </div>
                <div className="p-8 space-y-3 bg-card">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-xl tracking-tight text-foreground">Start in the browser</h3>
                  </div>
                  <p className="text-[14px] text-muted-foreground leading-relaxed font-medium">
                    The fastest way to build agents. Use our browser-based editor to configure prompts, voices, and tools.
                  </p>
                </div>
              </button>

              {/* Card 2: Code */}
              <button 
                onClick={() => setShowDeploy(true)}
                className="group flex flex-col text-left bg-card border border-border/60 rounded-[32px] overflow-hidden hover:border-primary/40 hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] transition-all duration-500"
              >
                <div className="p-8 bg-muted aspect-[16/10] flex items-center justify-center border-b border-border/40 relative overflow-hidden">
                   <div className="w-full h-full p-6 flex flex-col gap-3 opacity-60 group-hover:opacity-100 transition-opacity duration-500 relative z-10">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-card shadow-sm border border-border/50 flex items-center justify-center">
                            <Code className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div className="w-32 h-2 bg-foreground/10 rounded-full" />
                      </div>
                      <div className="space-y-2">
                        <div className="w-full h-2 bg-foreground/5 rounded-full" />
                        <div className="w-2/3 h-2 bg-foreground/5 rounded-full" />
                        <div className="w-4/5 h-2 bg-foreground/5 rounded-full" />
                      </div>
                      <div className="mt-auto p-3 bg-slate-950 rounded-xl font-mono text-[10px] text-green-400 border border-white/10 shadow-xl translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                         <span className="text-blue-400">lk</span> agent create <span className="text-gray-500">--template</span>
                      </div>
                   </div>
                </div>
                <div className="p-8 space-y-3 bg-card">
                   <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-xl tracking-tight text-foreground">Start in code</h3>
                  </div>
                  <p className="text-[14px] text-muted-foreground leading-relaxed font-medium">
                    Develop complex agent logic in Python or TypeScript using our SDK and deploy directly from your CLI.
                  </p>
                </div>
              </button>
            </div>

            {/* Help/Docs Link */}
            <div className="text-center">
                <Link href="#" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                    <BookOpen className="w-4 h-4" />
                    Read the agents documentation
                    <ExternalLink className="w-3 h-3" />
                </Link>
            </div>
          </div>
        )}


        <DeployAgentModal
          isOpen={showDeploy}
          onClose={() => setShowDeploy(false)}
          projectUrl={projectUrl}
        />
      </div>
    </DashboardLayout>
  );
}

