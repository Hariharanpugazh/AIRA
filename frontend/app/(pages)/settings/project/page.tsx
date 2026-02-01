"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";
import { Save, Trash2 } from "lucide-react";
import { getAccessToken, getProject, updateProject, deleteProject, User, Project } from "../../../../lib/api";

export default function ProjectSettingsPage() {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const token = getAccessToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {


        const projectId = localStorage.getItem("projectId");
        if (projectId) {
          const projectData = await getProject(projectId);
          setProject(projectData);
          setName(projectData.name);
          setDescription(projectData.description || "");
        }
      } catch (error) {

        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleSave = async () => {
    if (!project) return;
    setSaving(true);
    setMessage(null);

    try {
      await updateProject(project.id, name, description);
      localStorage.setItem("projectName", name);
      setMessage({ type: "success", text: "Project updated successfully!" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to update project" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!project || !confirm("Are you sure you want to delete this project? This cannot be undone.")) return;

    try {
      await deleteProject(project.id);
      localStorage.removeItem("projectId");
      localStorage.removeItem("projectName");
      router.push("/dashboard");
    } catch (error) {
      setMessage({ type: "error", text: "Failed to delete project" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <Header
        projectName={project?.name || "RELATIM"}
        pageName="Project Settings"
        showTimeRange={false}
        actionButton={
          <Button size="sm" leftIcon={<Save className="w-4 h-4" />} onClick={handleSave} isLoading={saving}>
            Save Changes
          </Button>
        }
      />

      <div className="p-4 md:p-8 animate-fade-in max-w-2xl">
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === "success" ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
            {message.text}
          </div>
        )}

        <div className="space-y-6">

          <Card variant="glass" className="p-6">
            <h3 className="text-foreground font-semibold mb-4">General</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Project Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-surface border border-border text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-surface border border-border text-foreground"
                  rows={3}
                />
              </div>
            </div>
          </Card>


          <Card variant="glass" className="p-6">
            <h3 className="text-foreground font-semibold mb-4">Project Information</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Project ID</span>
                <code className="text-xs text-foreground bg-surface px-2 py-1 rounded">{project?.id}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Status</span>
                <span className="text-green-500 text-sm">{project?.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">Created</span>
                <span className="text-foreground text-sm">{project?.created_at ? new Date(project.created_at).toLocaleDateString() : "-"}</span>
              </div>
            </div>
          </Card>


          <Card variant="glass" className="p-6 border-red-500/20">
            <h3 className="text-red-500 font-semibold mb-2">Danger Zone</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Deleting this project will remove all data associated with it. This action cannot be undone.
            </p>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="w-4 h-4" />}
              onClick={handleDelete}
            >
              Delete Project
            </Button>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
