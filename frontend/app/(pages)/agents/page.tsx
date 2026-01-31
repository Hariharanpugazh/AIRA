"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/layouts/DashboardLayout";
import Header from "../../components/Header";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Plus, Bot, Trash2, Play, Pause } from "lucide-react";
import { getAccessToken, getMe, getProjects, getAgents, createAgent, deleteAgent, updateAgent, User, Agent, Project } from "../../../lib/api";

export default function AgentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDesc, setNewAgentDesc] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const token = getAccessToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const [userData, projectsData] = await Promise.all([
          getMe(),
          getProjects(),
        ]);

        setUser(userData);
        setProjects(projectsData);

        const savedProjectId = localStorage.getItem("projectId");
        const project = projectsData.find((p: Project) => p.id === savedProjectId) || projectsData[0];

        if (project) {
          setCurrentProject(project);
          const agentsData = await getAgents(project.id);
          setAgents(agentsData);
        }
      } catch (error) {
        console.error("Failed to load agents:", error);
        router.push("/login");
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
      console.error("Failed to create agent:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!currentProject) return;
    try {
      await deleteAgent(currentProject.id, agentId);
      setAgents(agents.filter(a => a.id !== agentId));
    } catch (error) {
      console.error("Failed to delete agent:", error);
    }
  };

  const handleToggleStatus = async (agent: Agent) => {
    if (!currentProject) return;
    const newStatus = agent.status === "active" ? "paused" : "active";
    try {
      const updated = await updateAgent(currentProject.id, agent.id, { status: newStatus });
      setAgents(agents.map(a => a.id === agent.id ? updated : a));
    } catch (error) {
      console.error("Failed to update agent:", error);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout user={user}>
      <Header
        projectName={currentProject?.name || "RELATIM"}
        pageName="Agents"
        showTimeRange={false}
        actionButton={
          <Button
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowCreate(true)}
          >
            Create agent
          </Button>
        }
      />

      <div className="p-4 md:p-8 animate-fade-in">
        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card variant="glass" className="w-full max-w-md p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Create New Agent</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Name</label>
                  <input
                    type="text"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground"
                    placeholder="My Voice Agent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Description</label>
                  <textarea
                    value={newAgentDesc}
                    onChange={(e) => setNewAgentDesc(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground"
                    placeholder="Agent description..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleCreateAgent} isLoading={creating}>
                    Create
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Agents List */}
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full animate-pulse-slow" />
              <div className="w-20 h-20 rounded-2xl bg-surface border border-white/10 flex items-center justify-center mb-8 relative">
                <Bot className="w-10 h-10 text-primary" />
              </div>
            </div>
            <h2 className="text-foreground font-display text-2xl font-bold mb-3">No agents yet</h2>
            <p className="text-muted-foreground text-sm text-center max-w-md mb-8">
              Create your first agent to start building voice AI experiences.
            </p>
            <Button onClick={() => setShowCreate(true)} leftIcon={<Plus className="w-4 h-4" />}>
              Create agent
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <Card key={agent.id} variant="glass" className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleStatus(agent)}
                      className={`p-1.5 rounded-lg transition-colors ${agent.status === "active"
                        ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                        : "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
                        }`}
                    >
                      {agent.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDeleteAgent(agent.id)}
                      className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="text-foreground font-medium mb-1">{agent.name}</h3>
                <p className="text-muted-foreground text-sm mb-3">{agent.description || "No description"}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`px-2 py-1 rounded-full ${agent.status === "active" ? "bg-green-500/10 text-green-500" :
                    agent.status === "paused" ? "bg-yellow-500/10 text-yellow-500" :
                      "bg-white/5"
                    }`}>
                    {agent.status}
                  </span>
                  <span>{agent.model}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
