"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "../../../components/Header";
import { Card } from "../../../../components/ui/Card";
import { getAccessToken, getSipTrunks, SipTrunk, getCallLogs, createOutboundCall, endCall, CallLog } from "../../../../lib/api";
import { Phone, PhoneOutgoing, Clock, AlertTriangle, Activity, Search, Filter, ChevronDown, ChevronUp, X, Copy, Check, ArrowUpRight, ArrowDownLeft, PhoneOff, BarChart3, Zap } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { DelayedLoader } from "../../../../components/ui/DelayedLoader";
import { cn } from "../../../../lib/utils";

interface CallsPageProps {
  projectId?: string;
}

export default function CallsPage({ projectId }: CallsPageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState<string>("Default Project");

  // Outbound call state
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [trunks, setTrunks] = useState<SipTrunk[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [filteredCalls, setFilteredCalls] = useState<CallLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callForm, setCallForm] = useState({
    trunkId: "",
    toNumber: "",
    roomName: "",
    participantIdentity: "",
  });

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [timeRange, setTimeRange] = useState("24h");
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"started_at" | "ended_at" | "duration">("started_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calculate time range in hours for API query
  const getTimeRangeHours = useCallback((range: string): number => {
    switch (range) {
      case "1h": return 1;
      case "3h": return 3;
      case "6h": return 6;
      case "12h": return 12;
      case "24h": return 24;
      case "7d": return 168;
      case "30d": return 720;
      case "60d": return 1440;
      default: return 24;
    }
  }, []);

  // Filter calls based on time range
  const filterByTimeRange = useCallback((callsData: CallLog[], range: string): CallLog[] => {
    const hours = getTimeRangeHours(range);
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return callsData.filter(call => new Date(call.started_at) >= cutoff);
  }, [getTimeRangeHours]);

  // Load data
  const loadData = useCallback(async (showLoader = true) => {
    const token = getAccessToken();
    if (!token) {
      router.push("/login");
      return;
    }

    if (showLoader) setRefreshing(true);

    try {
      const scopedProjectId = projectId || localStorage.getItem("projectId") || undefined;
      setProjectName(localStorage.getItem("projectName") || "Default Project");

      const [trunksData, callsData] = await Promise.all([
        getSipTrunks(scopedProjectId),
        getCallLogs(200, scopedProjectId),
      ]);
      setTrunks(trunksData || []);
      setCalls(callsData || []);
      if (trunksData?.length > 0 && !callForm.trunkId) {
        setCallForm(prev => ({ ...prev, trunkId: trunksData[0].id }));
      }
    } catch (e) {
      const token = getAccessToken();
      if (!token) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, projectId, callForm.trunkId]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Apply filters and search
  useEffect(() => {
    let result = [...calls];

    // Time range filter
    result = filterByTimeRange(result, timeRange);

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(call =>
        call.call_id?.toLowerCase().includes(q) ||
        call.from_number?.toLowerCase().includes(q) ||
        call.to_number?.toLowerCase().includes(q) ||
        call.id?.toLowerCase().includes(q) ||
        call.room_name?.toLowerCase().includes(q) ||
        call.participant_identity?.toLowerCase().includes(q) ||
        call.status?.toLowerCase().includes(q)
      );
    }

    // Direction filter
    if (directionFilter !== "all") {
      result = result.filter(call => call.direction === directionFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(call => call.status.toLowerCase() === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortField) {
        case "started_at":
          aVal = new Date(a.started_at).getTime();
          bVal = new Date(b.started_at).getTime();
          break;
        case "ended_at":
          aVal = a.ended_at ? new Date(a.ended_at).getTime() : 0;
          bVal = b.ended_at ? new Date(b.ended_at).getTime() : 0;
          break;
        case "duration":
          aVal = a.duration_seconds || 0;
          bVal = b.duration_seconds || 0;
          break;
        default:
          aVal = new Date(a.started_at).getTime();
          bVal = new Date(b.started_at).getTime();
      }
      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });

    setFilteredCalls(result);
  }, [calls, searchQuery, directionFilter, statusFilter, timeRange, sortField, sortDirection, filterByTimeRange]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }

    if (autoRefreshInterval > 0) {
      autoRefreshRef.current = setInterval(() => {
        loadData(false);
      }, autoRefreshInterval);
    }

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [autoRefreshInterval, loadData]);

  const handleRefresh = async () => {
    await loadData(true);
  };

  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range);
  };

  const handleAutoRefreshChange = (interval: number) => {
    setAutoRefreshInterval(interval);
  };

  const handleMakeCall = async () => {
    if (!callForm.toNumber || !callForm.trunkId) {
      alert("Please fill in all required fields");
      return;
    }

    setCalling(true);
    try {
      const scopedProjectId = projectId || localStorage.getItem("projectId") || undefined;
      await createOutboundCall({
        trunk_id: callForm.trunkId,
        to_number: callForm.toNumber,
        room_name: callForm.roomName || undefined,
        participant_identity: callForm.participantIdentity || undefined,
      }, scopedProjectId);
      setIsCallModalOpen(false);
      setCallForm({ trunkId: trunks[0]?.id || "", toNumber: "", roomName: "", participantIdentity: "" });
      await loadData(false);
    } catch (e) {
      alert("Failed to make call: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setCalling(false);
    }
  };

  const handleEndCall = async (callId: string) => {
    if (!confirm("End this call?")) return;
    try {
      const scopedProjectId = projectId || localStorage.getItem("projectId") || undefined;
      await endCall(callId, scopedProjectId);
      await loadData(false);
    } catch (e) {
      // silently ignore
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSort = (field: "started_at" | "ended_at" | "duration") => {
    if (sortField === field) {
      setSortDirection(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds === 0) return "—";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
    if (mins > 0) return `${mins}m ${secs.toString().padStart(2, "0")}s`;
    return `${secs}s`;
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  // Compute stats from filtered data
  const timeFilteredCalls = filterByTimeRange(calls, timeRange);
  const totalCalls = timeFilteredCalls.length;
  const totalCallDuration = timeFilteredCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
  const avgDurationSeconds = totalCalls > 0 ? Math.round(totalCallDuration / totalCalls) : 0;
  const activeCalls = timeFilteredCalls.filter(c => c.status === "active" || c.status === "ringing");
  const callsWithIssues = timeFilteredCalls.filter((c) => {
    const status = c.status.toLowerCase();
    return status === "failed" || status === "error" || status === "busy" || status === "no_answer";
  }).length;

  // Get unique statuses for filter dropdown
  const uniqueStatuses = [...new Set(calls.map(c => c.status.toLowerCase()))];

  const getStatusBadgeStyles = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case "active":
        return "bg-emerald-500/15 text-emerald-500 border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400";
      case "ringing":
        return "bg-amber-500/15 text-amber-600 border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400";
      case "ended":
      case "finished":
      case "completed":
        return "bg-slate-500/10 text-slate-500 border-slate-500/20 dark:bg-slate-400/10 dark:text-slate-400";
      case "failed":
      case "error":
        return "bg-red-500/15 text-red-500 border-red-500/25 dark:bg-red-500/10 dark:text-red-400";
      case "busy":
      case "no_answer":
        return "bg-orange-500/15 text-orange-500 border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-400";
      case "cancelled":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20 dark:bg-rose-400/10 dark:text-rose-400";
      default:
        return "bg-muted text-muted-foreground border-border/50";
    }
  };

  const getStatusDot = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case "active": return "bg-emerald-500";
      case "ringing": return "bg-amber-500 animate-pulse";
      case "ended": case "finished": case "completed": return "bg-slate-400";
      case "failed": case "error": return "bg-red-500";
      default: return "bg-slate-400";
    }
  };

  return (
    <>
      {(loading || calling) && <DelayedLoader />}
      <Header
        projectName={projectName}
        sectionName="Telephony"
        pageName="Calls"
        showTimeRange={true}
        onRefresh={handleRefresh}
        onTimeRangeChange={handleTimeRangeChange}
        onAutoRefreshChange={handleAutoRefreshChange}
        actionButton={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setIsCallModalOpen(true)}>
              <PhoneOutgoing className="w-4 h-4 mr-2" />
              Make Call
            </Button>
          </div>
        }
      />

      <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto animate-fade-in" style={{ fontFamily: "'Outfit', sans-serif" }}>
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Total Calls */}
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                  <Phone className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Calls</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{totalCalls}</div>
            </div>
          </Card>

          {/* Total Duration */}
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
                  <Clock className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Duration</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{formatDuration(totalCallDuration) === "—" ? "0s" : formatDuration(totalCallDuration)}</div>
            </div>
          </Card>

          {/* Avg Duration */}
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10">
                  <BarChart3 className="w-4 h-4 text-violet-500" />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Avg Duration</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{formatDuration(avgDurationSeconds) === "—" ? "0s" : formatDuration(avgDurationSeconds)}</div>
            </div>
          </Card>

          {/* Active Calls */}
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
                  <Activity className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-3xl font-semibold text-foreground tracking-tight">{activeCalls.length}</div>
                {activeCalls.length > 0 && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                    <Zap className="w-3 h-3" /> LIVE
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Issues */}
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Issues</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{callsWithIssues}</div>
            </div>
          </Card>
        </div>

        {/* Calls Table Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>Calls</h2>
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full font-medium">
                {filteredCalls.length} result{filteredCalls.length !== 1 ? "s" : ""}
              </span>
              {refreshing && (
                <div className="flex items-center gap-1.5 text-xs text-primary animate-pulse">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  Refreshing…
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Filter Toggle */}
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 px-3 text-xs font-medium border-border/60 bg-background hover:bg-muted text-muted-foreground transition-colors",
                  showFilters && "border-primary/30 bg-primary/5 text-primary"
                )}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-3.5 h-3.5 mr-2" />
                Filters
                {(directionFilter !== "all" || statusFilter !== "all") && (
                  <span className="ml-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
                    {(directionFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0)}
                  </span>
                )}
              </Button>

              {/* Search */}
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="Search calls…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-9 w-64 pl-9 pr-4 bg-background border border-border/60 rounded-lg text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/50"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="flex items-center gap-3 p-3 bg-muted/20 border border-border/40 rounded-xl animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Direction:</span>
                <div className="flex items-center bg-background border border-border/60 rounded-lg overflow-hidden">
                  {(["all", "inbound", "outbound"] as const).map(dir => (
                    <button
                      key={dir}
                      onClick={() => setDirectionFilter(dir)}
                      className={cn(
                        "px-3 py-1.5 text-[11px] font-medium transition-all capitalize",
                        directionFilter === dir
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {dir === "all" ? "All" : dir}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-px h-6 bg-border/50" />

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="h-8 px-3 bg-background border border-border/60 rounded-lg text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all text-foreground"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  <option value="all">All Statuses</option>
                  {uniqueStatuses.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>

              {(directionFilter !== "all" || statusFilter !== "all") && (
                <>
                  <div className="w-px h-6 bg-border/50" />
                  <button
                    onClick={() => { setDirectionFilter("all"); setStatusFilter("all"); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear filters
                  </button>
                </>
              )}
            </div>
          )}

          {/* Table */}
          <div className="bg-background border border-border/60 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse" style={{ fontFamily: "'Outfit', sans-serif" }}>
                <thead className="bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-widest border-b border-border/50">
                  <tr>
                    <th className="px-5 py-3 font-bold">ID</th>
                    <th className="px-5 py-3 font-bold">From</th>
                    <th className="px-5 py-3 font-bold">To</th>
                    <th className="px-5 py-3 font-bold">Direction</th>
                    <th
                      className="px-5 py-3 font-bold cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort("started_at")}
                    >
                      <div className="flex items-center gap-1.5">
                        Started At
                        {sortField === "started_at" ? (
                          sortDirection === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3 opacity-30" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-5 py-3 font-bold cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort("ended_at")}
                    >
                      <div className="flex items-center gap-1.5">
                        Ended At
                        {sortField === "ended_at" ? (
                          sortDirection === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3 opacity-0" />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-5 py-3 font-bold cursor-pointer hover:text-foreground transition-colors select-none"
                      onClick={() => handleSort("duration")}
                    >
                      <div className="flex items-center gap-1.5">
                        Duration
                        {sortField === "duration" ? (
                          sortDirection === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3 opacity-0" />
                        )}
                      </div>
                    </th>
                    <th className="px-5 py-3 font-bold">Room</th>
                    <th className="px-5 py-3 font-bold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredCalls.map((call) => (
                    <tr key={call.id} className="group hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-muted-foreground/80 truncate max-w-[80px]">
                            {call.call_id?.substring(0, 8) || call.id.substring(0, 8)}
                          </span>
                          <button
                            onClick={() => handleCopyId(call.call_id || call.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            title="Copy full ID"
                          >
                            {copiedId === (call.call_id || call.id) ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-foreground font-medium text-[12.5px]">
                        {call.from_number || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-foreground font-medium text-[12.5px]">
                        {call.to_number || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide",
                          call.direction === "inbound"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        )}>
                          {call.direction === "inbound" ? (
                            <ArrowDownLeft className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          {call.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap text-[12px]">
                        {formatDateTime(call.started_at)}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap text-[12px]">
                        {call.ended_at ? formatDateTime(call.ended_at) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-foreground text-[12.5px] font-medium tabular-nums">
                        {formatDuration(call.duration_seconds)}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-[11px]">
                        {call.room_name ? (
                          <span className="font-mono truncate max-w-[120px] inline-block" title={call.room_name}>
                            {call.room_name.length > 16 ? call.room_name.substring(0, 16) + "…" : call.room_name}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border",
                            getStatusBadgeStyles(call.status)
                          )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", getStatusDot(call.status))} />
                            {call.status.toUpperCase()}
                          </span>
                          {(call.status === "active" || call.status === "ringing") && (
                            <button
                              onClick={() => handleEndCall(call.call_id || call.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10 text-red-500"
                              title="End call"
                            >
                              <PhoneOff className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredCalls.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3 max-w-[280px] mx-auto">
                          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                            <Phone className="w-5 h-5 text-muted-foreground/50" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">No calls found</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                              {searchQuery || directionFilter !== "all" || statusFilter !== "all"
                                ? "Try adjusting your search or filters"
                                : "Call logs will appear here when calls are made"
                              }
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Make Call Modal */}
      <Modal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        title="Make Outbound Call"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsCallModalOpen(false)}>Cancel</Button>
            <Button onClick={handleMakeCall} disabled={calling || !callForm.toNumber || !callForm.trunkId}>
              {calling ? "Calling..." : "Call"}
            </Button>
          </>
        }
      >
        <div className="space-y-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {trunks.length === 0 ? (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-400">No SIP trunks configured. Please add a SIP trunk first.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => router.push('/telephony/sip-trunks')}>
                Configure SIP Trunks
              </Button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">SIP Trunk</label>
                <select
                  value={callForm.trunkId}
                  onChange={(e) => setCallForm({ ...callForm, trunkId: e.target.value })}
                  className="w-full bg-surface border border-border rounded-lg p-2.5 focus:border-primary/50 focus:outline-none"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {trunks.map((trunk) => (
                    <option key={trunk.id} value={trunk.id}>
                      {trunk.name} ({trunk.numbers?.[0] || trunk.sip_server || "no number"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Phone Number to Call *</label>
                <input
                  type="tel"
                  value={callForm.toNumber}
                  onChange={(e) => setCallForm({ ...callForm, toNumber: e.target.value })}
                  placeholder="+1234567890"
                  className="w-full bg-surface border border-border rounded-lg p-2.5 focus:border-primary/50 focus:outline-none"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                />
                <p className="text-xs text-muted-foreground mt-1">Use E.164 format (e.g., +12025551234)</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Room Name (Optional)</label>
                <input
                  type="text"
                  value={callForm.roomName}
                  onChange={(e) => setCallForm({ ...callForm, roomName: e.target.value })}
                  placeholder="e.g., support-call-123"
                  className="w-full bg-surface border border-border rounded-lg p-2.5 focus:border-primary/50 focus:outline-none"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                />
                <p className="text-xs text-muted-foreground mt-1">Connect call to this LiveKit room</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Participant Identity (Optional)</label>
                <input
                  type="text"
                  value={callForm.participantIdentity}
                  onChange={(e) => setCallForm({ ...callForm, participantIdentity: e.target.value })}
                  placeholder="e.g., caller-john"
                  className="w-full bg-surface border border-border rounded-lg p-2.5 focus:border-primary/50 focus:outline-none"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                />
                <p className="text-xs text-muted-foreground mt-1">Identity for the caller in the room</p>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
