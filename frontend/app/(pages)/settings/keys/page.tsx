"use client";

import React, { useState } from "react";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { Search, Copy, Trash2, Check } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  owner: string;
  createdAt: string;
  isOwned: boolean;
}

const mockKeys: ApiKey[] = [
  {
    id: "1",
    name: "(none)",
    prefix: "API2NpTxw5u6BaS",
    owner: "Hariharan P",
    createdAt: "Feb 2, 2026",
    isOwned: true,
  },
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>(mockKeys);
  const [activeTab, setActiveTab] = useState<"own" | "other">("own");
  const [showCreate, setShowCreate] = useState(false);
  const [keyDescription, setKeyDescription] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const ownKeys = keys.filter((k) => k.isOwned);
  const otherKeys = keys.filter((k) => !k.isOwned);
  const displayKeys = activeTab === "own" ? ownKeys : otherKeys;

  const filteredKeys = displayKeys.filter(
    (k) =>
      k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.prefix.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.owner.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGenerateKey = () => {
    if (!keyDescription.trim()) return;

    const newKey: ApiKey = {
      id: Date.now().toString(),
      name: keyDescription,
      prefix: "SK" + Math.random().toString(36).substring(2, 15).toUpperCase(),
      owner: "Hariharan P",
      createdAt: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      isOwned: true,
    };

    setGeneratedKey("sk_live_" + Math.random().toString(36).substring(2, 32));
    setKeys([newKey, ...keys]);
  };

  const handleCopyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this API key?")) {
      setKeys(keys.filter((k) => k.id !== id));
    }
  };

  return (
    <DashboardLayout>
      <Header
        projectName="Default Project"
        pageName="Keys"
        showTimeRange={false}
        actionButton={
          <Button onClick={() => setShowCreate(true)}>Create key</Button>
        }
      />

      <div className="p-4 md:p-8 animate-fade-in max-w-5xl">
        {/* Section Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground mb-2">API keys</h2>
          <p className="text-muted-foreground">Manage project access keys.</p>
        </div>

        {/* Tabs and Search */}
        <div className="mb-6">
          <div className="flex items-center justify-between border-b border-border/40 mb-4">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab("own")}
                className={`pb-3 px-1 font-medium text-sm transition-colors ${
                  activeTab === "own"
                    ? "text-foreground border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Your API keys
              </button>
              <button
                onClick={() => setActiveTab("other")}
                className={`pb-3 px-1 font-medium text-sm transition-colors ${
                  activeTab === "other"
                    ? "text-foreground border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Other API keys
              </button>
            </div>
            <div className="relative hidden sm:block">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-lg bg-white dark:bg-muted/20 border border-border/40 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border/40 bg-white dark:bg-surface/30 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-gray-50 dark:bg-muted/20">
                <th className="text-left px-6 py-4 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  Description
                </th>
                <th className="text-left px-6 py-4 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  API Key
                </th>
                <th className="text-left px-6 py-4 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  Owner
                </th>
                <th className="text-left px-6 py-4 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  Issued On
                </th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="text-muted-foreground">
                      {activeTab === "own"
                        ? "No API keys yet. Create one to get started."
                        : "No other API keys to display."}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredKeys.map((key) => (
                  <tr
                    key={key.id}
                    className="hover:bg-gray-50 dark:hover:bg-muted/10 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-foreground font-medium">
                      {key.name}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">
                      {key.prefix}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">{key.owner}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {key.createdAt}
                    </td>
                    <td className="px-6 py-4">
                      {activeTab === "own" && (
                        <button
                          onClick={() => handleDelete(key.id)}
                          className="p-2 rounded-lg text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Delete API key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create API Key Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => {
          setShowCreate(false);
          setGeneratedKey(null);
          setKeyDescription("");
        }}
        title="Create new API key"
        footer={
          generatedKey ? (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreate(false);
                  setGeneratedKey(null);
                  setKeyDescription("");
                }}
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreate(false);
                  setKeyDescription("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerateKey}
                disabled={!keyDescription.trim()}
              >
                Generate key
              </Button>
            </div>
          )
        }
      >
        {!generatedKey ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add a description to your key. This will help you identify it later.
            </p>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Key description
              </label>
              <input
                type="text"
                value={keyDescription}
                onChange={(e) => setKeyDescription(e.target.value)}
                placeholder="Key for iOS client"
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  keyDescription.trim() &&
                  handleGenerateKey()
                }
                autoFocus
                className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-muted/20 border border-border/60 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-400 font-medium mb-3">
                API key created successfully
              </p>
              <p className="text-xs text-green-700 dark:text-green-500 mb-3">
                Copy this key now. You won't be able to see it again.
              </p>

              <div className="bg-white dark:bg-muted/20 rounded-lg p-3 font-mono text-xs text-foreground break-all border border-border/40 mb-3">
                {generatedKey}
              </div>

              <Button
                size="sm"
                variant={copied ? "ghost" : "outline"}
                onClick={handleCopyKey}
                className="w-full flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy to clipboard
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
