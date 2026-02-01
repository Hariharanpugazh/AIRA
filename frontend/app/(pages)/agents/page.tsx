"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/layouts/DashboardLayout";
import Header from "../../components/Header";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Plus, Bot, Trash2, Play, Pause, ChevronDown, Terminal, Globe, MoreVertical } from "lucide-react";
import { getAccessToken, getProjects, getAgents, createAgent, deleteAgent, updateAgent, User, Agent, Project, apiFetch } from "../../../lib/api";
import { AgentStatCard, AgentSessionsChart } from "../../../components/AgentsCharts";
import { useClickOutside } from "../../../hooks/useClickOutside";
import { DeployAgentModal } from "../../../components/modals/DeployAgentModal";

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
  const [showCreate, setShowCreate] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDesc, setNewAgentDesc] = useState("");
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
    if (!currentProject || !newAgentName.trim()) return;
    setCreating(true);
    try {
      const agent = await createAgent(currentProject.id, {
        name: newAgentName,
        description: newAgentDesc,
      });
      setAgents([agent, ...agents]);
      setNewAgentName("");
      setNewAgentDesc("");
      setShowCreate(false);
    } catch (error) {

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
  const activeSessions = agentStats.activeSessions;
  const sessionMinutes = `${agentStats.totalMinutes}/${agentStats.quotaMinutes.toLocaleString()}`;

  // Helper function to format relative time
  const formatDeployedTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Deployed today";
    if (diffDays === 1) return "Deployed yesterday";
    if (diffDays < 7) return `Deployed ${diffDays} days ago`;
    if (diffDays < 30) return `Deployed ${Math.floor(diffDays / 7)} weeks ago`;
    return `Deployed ${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <DashboardLayout>
      <Header
        projectName={currentProject?.name || "RELATIM"}
        pageName="Agents"
        showTimeRange={false}
        actionButton={
          <div className="relative" ref={dropdownRef}>
            <Button
              size="sm"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              rightIcon={<ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />}
              className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[160px]"
            >
              + Deploy new agent
            </Button>

            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-popover text-foreground rounded-lg border border-border shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                <button
                  onClick={() => { setShowCreate(true); setIsDropdownOpen(false); }}
                  className="w-full text-left p-4 hover:bg-surface-hover transition-colors flex items-start gap-3 group"
                >
                  <div className="mt-1 p-1.5 rounded bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-sm mb-0.5">Build agent in browser</div>
                    <div className="text-xs text-muted-foreground">Prototype agent ideas through prompts</div>
                  </div>
                </button>
                <div className="h-[1px] bg-border mx-2" />
                <button
                  onClick={() => { setShowDeploy(true); setIsDropdownOpen(false); }}
                  className="w-full text-left p-4 hover:bg-surface-hover transition-colors flex items-start gap-3 group"
                >
                  <div className="mt-1 p-1.5 rounded bg-surface text-muted-foreground group-hover:bg-surface-hover group-hover:text-foreground transition-colors">
                    <Terminal className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-sm mb-0.5">Deploy agent with code</div>
                    <div className="text-xs text-muted-foreground">Develop complex voice agent workflows</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        }
      />

      <div className="p-4 md:p-8 animate-fade-in space-y-8">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AgentStatCard title="Agents Deployed" value={deployedAgents.toString()} />
          <AgentStatCard title="Concurrent Agent Sessions" value={activeSessions.toString()} />
          <AgentStatCard title="Agent Session Minutes" value={sessionMinutes} subValue="mins" />
        </div>


        <div className="w-full">
          <h3 className="text-xl font-semibold mb-4 text-foreground">Overview</h3>
          <AgentSessionsChart />
        </div>


        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-foreground">Your agents</h3>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><div className="grid grid-cols-2 gap-0.5 w-3 h-3"><div className="bg-current rounded-[1px]" /><div className="bg-current rounded-[1px]" /><div className="bg-current rounded-[1px]" /><div className="bg-current rounded-[1px]" /></div></Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><div className="flex flex-col gap-0.5 w-3 h-3"><div className="bg-current h-[2px] w-full rounded-[1px]" /><div className="bg-current h-[2px] w-full rounded-[1px]" /><div className="bg-current h-[2px] w-full rounded-[1px]" /></div></Button>
            </div>
          </div>

          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-xl bg-surface/30">
              <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-muted-foreground font-medium mb-2">No agents yet</h2>
              <Button onClick={() => setShowCreate(true)} variant="outline" size="sm">
                Create your first agent
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {agents.map((agent) => (
                <Card key={agent.id} variant="glass" className="p-4 flex items-center justify-between group hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-surface border border-border">
                      <Bot className="w-6 h-6 text-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-semibold text-foreground text-lg">{agent.name}</h4>
                        <span className="text-xs font-mono text-muted-foreground bg-surface px-2 py-0.5 rounded border border-border">{agent.id.substring(0, 8)}...</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5 uppercase tracking-wider font-medium">
                          <div className={`w-1.5 h-1.5 rounded-sm ${agent.status === 'pending' ? 'bg-zinc-500' : 'bg-green-500'}`} />
                          {agent.status || 'PENDING'}
                        </span>
                        <span>{formatDeployedTime(agent.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 pr-4">
                    <div className="text-right hidden md:block">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Concurrent Sessions</div>
                      <div className="text-lg font-mono font-medium">0</div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>


        {showCreate && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <Card variant="glass" className="w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
              <h2 className="text-xl font-semibold text-foreground mb-4">Create New Agent</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Name</label>
                  <input
                    autoFocus
                    type="text"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-surface border border-border text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                    placeholder="My Voice Agent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Description</label>
                  <textarea
                    value={newAgentDesc}
                    onChange={(e) => setNewAgentDesc(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-surface border border-border text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                    placeholder="Agent description..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="ghost" className="flex-1" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleCreateAgent} isLoading={creating}>
                    Create Agent
                  </Button>
                </div>
              </div>
            </Card>
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

