"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { getAccessToken, User, getWebhooks, createWebhook, deleteWebhook, Webhook } from "../../../../lib/api";
import { Trash2, Plus, Globe } from "lucide-react";

export default function WebhooksPage() {
  const router = useRouter();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState("");

  useEffect(() => {
    const loadData = async () => {
      if (!getAccessToken()) { router.push("/login"); return; }
      try {
        const [w] = await Promise.all([getWebhooks()]);
        setWebhooks(w);
      } catch (e) {

      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  const handleCreate = async () => {
    if (!newUrl) return;
    try {
      const wh = await createWebhook(newUrl, ["all"]);
      setWebhooks([wh, ...webhooks]);
      setNewUrl("");
      setShowCreate(false);
    } catch (e) {

    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete webhook?")) return;
    try {
      await deleteWebhook(id);
      setWebhooks(webhooks.filter(w => w.id !== id));
    } catch (e) {

    }
  };

  if (loading) return null;

  return (
    <DashboardLayout>
      <Header projectName="RELATIM" pageName="Webhooks"
        actionButton={
          <Button size="sm" onClick={() => setShowCreate(true)} leftIcon={<Plus className="w-4 h-4" />}>
            Add webhook
          </Button>
        }
      />
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-xl font-semibold mb-6">Webhooks</h1>

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-medium text-foreground mb-4">Add Webhook</h3>
              <input
                autoFocus
                type="url"
                placeholder="https://your-api.com/webhook"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-foreground mb-4 focus:outline-none focus:border-primary"
              />
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!newUrl}>Add</Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {webhooks.length === 0 ? (
            <div className="text-center p-12 bg-surface/50 rounded-lg border border-border">
              <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No webhooks configured</p>
            </div>
          ) : (
            webhooks.map(w => (
              <div key={w.id} className="flex items-center justify-between p-4 bg-surface rounded-lg border border-border">
                <div>
                  <div className="font-mono text-sm text-foreground">{w.url}</div>
                  <div className="text-xs text-muted-foreground mt-1">Secret: {w.secret?.substring(0, 10)}...</div>
                </div>
                <button onClick={() => handleDelete(w.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
