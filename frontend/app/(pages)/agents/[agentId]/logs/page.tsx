"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card } from "../../../../../components/ui/Card";
import { Button } from "../../../../../components/ui/Button";
import {
  RefreshCw,
  Download,
  Filter,
  AlertCircle,
  Info,
  AlertTriangle,
  FileText,
  Search,
} from "lucide-react";
import { apiFetch } from "../../../../../lib/api";

// Types
interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  metadata?: Record<string, any>;
}

// Log level colors
const logLevelStyles = {
  info: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-200", icon: Info },
  warn: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-200", icon: AlertTriangle },
  error: { bg: "bg-red-500/10", text: "text-red-600", border: "border-red-200", icon: AlertCircle },
  debug: { bg: "bg-slate-500/10", text: "text-slate-600", border: "border-slate-200", icon: FileText },
};

export default function AgentLogsPage() {
  const params = useParams();
  const agentId = Array.isArray(params.agentId) ? params.agentId[0] : params.agentId;

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter state
  const [logLevel, setLogLevel] = useState<string>("all");
  const [logSearch, setLogSearch] = useState("");

  const loadLogs = useCallback(async () => {
    try {
      const projectId = localStorage.getItem("projectId");
      if (!projectId) {
        setLogs([]);
        return;
      }

      const data = await apiFetch<LogEntry[]>(
        `/api/projects/${projectId}/agents/${agentId}/logs?limit=100`
      );
      // Transform backend response to frontend format
      const transformedLogs: LogEntry[] = (data || []).map((log: any, idx: number) => ({
        id: log.id?.toString() || `log-${idx}`,
        timestamp: log.timestamp || new Date().toISOString(),
        level: (() => {
          const raw = String(log.log_level || log.level || "info").toLowerCase();
          if (raw === "warning") return "warn";
          if (raw === "error") return "error";
          if (raw === "debug") return "debug";
          return "info";
        })(),
        message: log.message || log.details || JSON.stringify(log),
        metadata: log.metadata || (log.deployment_type ? { deployment_type: log.deployment_type } : undefined),
      }));
      setLogs(transformedLogs);
    } catch (err) {

      // Empty state - no logs available yet
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadLogs();
  };

  const handleExport = () => {
    const exportData = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([exportData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-${agentId}-logs.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((log) => {
    if (logLevel !== "all" && log.level !== logLevel) return false;
    if (logSearch && !log.message.toLowerCase().includes(logSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">Agent Logs</h2>
          <p className="text-muted-foreground text-[13px] mt-1">Runtime logs and debugging information</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="text-xs h-9 border-border/60 hover:bg-muted/50" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-9 border-border/60 hover:bg-muted/50" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Card className="border-border/60 shadow-sm bg-background/50 overflow-hidden flex flex-col h-[700px]">
        <div className="p-4 border-b border-border/60 bg-muted/20 flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                className="px-3 py-1.5 bg-background border border-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all font-medium"
              >
                <option value="all">All Levels</option>
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </div>
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search logs..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 bg-background border border-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
              />
            </div>
          </div>
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest ml-auto">
            {filteredLogs.length} entries
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
              <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <span className="text-[13px] font-medium tracking-tight">Streaming logs...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 opacity-60">
              <FileText className="w-12 h-12 text-muted-foreground stroke-[1]" />
              <div>
                <p className="text-sm font-bold text-foreground">No logs found</p>
                <p className="text-[12px] text-muted-foreground mt-1">Logs will appear here once the agent starts interacting.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/40 font-mono text-[13px]">
              {filteredLogs.map((log) => {
                const style = logLevelStyles[log.level];
                const Icon = style.icon;
                return (
                  <div key={log.id} className="p-3 hover:bg-muted/30 transition-colors group">
                    <div className="flex items-start gap-4">
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap tabular-nums mt-0.5 opacity-60">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[9px] uppercase font-bold border flex items-center gap-1.5 h-5",
                          style.bg, style.text, style.border
                        )}
                      >
                        <Icon className="w-2.5 h-2.5" />
                        {log.level}
                      </span>
                      <span className="text-foreground/90 flex-1 break-all leading-relaxed">{log.message}</span>
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-3 ml-24">
                        <pre className="text-[11px] text-muted-foreground bg-muted/40 p-4 rounded-xl border border-border/40 overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// Helper function for class merging since we don't have it imported here
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}



