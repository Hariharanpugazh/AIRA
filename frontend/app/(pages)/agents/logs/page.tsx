"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, Download, Trash2, Search, Pause, Play, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, getAccessToken } from "@/lib/api";

interface LogEntry {
  timestamp: string;
  level: "INFO" | "DEBUG" | "WARNING" | "ERROR";
  message: string;
  source?: string;
}

const levelColors: Record<string, string> = {
  INFO: "text-blue-400",
  DEBUG: "text-gray-400",
  WARNING: "text-yellow-400",
  ERROR: "text-red-400",
};

export default function AgentLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [instanceId, setInstanceId] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [lineCount, setLineCount] = useState(100);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    if (paused) return;

    try {
      if (!getAccessToken()) {
        setLogs([]);
        return;
      }

      let selectedInstanceId = instanceId;
      if (!selectedInstanceId) {
        const instances = await apiFetch<Array<{ instance_id: string }>>("/api/agent-instances");
        selectedInstanceId = instances?.[0]?.instance_id || "";
        if (!selectedInstanceId) {
          setLogs([]);
          return;
        }
        setInstanceId(selectedInstanceId);
      }

      const data = await apiFetch<Array<{ timestamp: string; log_level: string; message: string }>>(
        `/api/agent-instances/${encodeURIComponent(selectedInstanceId)}/logs?limit=${lineCount}`
      );
      const parsedLogs: LogEntry[] = (data || []).map((line) => ({
        timestamp: line.timestamp || new Date().toISOString(),
        level: (() => {
          const raw = String(line.log_level || "INFO").toUpperCase();
          if (raw === "WARN") return "WARNING";
          if (raw === "ERROR") return "ERROR";
          if (raw === "DEBUG") return "DEBUG";
          return "INFO";
        })(),
        message: line.message || "",
      }));

      setLogs(parsedLogs);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }, [instanceId, lineCount, paused]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [fetchLogs]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = levelFilter === "ALL" || log.level === levelFilter;
    const matchesSearch = !searchTerm ||
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.timestamp.includes(searchTerm);
    return matchesLevel && matchesSearch;
  });

  const downloadLogs = () => {
    const content = filteredLogs
      .map((log) => `[${log.timestamp}] ${log.level}: ${log.message}`)
      .join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-logs-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agent Logs</h1>
          <p className="text-muted-foreground mt-1">
            Real-time logs from the AI agent service
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaused(!paused)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              paused
                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                : "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
            )}
            title={paused ? "Resume" : "Pause"}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading || paused}
            className="p-2 rounded-lg bg-surface hover:bg-surface-hover transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
          <button
            onClick={downloadLogs}
            className="p-2 rounded-lg bg-surface hover:bg-surface-hover transition-colors"
            title="Download logs"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={clearLogs}
            className="p-2 rounded-lg bg-surface hover:bg-surface-hover transition-colors text-red-400"
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-surface rounded-lg border border-border">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search logs..."
            className="flex-1 bg-transparent border-none outline-none text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-background rounded px-3 py-1.5 text-sm border border-border"
          >
            <option value="ALL">All Levels</option>
            <option value="ERROR">Errors</option>
            <option value="WARNING">Warnings</option>
            <option value="INFO">Info</option>
            <option value="DEBUG">Debug</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Lines:</span>
          <select
            value={lineCount}
            onChange={(e) => setLineCount(Number(e.target.value))}
            className="bg-background rounded px-3 py-1.5 text-sm border border-border"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </div>

        <div className="text-sm text-muted-foreground">
          {filteredLogs.length} / {logs.length} entries
        </div>
      </div>

      {/* Log Viewer */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-[calc(100vh-320px)] min-h-[400px] overflow-auto bg-black rounded-lg border border-border font-mono text-sm"
      >
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No logs found
          </div>
        ) : (
          <div className="p-4 space-y-0.5">
            {filteredLogs.map((log, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-4 py-1 px-2 rounded hover:bg-white/10 group",
                  log.level === "ERROR" && "bg-red-500/5"
                )}
              >
                <span className="text-gray-500 shrink-0 w-[180px]">
                  {log.timestamp}
                </span>
                <span className={cn("shrink-0 w-[60px] font-medium", levelColors[log.level])}>
                  {log.level}
                </span>
                <span className="text-gray-300 break-all whitespace-pre-wrap">
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className={cn(
            "flex items-center gap-1.5",
            paused ? "text-yellow-400" : "text-green-400"
          )}>
            <span className={cn(
              "w-2 h-2 rounded-full",
              paused ? "bg-yellow-400" : "bg-green-400 animate-pulse"
            )} />
            {paused ? "Paused" : "Live"}
          </span>
          <span>Auto-scroll: {autoScroll ? "On" : "Off"}</span>
        </div>
        <span>Last updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
