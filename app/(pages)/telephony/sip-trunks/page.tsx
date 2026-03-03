"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "../../../components/Header";
import {
  Search, Plus, Phone, Server, Shield, Trash2, X, PlusCircle, Settings2, Filter,
  Copy, Check, PhoneIncoming, PhoneOutgoing, ChevronDown, ChevronUp, MoreHorizontal,
  Globe, Lock, ExternalLink, Edit2, AlertTriangle, Wifi, WifiOff, RefreshCw, Zap
} from "lucide-react";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { Input } from "../../../../components/ui/Input";
import { DelayedLoader } from "../../../../components/ui/DelayedLoader";
import { cn } from "../../../../lib/utils";
import {
  getAccessToken, getSipTrunks, createSipTrunk, deleteSipTrunk, updateSipTrunk, SipTrunk,
} from "../../../../lib/api";

interface SipTrunksPageProps {
  projectId?: string;
}

type TrunkDirection = "inbound" | "outbound";
type ModalMode = "create" | "edit";

export default function SipTrunksPage({ projectId }: SipTrunksPageProps) {
  const router = useRouter();
  const [projectName, setProjectName] = useState<string>("");
  const [trunks, setTrunks] = useState<SipTrunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingTrunk, setEditingTrunk] = useState<SipTrunk | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    numbers: "",
    sip_server: "",
    username: "",
    password: "",
    direction: "outbound" as TrunkDirection,
    transport: "tcp" as "tcp" | "udp" | "tls",
  });

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  // Derive LiveKit SIP domain from env
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";
  const sipDomain = livekitUrl
    .replace(/^wss?:\/\//, "")
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];

  const loadData = useCallback(async (showLoader = true) => {
    const token = getAccessToken();
    if (!token) { router.push("/login"); return; }
    if (showLoader) setRefreshing(true);
    try {
      const scopedProjectId = projectId || localStorage.getItem("projectId") || undefined;
      setProjectName(localStorage.getItem("projectName") || "My Project");
      const trunksData = await getSipTrunks(scopedProjectId);
      setTrunks(trunksData || []);
    } catch (e) {
      if ((e as Record<string, unknown>).status === 404) {
        setTrunks([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, projectId]);

  useEffect(() => { loadData(true); }, [loadData]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefreshRef.current) { clearInterval(autoRefreshRef.current); autoRefreshRef.current = null; }
    if (autoRefreshInterval > 0) {
      autoRefreshRef.current = setInterval(() => loadData(false), autoRefreshInterval);
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [autoRefreshInterval, loadData]);

  const handleRefresh = async () => { await loadData(true); };

  const isOutbound = (trunk: SipTrunk) => Boolean(trunk.sip_server);
  const inboundTrunks = trunks.filter(t => !isOutbound(t));
  const outboundTrunks = trunks.filter(t => isOutbound(t));

  // Filter by search
  const filterTrunks = (list: SipTrunk[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(t =>
      t.id?.toLowerCase().includes(q) ||
      t.name?.toLowerCase().includes(q) ||
      t.numbers?.some(n => n.toLowerCase().includes(q)) ||
      t.sip_server?.toLowerCase().includes(q) ||
      t.sip_uri?.toLowerCase().includes(q)
    );
  };

  const filteredInbound = filterTrunks(inboundTrunks);
  const filteredOutbound = filterTrunks(outboundTrunks);

  // Create / Edit trunk
  const openCreateModal = (direction: TrunkDirection = "outbound") => {
    setModalMode("create");
    setEditingTrunk(null);
    setFormData({
      name: "", numbers: "", sip_server: "", username: "", password: "",
      direction, transport: "tcp",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (trunk: SipTrunk) => {
    setModalMode("edit");
    setEditingTrunk(trunk);
    setFormData({
      name: trunk.name || "",
      numbers: trunk.numbers?.join(", ") || "",
      sip_server: trunk.sip_server || "",
      username: trunk.username || "",
      password: "",
      direction: isOutbound(trunk) ? "outbound" : "inbound",
      transport: "tcp",
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) return;
    setSaving(true);
    try {
      const scopedProjectId = projectId || localStorage.getItem("projectId") || undefined;
      const payload = {
        name: formData.name,
        numbers: formData.numbers.split(",").map(s => s.trim()).filter(Boolean),
        sip_server: formData.direction === "outbound" ? formData.sip_server : undefined,
        username: formData.username || undefined,
        password: formData.password || undefined,
      };
      if (modalMode === "edit" && editingTrunk) {
        const updated = await updateSipTrunk(editingTrunk.id, payload, scopedProjectId);
        setTrunks(prev => prev.map(t => t.id === editingTrunk.id ? updated : t));
      } else {
        const newTrunk = await createSipTrunk(payload, scopedProjectId);
        setTrunks(prev => [newTrunk, ...prev]);
      }
      setIsModalOpen(false);
    } catch (e) {
      alert("Failed to save trunk: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const scopedProjectId = projectId || localStorage.getItem("projectId") || undefined;
      await deleteSipTrunk(id, scopedProjectId);
      setTrunks(prev => prev.filter(t => t.id !== id));
      setDeleteConfirmId(null);
    } catch (e) {
      alert("Failed to delete trunk: " + (e instanceof Error ? e.message : "Unknown error"));
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  // Build a SIP URI for display
  const buildSipUri = (trunk: SipTrunk): string => {
    if (trunk.sip_uri) return trunk.sip_uri;
    if (trunk.sip_server) return `sip:${trunk.sip_server}`;
    if (sipDomain && trunk.id) return `sip:${trunk.id}@${sipDomain}`;
    return "—";
  };

  // Primary SIP URI for the stats card
  const primarySipUri = (() => {
    if (sipDomain) return `sip:${sipDomain}`;
    if (trunks.length > 0) {
      const uri = buildSipUri(trunks[0]);
      if (uri !== "—") return uri;
    }
    return "Not configured";
  })();

  return (
    <>
      {(loading || saving) && <DelayedLoader />}
      <Header
        projectName={projectName}
        sectionName="Telephony"
        pageName="SIP Trunks"
        showTimeRange={false}
        onRefresh={handleRefresh}
        onAutoRefreshChange={setAutoRefreshInterval}
        actionButton={
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-white font-bold text-[11px] uppercase tracking-widest px-6 h-9"
            onClick={() => openCreateModal("outbound")}
          >
            <Plus className="w-3.5 h-3.5 mr-2 stroke-3" />
            Create Trunk
          </Button>
        }
      />

      <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto animate-fade-in" style={{ fontFamily: "'Outfit', sans-serif" }}>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Trunks */}
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                  <Phone className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Trunks</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{trunks.length}</div>
            </div>
          </Card>

          {/* Inbound Count */}
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
                  <PhoneIncoming className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Inbound</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{inboundTrunks.length}</div>
            </div>
          </Card>

          {/* Outbound Count */}
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
                  <PhoneOutgoing className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Outbound</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{outboundTrunks.length}</div>
            </div>
          </Card>

          {/* SIP URI */}
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10">
                  <Globe className="w-4 h-4 text-violet-500" />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">SIP Domain</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-foreground truncate bg-muted/30 px-2.5 py-1 rounded-lg border border-border/40 flex-1 min-w-0">
                  {primarySipUri}
                </code>
                <button
                  onClick={() => handleCopy(primarySipUri)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all shrink-0"
                >
                  {copiedId === primarySipUri ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Search Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>SIP Trunks</h2>
            {refreshing && (
              <div className="flex items-center gap-1.5 text-xs text-primary animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                Refreshing…
              </div>
            )}
          </div>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search trunks…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 w-64 pl-9 pr-4 bg-background border border-border/60 rounded-lg text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/50"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Inbound Trunks Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10">
                <PhoneIncoming className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Inbound Trunks</h3>
              <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                {filteredInbound.length}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[10px] font-semibold uppercase tracking-wider border-border/60"
              onClick={() => openCreateModal("inbound")}
            >
              <Plus className="w-3 h-3 mr-1.5" /> Add Inbound
            </Button>
          </div>

          <div className="bg-background border border-border/60 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse" style={{ fontFamily: "'Outfit', sans-serif" }}>
                <thead className="bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-widest border-b border-border/50">
                  <tr>
                    <th className="px-5 py-3 font-bold">Trunk ID</th>
                    <th className="px-5 py-3 font-bold">Name</th>
                    <th className="px-5 py-3 font-bold">Numbers</th>
                    <th className="px-5 py-3 font-bold">SIP URI</th>
                    <th className="px-5 py-3 font-bold">Auth</th>
                    <th className="px-5 py-3 font-bold">Created</th>
                    <th className="px-5 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredInbound.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-2.5">
                          <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
                            <PhoneIncoming className="w-4 h-4 text-muted-foreground/50" />
                          </div>
                          <p className="text-sm text-muted-foreground font-medium">No inbound trunks</p>
                          <p className="text-xs text-muted-foreground/60">Create an inbound trunk to receive SIP calls</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredInbound.map(trunk => (
                      <tr key={trunk.id} className="group hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <code className="text-[11px] text-muted-foreground/80 font-mono truncate max-w-[100px]">
                              {trunk.id.substring(0, 12)}…
                            </code>
                            <button
                              onClick={() => handleCopy(trunk.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            >
                              {copiedId === trunk.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-foreground font-medium">{trunk.name}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {trunk.numbers?.length > 0 ? (
                              <>
                                {trunk.numbers.slice(0, 2).map((n, i) => (
                                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                                    {n}
                                  </span>
                                ))}
                                {trunk.numbers.length > 2 && (
                                  <span className="text-[10px] text-muted-foreground">+{trunk.numbers.length - 2} more</span>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">No numbers</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <code className="text-[11px] text-violet-500 font-mono truncate max-w-[200px]" title={buildSipUri(trunk)}>
                              {buildSipUri(trunk)}
                            </code>
                            <button
                              onClick={() => handleCopy(buildSipUri(trunk))}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
                            >
                              {copiedId === buildSipUri(trunk) ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {trunk.username ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                              <Lock className="w-3 h-3" /> {trunk.username}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50 text-[11px]">None</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground text-[12px] whitespace-nowrap">
                          {trunk.created_at ? formatDate(trunk.created_at) : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditModal(trunk)} className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Edit trunk">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setDeleteConfirmId(trunk.id); setDeleteConfirmName(trunk.name); }} className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors" title="Delete trunk">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Outbound Trunks Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/10">
                <PhoneOutgoing className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Outbound Trunks</h3>
              <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                {filteredOutbound.length}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[10px] font-semibold uppercase tracking-wider border-border/60"
              onClick={() => openCreateModal("outbound")}
            >
              <Plus className="w-3 h-3 mr-1.5" /> Add Outbound
            </Button>
          </div>

          <div className="bg-background border border-border/60 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse" style={{ fontFamily: "'Outfit', sans-serif" }}>
                <thead className="bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-widest border-b border-border/50">
                  <tr>
                    <th className="px-5 py-3 font-bold">Trunk ID</th>
                    <th className="px-5 py-3 font-bold">Name</th>
                    <th className="px-5 py-3 font-bold">Numbers</th>
                    <th className="px-5 py-3 font-bold">Gateway Address</th>
                    <th className="px-5 py-3 font-bold">Auth</th>
                    <th className="px-5 py-3 font-bold">Created</th>
                    <th className="px-5 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredOutbound.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-2.5">
                          <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
                            <PhoneOutgoing className="w-4 h-4 text-muted-foreground/50" />
                          </div>
                          <p className="text-sm text-muted-foreground font-medium">No outbound trunks</p>
                          <p className="text-xs text-muted-foreground/60">Configure a SIP trunk to enable outbound calls</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredOutbound.map(trunk => (
                      <tr key={trunk.id} className="group hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <code className="text-[11px] text-muted-foreground/80 font-mono truncate max-w-[100px]">
                              {trunk.id.substring(0, 12)}…
                            </code>
                            <button
                              onClick={() => handleCopy(trunk.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            >
                              {copiedId === trunk.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-foreground font-medium">{trunk.name}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {trunk.numbers?.length > 0 ? (
                              <>
                                {trunk.numbers.slice(0, 2).map((n, i) => (
                                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
                                    {n}
                                  </span>
                                ))}
                                {trunk.numbers.length > 2 && (
                                  <span className="text-[10px] text-muted-foreground">+{trunk.numbers.length - 2} more</span>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">No numbers</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <code className="text-[11px] text-blue-500 font-mono truncate max-w-[200px]" title={trunk.sip_server || ""}>
                              {trunk.sip_server || "—"}
                            </code>
                            {trunk.sip_server && (
                              <button
                                onClick={() => handleCopy(trunk.sip_server!)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
                              >
                                {copiedId === trunk.sip_server ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {trunk.username ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                              <Lock className="w-3 h-3" /> {trunk.username}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50 text-[11px]">None</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground text-[12px] whitespace-nowrap">
                          {trunk.created_at ? formatDate(trunk.created_at) : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditModal(trunk)} className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Edit trunk">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setDeleteConfirmId(trunk.id); setDeleteConfirmName(trunk.name); }} className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors" title="Delete trunk">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Trunk Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === "create" ? "Create SIP Trunk" : `Edit — ${editingTrunk?.name || "Trunk"}`}
        width="max-w-2xl"
      >
        <div className="space-y-6 py-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {/* Direction selector (create only) */}
          {modalMode === "create" && (
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Direction</label>
              <div className="flex items-center bg-background border border-border/60 rounded-lg overflow-hidden w-fit">
                {(["inbound", "outbound"] as TrunkDirection[]).map(dir => (
                  <button
                    key={dir}
                    onClick={() => setFormData(prev => ({ ...prev, direction: dir }))}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-[11px] font-semibold transition-all capitalize",
                      formData.direction === dir
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {dir === "inbound" ? <PhoneIncoming className="w-3.5 h-3.5" /> : <PhoneOutgoing className="w-3.5 h-3.5" />}
                    {dir}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Trunk Name *</label>
            <Input
              placeholder="e.g. Twilio US, Vonage EU"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {/* Numbers */}
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Phone Numbers</label>
            <textarea
              placeholder="+1234567890, +1987654321"
              value={formData.numbers}
              onChange={e => setFormData(prev => ({ ...prev, numbers: e.target.value }))}
              className="w-full bg-muted/20 border border-border/60 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all min-h-[80px] resize-none"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">Comma-separated list of E.164 phone numbers</p>
          </div>

          {/* Outbound-specific fields */}
          {formData.direction === "outbound" && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Gateway Address *</label>
                <Input
                  placeholder="sip.your-provider.com"
                  value={formData.sip_server}
                  onChange={e => setFormData(prev => ({ ...prev, sip_server: e.target.value }))}
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">SIP server address for outbound calls</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Transport</label>
                <div className="flex items-center gap-2">
                  {(["tcp", "udp", "tls"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setFormData(prev => ({ ...prev, transport: t }))}
                      className={cn(
                        "px-4 py-2 rounded-lg text-[11px] font-semibold transition-all uppercase",
                        formData.transport === t ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border/40"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Auth */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Username</label>
              <Input
                placeholder="SIP username"
                value={formData.username}
                onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Password</label>
              <Input
                type="password"
                placeholder={modalMode === "edit" ? "Leave blank to keep" : "••••••••"}
                value={formData.password}
                onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
            <Button variant="outline" className="text-xs h-10 border-border/60 hover:bg-muted/50" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white font-bold text-[11px] uppercase tracking-widest px-8 h-10"
              onClick={handleSave}
              disabled={!formData.name || (formData.direction === "outbound" && !formData.sip_server) || saving}
            >
              {saving ? "Saving..." : modalMode === "create" ? "Create Trunk" : "Update Trunk"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete SIP Trunk"
      >
        <div className="space-y-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-500">This action cannot be undone</p>
              <p className="text-xs text-muted-foreground mt-1">All associated configurations will be permanently removed.</p>
            </div>
          </div>
          <p className="text-sm text-foreground">
            Are you sure you want to delete <strong>{deleteConfirmName}</strong>?
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-border/60">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="text-xs h-9">Cancel</Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white font-bold text-[11px] uppercase tracking-widest px-6 h-9"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Trunk
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
