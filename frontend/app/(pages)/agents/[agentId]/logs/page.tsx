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
  info: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", icon: Info },
  warn: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20", icon: AlertTriangle },
  error: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", icon: AlertCircle },
  debug: { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/20", icon: FileText },
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
        level: log.log_level || log.level || "info",
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
    <div className="p-6 md:p-8 animate-fade-in max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-display font-medium text-foreground">Agent Logs</h2>
          <p className="text-sm text-muted-foreground">Runtime logs and debugging information</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Card variant="glass" className="overflow-hidden">

        <div className="p-4 border-b border-border flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-cyan-500/50"
              >
                <option value="all">All Levels</option>
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </div>
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search logs..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground ml-auto">
            {filteredLogs.length} log entries
          </div>
        </div>


        <div className="max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No logs found
            </div>
          ) : (
            <div className="divide-y divide-white/5 font-mono text-sm">
              {filteredLogs.map((log) => {
                const style = logLevelStyles[log.level];
                return (
                  <div key={log.id} className="p-3 hover:bg-white/5 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${style.bg} ${style.text} ${style.border} border`}
                      >
                        {log.level}
                      </span>
                      <span className="text-foreground flex-1 break-all">{log.message}</span>
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-2 ml-24 text-xs text-muted-foreground bg-muted p-2 rounded">
                        <pre className="overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
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


