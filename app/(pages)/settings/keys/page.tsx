"use client";

import React, { useEffect, useState } from "react";
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { Card } from "../../../../components/ui/Card";
import { DelayedLoader } from "../../../../components/ui/DelayedLoader";
import { Copy, Check, Info, ExternalLink } from "lucide-react";
import { getLiveKitEnvConfig, type LiveKitEnvConfig } from "../../../../lib/api";

interface ApiKeysPageProps {
  projectId?: string;
}

export default function ApiKeysPage({ projectId }: ApiKeysPageProps) {
  void projectId;

  const [isLoading, setIsLoading] = useState(true);
  const [showView, setShowView] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Project");
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<LiveKitEnvConfig | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getLiveKitEnvConfig();
        setConfig(data);
      } catch {
        setError("Failed to load LiveKit environment configuration.");
      } finally {
        setIsLoading(false);
      }

      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("projectName");
        if (stored) setProjectName(stored);
      }
    };
    run();
  }, []);

  const handleCopyField = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const renderField = (label: string, value: string, id: string) => (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="mt-2 flex items-center justify-between bg-muted/30 border border-border rounded-lg p-3">
        <code className="text-sm text-foreground break-all font-mono">{value}</code>
        <button
          onClick={() => handleCopyField(value, id)}
          className="ml-2 p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
        >
          {copiedField === id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {isLoading && <DelayedLoader />}
      <Header
        projectName={projectName}
        pageName="API Keys"
        showTimeRange={false}
        actionButton={<Button onClick={() => setShowView(true)} disabled={!config}>View API Key</Button>}
      />

      <div className="p-4 md:p-8 animate-fade-in">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-2">API Key</h2>
              <p className="text-muted-foreground">LiveKit API credentials loaded directly from server environment.</p>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-400 font-medium">
                    These credentials are required for backend integration with LiveKit.
                  </p>
                </div>

                {config && (
                  <div className="space-y-4">
                    {renderField("LiveKit URL", config.LIVEKIT_URL, "LIVEKIT_URL")}
                    {renderField("LiveKit API URL", config.LIVEKIT_API_URL, "LIVEKIT_API_URL")}
                    {renderField("LiveKit API Key", config.LIVEKIT_API_KEY, "LIVEKIT_API_KEY")}
                    {renderField("LiveKit API Secret", config.LIVEKIT_API_SECRET, "LIVEKIT_API_SECRET")}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-1 space-y-4">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Info className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">API Key Guide</h3>
              </div>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground leading-relaxed">
                  Your LiveKit API credentials configure backend authentication for real-time communications.
                </div>
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[12px] text-amber-700 dark:text-amber-400">
                  <strong>Security Note:</strong> Keep these credentials secret and secure.
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">API Certificate</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm border-b border-border/30 pb-2">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-mono font-medium text-green-600">{config?.status || "-"}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-border/30 pb-2">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="text-foreground">{config?.provider || "-"}</span>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider mb-4">Developer Resources</h3>
              <div className="space-y-3">
                <a
                  href="https://docs.livekit.io/home/server/generating-tokens/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between group p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ExternalLink className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground group-hover:text-primary">Authentication docs</span>
                  </div>
                </a>
                <a
                  href="https://docs.livekit.io/home/client/connect/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between group p-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ExternalLink className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground group-hover:text-primary">SDK Integration</span>
                  </div>
                </a>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showView}
        onClose={() => setShowView(false)}
        title="API Key Credentials"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowView(false)}>
              Close
            </Button>
          </div>
        }
      >
        {!config ? (
          <p className="text-sm text-muted-foreground">Configuration unavailable.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use these credentials to configure your backend services with LiveKit.
            </p>
            <div className="space-y-3">
              {renderField("LiveKit URL", config.LIVEKIT_URL, "modal-LIVEKIT_URL")}
              {renderField("LiveKit API URL", config.LIVEKIT_API_URL, "modal-LIVEKIT_API_URL")}
              {renderField("LiveKit API Key", config.LIVEKIT_API_KEY, "modal-LIVEKIT_API_KEY")}
              {renderField("LiveKit API Secret", config.LIVEKIT_API_SECRET, "modal-LIVEKIT_API_SECRET")}
            </div>
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[12px] text-amber-700 dark:text-amber-400">
              <strong>Security Note:</strong> Keep these credentials secret. Do not share them publicly.
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
