"use client";

import React, { useEffect, useMemo, useState } from "react";
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";
import { DelayedLoader } from "../../../../components/ui/DelayedLoader";
import { Save, Trash2, ExternalLink, Copy, Check } from "lucide-react";
import {
  deleteProject,
  getProject,
  getProjects,
  updateProject,
} from "../../../../lib/api";

interface ProjectSettingsPageProps {
  projectId?: string;
}

export default function ProjectSettingsPage({ projectId }: ProjectSettingsPageProps) {
  const [apiProjectId, setApiProjectId] = useState<string | null>(null);
  const [displayProjectId, setDisplayProjectId] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => Boolean(apiProjectId && name.trim().length > 0), [apiProjectId, name]);

  useEffect(() => {
    let mounted = true;
    const resolveAndLoad = async () => {
      try {
        const projects = await getProjects();
        const stored = typeof window !== "undefined" ? localStorage.getItem("projectId") : null;
        const match =
          projects.find((x) => x.short_id === projectId || x.id === projectId) ||
          projects.find((x) => x.short_id === stored || x.id === stored) ||
          projects[0];

        if (!match || !mounted) {
          setError("No project found.");
          return;
        }

        setApiProjectId(match.id);
        setDisplayProjectId(match.short_id || match.id);

        if (typeof window !== "undefined") {
          localStorage.setItem("projectId", match.id);
          localStorage.setItem("projectName", match.name);
        }

        const full = await getProject(match.id);
        if (!mounted) return;
        setName(full.name || "");
        setDescription(full.description || "");
      } catch {
        if (!mounted) return;
        setError("Failed to load project settings.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    resolveAndLoad();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  const handleSave = async () => {
    if (!canSave || !apiProjectId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateProject(apiProjectId, name.trim(), description.trim() || undefined);
      setName(updated.name);
      setDescription(updated.description || "");
      if (typeof window !== "undefined") {
        localStorage.setItem("projectName", updated.name);
      }
      setMessage("Project settings saved.");
    } catch {
      setError("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!apiProjectId) return;
    const confirmText = `DELETE ${name}`;
    const userInput = window.prompt(`Type "${confirmText}" to delete this project permanently.`);
    if (userInput !== confirmText) return;

    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      await deleteProject(apiProjectId);
      if (typeof window !== "undefined") {
        localStorage.removeItem("projectId");
        localStorage.removeItem("projectName");
      }
      window.location.href = "/dashboard";
    } catch {
      setError("Failed to delete project.");
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyProjectId = async () => {
    if (!displayProjectId) return;
    await navigator.clipboard.writeText(displayProjectId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      {(loading || deleting) && <DelayedLoader />}
      <Header
        projectName={name || "Project"}
        pageName="Project"
        showTimeRange={false}
        actionButton={
          <Button size="sm" leftIcon={<Save className="w-4 h-4" />} onClick={handleSave} disabled={!canSave} isLoading={saving}>
            Save
          </Button>
        }
      />

      <div className="p-4 md:p-8 space-y-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Project Details</h2>
                <p className="text-sm text-muted-foreground">Update the name and description used across the dashboard.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Project name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-surface border border-border text-sm text-foreground focus:outline-none focus:border-primary/60"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground focus:outline-none focus:border-primary/60 resize-y"
                  placeholder="Describe this project"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Project ID</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={displayProjectId}
                    readOnly
                    className="flex-1 h-10 px-3 rounded-lg bg-muted border border-border text-xs font-mono text-muted-foreground"
                  />
                  <Button variant="outline" size="sm" onClick={handleCopyProjectId}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {message && <p className="text-sm text-green-600">{message}</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}
            </Card>

            <Card className="border-error/30">
              <h3 className="text-sm font-semibold text-foreground mb-2">Danger Zone</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Deleting a project removes its linked data and cannot be undone.
              </p>
              <Button variant="danger" size="sm" leftIcon={<Trash2 className="w-4 h-4" />} onClick={handleDelete} isLoading={deleting}>
                Delete Project
              </Button>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <h3 className="text-sm font-semibold text-foreground mb-3">Resources</h3>
              <div className="space-y-2 text-sm">
                <a href="https://docs.livekit.io/home/" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-foreground hover:text-primary">
                  <ExternalLink className="w-4 h-4" /> LiveKit docs
                </a>
                <a href="https://docs.livekit.io/home/self-hosting/" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-foreground hover:text-primary">
                  <ExternalLink className="w-4 h-4" /> Self-hosting guide
                </a>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
