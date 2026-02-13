"use client";

import React, { useState, useEffect } from "react";
// DashboardLayout removed
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";
import { Save, Trash2, Info } from "lucide-react";
import { getProject, getProjects, updateProject } from "../../../../lib/api";

export default function ProjectSettingsPage() {
  const [apiProjectId, setApiProjectId] = useState<string | null>(null);
  const [displayProjectId, setDisplayProjectId] = useState<string>("");
  const [name, setName] = useState("Default Project");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [autoCreateName, setAutoCreateName] = useState(true);
  const [adminCanCreateCodec, setAdminCanCreateCodec] = useState(true);
  const [allowPendingUnverified, setAllowPendingUnverified] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [enabledCodecs, setEnabledCodecs] = useState({
    opus: true,
    aac: true,
    ulaw: true,
    vp8: false,
    art: false,
  });

  const handleSave = () => {
    if (!apiProjectId) return;
    setSaving(true);
    (async () => {
      try {
        const updated = await updateProject(apiProjectId, name, description);
        setName(updated.name);
        setDescription(updated.description || "");
      } catch (err) {
        console.error("Failed to save project", err);
      } finally {
        setSaving(false);
      }
    })();
  };

  useEffect(() => {
    // Resolve project id from localStorage (may be short_id or full id)
    (async () => {
      try {
        const stored = typeof window !== "undefined" ? localStorage.getItem("projectId") : null;

        // Fetch projects to map short_id -> id if needed
        const projects = await getProjects();

        let resolvedApiId: string | undefined;
        let displayId = "";

        if (stored) {
          const match = projects.find((x) => x.short_id === stored || x.id === stored);
          if (match) {
            resolvedApiId = match.id;
            displayId = match.short_id || match.id;
          }
        }

        if (!resolvedApiId && projects.length > 0) {
          resolvedApiId = projects[0].id;
          displayId = projects[0].short_id || projects[0].id;
        }

        if (resolvedApiId) {
          setApiProjectId(resolvedApiId);
          setDisplayProjectId(displayId);
          try {
            const p = await getProject(resolvedApiId);
            setName(p.name || "");
            setDescription(p.description || "");
          } catch (e) {
            console.warn("Failed to load project details", e);
          }
        }
      } catch (e) {
        console.warn("Failed to resolve project", e);
      }
    })();
  }, []);

  return (
    <>
      <Header
        projectName={name || "Project"}
        pageName="Project Settings"
        showTimeRange={false}
        actionButton={
          <Button size="sm" leftIcon={<Save className="w-4 h-4" />} onClick={handleSave} isLoading={saving}>
            Save Changes
          </Button>
        }
      />

      <div className="p-4 md:p-8 animate-fade-in max-w-4xl space-y-6">
        {/* General Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">General</h2>
          <Card className="p-6 bg-white dark:bg-surface/30 border-border/60">
            <p className="text-sm text-muted-foreground mb-6">
              Set the display name used across your self-hosted LiveKit admin dashboard and tooling.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-foreground mb-2">Project name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-white dark:bg-muted/20 border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-2">Project ID</label>
                <input
                  type="text"
                  value={displayProjectId}
                  disabled
                  className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-muted/20 border border-border text-sm text-muted-foreground cursor-not-allowed"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-foreground mb-2">Region or geographic distribution cloud</label>
              <input
                type="text"
                value="dataon-ohio-/single-region-cloud"
                disabled
                className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-muted/20 border border-border text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-foreground mb-2">SIP URI</label>
              <div className="relative">
                <input
                  type="text"
                  value={displayProjectId ? `sip://${displayProjectId}@your-sip-gateway` : ""}
                  disabled
                  className="w-full px-3 py-2 rounded-md bg-gray-100 dark:bg-muted/20 border border-border text-sm text-muted-foreground cursor-not-allowed pr-10"
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  📋
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Options Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Options</h2>
          <Card className="p-6 bg-white dark:bg-surface/30 border-border/60">
            <p className="text-sm text-muted-foreground mb-6">Configure options for your LiveKit Cloud project.</p>
            
            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Rooms and participants</h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCreateName}
                    onChange={(e) => setAutoCreateName(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-white dark:bg-muted/20"
                  />
                  <span className="text-sm text-muted-foreground">Automatically create rooms as participants join</span>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminCanCreateCodec}
                    onChange={(e) => setAdminCanCreateCodec(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-white dark:bg-muted/20"
                  />
                  <span className="text-sm text-muted-foreground">Admins can create rooms as participants join</span>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowPendingUnverified}
                    onChange={(e) => setAllowPendingUnverified(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-white dark:bg-muted/20"
                  />
                  <span className="text-sm text-muted-foreground">Allow pending unless other subscribers are unverified</span>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </label>
              </div>

              <div className="pt-4 border-t border-border/40">
                <h3 className="text-sm font-medium text-foreground mb-3">Dashboard</h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnboarding}
                    onChange={(e) => setShowOnboarding(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-white dark:bg-muted/20"
                  />
                  <span className="text-sm text-muted-foreground">Show onboarding instructions on dashboard</span>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </label>
              </div>
            </div>
          </Card>
        </div>

        {/* Data and privacy Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Data and privacy</h2>
          <Card className="p-6 bg-white dark:bg-surface/30 border-border/60">
            <p className="text-sm text-muted-foreground mb-6">Control data retention and access from reported sessions for debugging, available for premium plans.</p>
            <div>
              <label className="block text-xs font-medium text-foreground mb-2">Agent observability</label>
              <select className="w-full px-3 py-2 rounded-md bg-white dark:bg-muted/20 border border-border text-sm text-foreground focus:outline-none focus:border-primary/50">
                <option>Disabled</option>
                <option>Enabled</option>
              </select>
            </div>
          </Card>
        </div>

        {/* Enabled codecs Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Enabled codecs</h2>
          <Card className="p-6 bg-white dark:bg-surface/30 border-border/60">
            <p className="text-sm text-muted-foreground mb-6">Select which media codecs your project should allow.</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={enabledCodecs.opus}
                    onChange={(e) => setEnabledCodecs({...enabledCodecs, opus: e.target.checked})}
                    className="w-4 h-4 rounded border-border bg-white dark:bg-muted/20"
                  />
                  <span className="text-sm text-foreground">Opus</span>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={enabledCodecs.aac}
                    onChange={(e) => setEnabledCodecs({...enabledCodecs, aac: e.target.checked})}
                    className="w-4 h-4 rounded border-border bg-white dark:bg-muted/20"
                  />
                  <span className="text-sm text-foreground">AAC</span>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={enabledCodecs.ulaw}
                    onChange={(e) => setEnabledCodecs({...enabledCodecs, ulaw: e.target.checked})}
                    className="w-4 h-4 rounded border-border bg-white dark:bg-muted/20"
                  />
                  <span className="text-sm text-foreground">ULAW</span>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={enabledCodecs.vp8}
                    onChange={(e) => setEnabledCodecs({...enabledCodecs, vp8: e.target.checked})}
                    className="w-4 h-4 rounded border-border bg-white dark:bg-muted/20"
                  />
                  <span className="text-sm text-foreground">VP8</span>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={enabledCodecs.art}
                    onChange={(e) => setEnabledCodecs({...enabledCodecs, art: e.target.checked})}
                    className="w-4 h-4 rounded border-border bg-white dark:bg-muted/20"
                  />
                  <span className="text-sm text-foreground">AV1</span>
                </label>
              </div>
            </div>
          </Card>
        </div>

        {/* Connection Limits Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Connection limits</h2>
          <Card className="p-6 bg-white dark:bg-surface/30 border-border/60">
            <p className="text-sm text-muted-foreground mb-6">
              Self-hosted deployments do not enforce artificial product limits. Capacity depends only on your infrastructure sizing and LiveKit node resources.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left px-4 py-3 text-muted-foreground text-xs font-medium uppercase">TYPE</th>
                    <th className="text-left px-4 py-3 text-muted-foreground text-xs font-medium uppercase">LIMIT</th>
                    <th className="text-left px-4 py-3 text-muted-foreground text-xs font-medium uppercase">PEAK_USAGE (LAST 7 DAYS)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/40 hover:bg-gray-50 dark:hover:bg-muted/10">
                    <td className="px-4 py-3 text-foreground">Concurrent participants</td>
                    <td className="px-4 py-3 text-foreground">Unlimited (infra-bound)</td>
                    <td className="px-4 py-3 text-foreground">0</td>
                  </tr>
                  <tr className="border-b border-border/40 hover:bg-gray-50 dark:hover:bg-muted/10">
                    <td className="px-4 py-3 text-foreground">Concurrent room sessions</td>
                    <td className="px-4 py-3 text-foreground">Unlimited (infra-bound)</td>
                    <td className="px-4 py-3 text-foreground">0</td>
                  </tr>
                  <tr className="border-b border-border/40 hover:bg-gray-50 dark:hover:bg-muted/10">
                    <td className="px-4 py-3 text-foreground">Concurrent ingress requests</td>
                    <td className="px-4 py-3 text-foreground">Unlimited (infra-bound)</td>
                    <td className="px-4 py-3 text-foreground">0</td>
                  </tr>
                  <tr className="border-b border-border/40 hover:bg-gray-50 dark:hover:bg-muted/10">
                    <td className="px-4 py-3 text-foreground">Concurrent SIP sessions</td>
                    <td className="px-4 py-3 text-foreground">Unlimited (infra-bound)</td>
                    <td className="px-4 py-3 text-foreground">0</td>
                  </tr>
                  <tr className="border-b border-border/40 hover:bg-gray-50 dark:hover:bg-muted/10">
                    <td className="px-4 py-3 text-foreground">Concurrent TTS</td>
                    <td className="px-4 py-3 text-foreground">Unlimited (infra-bound)</td>
                    <td className="px-4 py-3 text-foreground">0</td>
                  </tr>
                  <tr className="border-b border-border/40 hover:bg-gray-50 dark:hover:bg-muted/10">
                    <td className="px-4 py-3 text-foreground">LLM Requests per minute</td>
                    <td className="px-4 py-3 text-foreground">Unlimited (infra-bound)</td>
                    <td className="px-4 py-3 text-foreground">0</td>
                  </tr>
                  <tr className="hover:bg-gray-50 dark:hover:bg-muted/10">
                    <td className="px-4 py-3 text-foreground">LLM tokens per minute</td>
                    <td className="px-4 py-3 text-foreground font-medium">Unlimited (infra-bound)</td>
                    <td className="px-4 py-3 text-foreground">0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Danger Zone Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-red-500">Danger zone</h2>
          <Card className="p-6 bg-red-50/50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20">
            <h3 className="font-semibold text-foreground mb-2">Delete project</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Deleting a project will remove all data associated with it and cannot be undone. Please be careful!
            </p>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Delete project
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}
