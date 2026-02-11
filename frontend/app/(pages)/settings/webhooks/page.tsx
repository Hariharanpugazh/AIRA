"use client";

import React, { useState } from "react";
// DashboardLayout removed
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { Globe, Trash2, ExternalLink, Copy, Check } from "lucide-react";
import { getWebhooks, createWebhook, deleteWebhook, getApiKeys, Webhook, ApiKey } from "../../../../lib/api";

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    signingKey: "",
  });
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  React.useEffect(() => {
    loadWebhooks();
    getApiKeys().then(setApiKeys).catch(console.error);
  }, []);

  const loadWebhooks = async () => {
    try {
      setIsLoading(true);
      const data = await getWebhooks();
      setWebhooks(data);
    } catch (error) {
      console.error("Failed to load webhooks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!formData.name.trim() || !formData.url.trim()) {
      return;
    }

    try {
      await createWebhook(formData.url, ["room.started", "room.finished", "participant.joined", "participant.left"]);
      await loadWebhooks();
      setFormData({ name: "", url: "", signingKey: "" });
      setShowCreate(false);
    } catch (error) {
      alert("Failed to create webhook");
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (confirm("Are you sure you want to delete this webhook?")) {
      try {
        await deleteWebhook(id);
        await loadWebhooks();
      } catch (error) {
        alert("Failed to delete webhook");
      }
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <>
      <Header
        projectName="Default Project"
        pageName="Webhooks"
        showTimeRange={false}
        actionButton={
          <Button onClick={() => setShowCreate(true)}>Create new webhook</Button>
        }
      />

      <div className="p-4 md:p-8 animate-fade-in max-w-5xl">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-3">Webhooks</h2>
          <p className="text-muted-foreground leading-relaxed">
            LiveKit can be configured to notify your server when room events take place.
          </p>
        </div>

        {isLoading ? (
          <div className="py-20 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : webhooks.length === 0 ? (
          <div className="rounded-lg border border-border/40 bg-white dark:bg-surface/30 p-12 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-muted/20 flex items-center justify-center">
                <Globe className="w-8 h-8 text-muted-foreground" />
              </div>
            </div>
            <p className="text-muted-foreground mb-6">You don't have any webhooks added.</p>
            <Button onClick={() => setShowCreate(true)}>Create new webhook</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="rounded-lg border border-border/40 bg-white dark:bg-surface/30 p-5 hover:bg-gray-50 dark:hover:bg-surface/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      {webhook.name || "Untitled Webhook"}
                    </h3>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-100 dark:bg-muted/20 px-2 py-1 rounded text-foreground break-all flex-1">
                          {webhook.url}
                        </code>
                        <button
                          onClick={() => handleCopyUrl(webhook.url)}
                          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-muted/20 transition-colors"
                        >
                          {copiedUrl === webhook.url ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Events: {webhook.events.join(", ")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Created: {webhook.created_at}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteWebhook(webhook.id)}
                    className="p-2 rounded-lg text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-colors ml-4 flex-shrink-0"
                    title="Delete webhook"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={showCreate}
        onClose={() => {
          setShowCreate(false);
          setFormData({ name: "", url: "", signingKey: "" });
        }}
        title="New webhook endpoint"
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreate(false);
                setFormData({ name: "", url: "", signingKey: "" });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateWebhook}
              disabled={
                !formData.name.trim() ||
                !formData.url.trim()
              }
            >
              Create
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="My Webhook"
              autoFocus
              className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-muted/20 border border-border/60 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              URL
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) =>
                setFormData({ ...formData, url: e.target.value })
              }
              placeholder="https://my.domain/webhook"
              className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-muted/20 border border-border/60 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
