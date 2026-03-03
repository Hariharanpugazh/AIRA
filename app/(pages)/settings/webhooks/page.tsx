"use client";

import React, { useState } from "react";
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { Card } from "../../../../components/ui/Card";
import { DelayedLoader } from "../../../../components/ui/DelayedLoader";
import { Globe, Trash2, Copy, Check, ExternalLink } from "lucide-react";
import { Webhook, createWebhook, deleteWebhook, getWebhooks } from "../../../../lib/api";

interface WebhooksPageProps {
  projectId?: string;
}

export default function WebhooksPage({ projectId }: WebhooksPageProps) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({ name: "", url: "" });
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Project");
  const [error, setError] = useState<string | null>(null);

  const loadWebhooks = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getWebhooks(projectId);
      setWebhooks(data);
    } catch {
      setError("Failed to load webhooks.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    const run = async () => {
      await loadWebhooks();
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("projectName");
        if (stored) setProjectName(stored);
      }
    };
    run();
  }, [loadWebhooks]);

  const handleCreateWebhook = async () => {
    if (!formData.name.trim() || !formData.url.trim()) return;
    try {
      await createWebhook(
        formData.name.trim(),
        formData.url.trim(),
        ["room.started", "room.finished", "participant.joined", "participant.left"],
        projectId,
      );
      await loadWebhooks();
      setFormData({ name: "", url: "" });
      setShowCreate(false);
    } catch {
      setError("Failed to create webhook.");
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm("Delete this webhook endpoint?")) return;
    try {
      await deleteWebhook(id, projectId);
      await loadWebhooks();
    } catch {
      setError("Failed to delete webhook.");
    }
  };

  const handleCopyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 1200);
  };

  return (
    <>
      {isLoading && <DelayedLoader />}
      <Header
        projectName={projectName}
        pageName="Webhooks"
        showTimeRange={false}
        actionButton={<Button onClick={() => setShowCreate(true)}>Create Webhook</Button>}
      />

      <div className="p-4 md:p-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-0">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Endpoints</h2>
                <p className="text-sm text-muted-foreground">LiveKit events are posted to your configured webhook URLs.</p>
              </div>
              <div className="divide-y divide-border">
                {!isLoading && webhooks.length === 0 && (
                  <div className="px-6 py-10 text-center text-muted-foreground text-sm">No webhook endpoints configured.</div>
                )}
                {webhooks.map((webhook) => (
                  <div key={webhook.id} className="px-6 py-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">{webhook.name || "Webhook"}</div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-muted-foreground truncate">{webhook.url}</code>
                        <button onClick={() => handleCopyUrl(webhook.url)} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
                          {copiedUrl === webhook.url ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{webhook.events.length} event types</div>
                    </div>
                    <button
                      onClick={() => handleDeleteWebhook(webhook.id)}
                      className="self-start md:self-center p-2 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Event Types</h3>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>room.started</div>
                <div>room.finished</div>
                <div>participant.joined</div>
                <div>participant.left</div>
              </div>
            </Card>
            <Card>
              <h3 className="text-sm font-semibold text-foreground mb-2">References</h3>
              <a href="https://docs.livekit.io/home/server/webhooks/" target="_blank" rel="noreferrer" className="text-sm text-foreground hover:text-primary flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Webhook docs
              </a>
            </Card>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showCreate}
        onClose={() => {
          setShowCreate(false);
          setFormData({ name: "", url: "" });
        }}
        title="Create Webhook Endpoint"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreateWebhook} disabled={!formData.name.trim() || !formData.url.trim()}>
              Create
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Primary events endpoint"
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground focus:outline-none focus:border-primary/60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">URL</label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="https://example.com/livekit/webhook"
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground focus:outline-none focus:border-primary/60"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
