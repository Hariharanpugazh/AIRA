"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { SearchSmIcon } from "../../../components/icons";
import { Button } from "../../../../components/ui/Button";
import { getAccessToken, getApiKeys, createApiKey, deleteApiKey } from "../../../../lib/api";

export default function ApiKeysPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState<string>("");
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const token = getAccessToken();
      if (!token) {
        router.push("/login");
        return;
      }
      try {
        const [keysData] = await Promise.all([
          getApiKeys()
        ]);
        setKeys(keysData);
        setProjectName(localStorage.getItem("projectName") || "My Project");
      } catch (error) {

      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    try {
      const newKey = await createApiKey(newKeyName);
      setKeys([newKey, ...keys]);
      setNewKeySecret(newKey.secret_key || "");
      setNewKeyName("");
    } catch (error) {

    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this API key?")) return;
    try {
      await deleteApiKey(id);
      setKeys(keys.filter(k => k.id !== id));
    } catch (error) {

    }
  };

  if (loading) return null;

  return (
    <DashboardLayout>
      <Header projectName={projectName} pageName="Keys" showTimeRange={false}
        actionButton={
          <Button size="sm" onClick={() => setShowCreate(true)} variant="primary">
            Create key
          </Button>
        }
      />

      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-2">API keys</h1>
          <p className="text-secondary text-sm">Manage project access keys.</p>
        </div>


        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-medium text-foreground mb-4">Create API Key</h3>

              {!newKeySecret ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Key name (e.g. Production)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-foreground mb-4 focus:outline-none focus:border-primary"
                  />
                  <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={!newKeyName}>Create</Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-primary/10 border border-primary/20 text-primary p-3 rounded-lg mb-4 text-sm break-all font-mono">
                    {newKeySecret}
                  </div>
                  <p className="text-xs text-secondary mb-4">Copy this key now. You won't see it again.</p>
                  <Button className="w-full" onClick={() => { setShowCreate(false); setNewKeySecret(null); }}>Done</Button>
                </>
              )}
            </div>
          </div>
        )}


        <div className="rounded-lg bg-surface border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-secondary text-[11px] font-medium uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-secondary text-[11px] font-medium uppercase tracking-wider">Prefix</th>
                <th className="text-left px-4 py-3 text-secondary text-[11px] font-medium uppercase tracking-wider">Created</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-secondary">No API keys found</td></tr>
              ) : (
                keys.map(key => (
                  <tr key={key.id} className="border-b border-border last:border-0 hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 text-[13px] text-foreground font-medium">{key.name}</td>
                    <td className="px-4 py-3 text-[13px] font-mono text-secondary">{key.key_prefix}...</td>
                    <td className="px-4 py-3 text-secondary text-[13px]">{new Date(key.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(key.id)} className="text-red-500/70 hover:text-red-500 transition-colors p-1">
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
