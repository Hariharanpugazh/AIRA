"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/Header";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { DelayedLoader } from "../../../components/ui/DelayedLoader";
import { cn } from "../../../lib/utils";
import {
  Upload, Video, Radio, Link2, Plus, Search, X, Check, Copy,
  Trash2, AlertTriangle, Globe, HardDrive
} from "lucide-react";
import {
  getAccessToken, getIngresses, createIngress, createUrlIngress,
  deleteIngress, Ingress,
} from "../../../lib/api";

type IngressType = "rtmp" | "whip" | "url";

interface IngressFormData {
  name: string;
  type: IngressType;
  url: string;
  roomName: string;
  participantIdentity: string;
  participantName: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface IngressesPageProps {
  projectId?: string;
}

export default function IngressesPage({ projectId }: IngressesPageProps) {
  const router = useRouter();
  const [ingresses, setIngresses] = useState<Ingress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [projectName, setProjectName] = useState("Project");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [formData, setFormData] = useState<IngressFormData>({
    name: "", type: "rtmp", url: "", roomName: "",
    participantIdentity: "", participantName: "", audioEnabled: true, videoEnabled: true,
  });

  const loadData = useCallback(async (showLoader = true) => {
    if (!getAccessToken()) { router.push("/login"); return; }
    if (showLoader) setRefreshing(true);
    try {
      const i = await getIngresses(projectId);
      setIngresses(i);
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("projectName");
        if (stored) setProjectName(stored);
      }
    } catch { } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, projectId]);

  useEffect(() => { loadData(true); }, [loadData]);

  useEffect(() => {
    if (autoRefreshRef.current) { clearInterval(autoRefreshRef.current); autoRefreshRef.current = null; }
    if (autoRefreshInterval > 0) {
      autoRefreshRef.current = setInterval(() => loadData(false), autoRefreshInterval);
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [autoRefreshInterval, loadData]);

  const handleRefresh = async () => { await loadData(true); };

  const handleCreate = async () => {
    if (!formData.name) return;
    setCreating(true);
    try {
      if (formData.type === "url") {
        if (!formData.url || !formData.roomName) { alert("URL and Room Name are required"); setCreating(false); return; }
        await createUrlIngress({
          name: formData.name, url: formData.url, room_name: formData.roomName,
          participant_identity: formData.participantIdentity || `url-${Date.now()}`,
          participant_name: formData.participantName || formData.name,
          audio_enabled: formData.audioEnabled, video_enabled: formData.videoEnabled,
        }, projectId);
        await loadData(false);
      } else {
        const newIngress = await createIngress(formData.name, formData.type as "rtmp" | "whip", projectId);
        setIngresses([newIngress, ...ingresses]);
      }
      setIsModalOpen(false);
      setFormData({ name: "", type: "rtmp", url: "", roomName: "", participantIdentity: "", participantName: "", audioEnabled: true, videoEnabled: true });
    } catch (e) {
      alert("Failed to create ingress: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteIngress(id, projectId);
      setIngresses(ingresses.filter(i => i.ingress_id !== id));
      setDeleteConfirmId(null);
    } catch { }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case "rtmp": return { bg: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", icon: Video };
      case "whip": return { bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", icon: Radio };
      case "url": return { bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", icon: Link2 };
      default: return { bg: "bg-muted text-muted-foreground border-border/50", icon: Upload };
    }
  };

  const rtmpCount = ingresses.filter(i => i.ingress_type === "rtmp").length;
  const whipCount = ingresses.filter(i => i.ingress_type === "whip").length;
  const urlCount = ingresses.filter(i => i.ingress_type === "url").length;

  const filteredIngresses = searchQuery.trim()
    ? ingresses.filter(i => {
      const q = searchQuery.toLowerCase();
      return i.ingress_id?.toLowerCase().includes(q) || i.name?.toLowerCase().includes(q) || i.url?.toLowerCase().includes(q) || i.ingress_type?.toLowerCase().includes(q);
    })
    : ingresses;

  const ingressTypeOptions = [
    { value: "rtmp", label: "RTMP", desc: "OBS, Streamlabs, etc.", icon: Video },
    { value: "whip", label: "WHIP", desc: "WebRTC HTTP Ingest Protocol", icon: Radio },
    { value: "url", label: "URL", desc: "HLS, MP4, MKV sources", icon: Link2 },
  ];

  return (
    <>
      {(loading || creating) && <DelayedLoader />}
      <Header
        projectName={projectName}
        pageName="Ingress"
        showTimeRange={false}
        onRefresh={handleRefresh}
        actionButton={
          <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-bold text-[11px] uppercase tracking-widest px-6 h-9" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-2 stroke-3" /> Create Ingress
          </Button>
        }
      />

      <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto animate-fade-in" style={{ fontFamily: "'Outfit', sans-serif" }}>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10"><Upload className="w-4 h-4 text-primary" /></div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Ingresses</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{ingresses.length}</div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10"><Video className="w-4 h-4 text-red-500" /></div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">RTMP</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{rtmpCount}</div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10"><Radio className="w-4 h-4 text-blue-500" /></div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">WHIP</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{whipCount}</div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10"><Link2 className="w-4 h-4 text-emerald-500" /></div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">URL</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{urlCount}</div>
            </div>
          </Card>
        </div>

        {/* Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>Ingress Streams</h2>
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full font-medium">{filteredIngresses.length}</span>
              {refreshing && <div className="flex items-center gap-1.5 text-xs text-primary animate-pulse"><div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />Refreshing…</div>}
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input type="text" placeholder="Search ingresses…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="h-9 w-64 pl-9 pr-4 bg-background border border-border/60 rounded-lg text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/50"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              />
              {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
            </div>
          </div>

          <div className="bg-background border border-border/60 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse" style={{ fontFamily: "'Outfit', sans-serif" }}>
                <thead className="bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-widest border-b border-border/50">
                  <tr>
                    <th className="px-5 py-3 font-bold">Ingress ID</th>
                    <th className="px-5 py-3 font-bold">Name</th>
                    <th className="px-5 py-3 font-bold">Type</th>
                    <th className="px-5 py-3 font-bold">Endpoint</th>
                    <th className="px-5 py-3 font-bold">Stream Key</th>
                    <th className="px-5 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredIngresses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-2.5">
                          <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center"><Upload className="w-4 h-4 text-muted-foreground/50" /></div>
                          <p className="text-sm text-muted-foreground font-medium">No ingress streams</p>
                          <p className="text-xs text-muted-foreground/60">{searchQuery ? "Try adjusting your search" : "Create an ingress to stream media into a room"}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredIngresses.map(ingress => {
                      const typeStyle = getTypeStyle(ingress.ingress_type);
                      const TypeIcon = typeStyle.icon;
                      return (
                        <tr key={ingress.ingress_id} className="group hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <code className="text-[11px] text-muted-foreground/80 font-mono truncate max-w-[100px]">{ingress.ingress_id.substring(0, 12)}…</code>
                              <button onClick={() => handleCopy(ingress.ingress_id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                                {copiedId === ingress.ingress_id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-foreground font-medium">{ingress.name}</td>
                          <td className="px-5 py-3.5">
                            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border uppercase", typeStyle.bg)}>
                              <TypeIcon className="w-3 h-3" /> {ingress.ingress_type}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {ingress.url ? (
                              <div className="flex items-center gap-1.5">
                                <code className="text-[11px] text-violet-500 font-mono truncate max-w-[200px]" title={ingress.url}>{ingress.url}</code>
                                <button onClick={() => handleCopy(ingress.url!)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0">
                                  {copiedId === ingress.url ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {ingress.stream_key ? (
                              <div className="flex items-center gap-1.5">
                                <code className="text-[11px] text-amber-600 dark:text-amber-400 font-mono truncate max-w-[120px]">••••••{ingress.stream_key.slice(-4)}</code>
                                <button onClick={() => handleCopy(ingress.stream_key!)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0" title="Copy full key">
                                  {copiedId === ingress.stream_key ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setDeleteConfirmId(ingress.ingress_id); setDeleteConfirmName(ingress.name); }} className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors" title="Delete ingress">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Create Ingress Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Ingress" width="max-w-2xl">
        <div className="space-y-6 py-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Ingress Type</label>
            <div className="grid grid-cols-3 gap-2">
              {ingressTypeOptions.map(opt => (
                <button key={opt.value} type="button" onClick={() => setFormData({ ...formData, type: opt.value as IngressType })}
                  className={cn("p-3 rounded-xl border text-center transition-all", formData.type === opt.value ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/30 bg-background")}>
                  <opt.icon className={cn("w-5 h-5 mx-auto mb-2", formData.type === opt.value ? "text-primary" : "text-muted-foreground")} />
                  <p className="font-semibold text-sm">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Name *</label>
            <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="My Stream"
              className="w-full bg-muted/20 border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
          </div>

          {formData.type === "url" && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Source URL *</label>
                <input value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} placeholder="https://your-source.com/stream.m3u8"
                  className="w-full bg-muted/20 border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
                <p className="mt-1.5 text-[11px] text-muted-foreground">Supports HLS (.m3u8), MP4, MKV, WebM sources</p>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Room Name *</label>
                <input value={formData.roomName} onChange={e => setFormData({ ...formData, roomName: e.target.value })} placeholder="stream-room"
                  className="w-full bg-muted/20 border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Participant Identity</label>
                  <input value={formData.participantIdentity} onChange={e => setFormData({ ...formData, participantIdentity: e.target.value })} placeholder="url-stream"
                    className="w-full bg-muted/20 border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Participant Name</label>
                  <input value={formData.participantName} onChange={e => setFormData({ ...formData, participantName: e.target.value })} placeholder="URL Stream"
                    className="w-full bg-muted/20 border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={formData.audioEnabled} onChange={e => setFormData({ ...formData, audioEnabled: e.target.checked })} className="w-4 h-4 rounded" /> Enable Audio
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={formData.videoEnabled} onChange={e => setFormData({ ...formData, videoEnabled: e.target.checked })} className="w-4 h-4 rounded" /> Enable Video
                </label>
              </div>
            </>
          )}

          {formData.type !== "url" && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-sm text-foreground">
                {formData.type === "rtmp"
                  ? "RTMP ingress will provide a stream URL and key for OBS, Streamlabs, and similar tools."
                  : "WHIP ingress enables browser-based streaming using WebRTC."}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
            <Button variant="outline" className="text-xs h-10 border-border/60" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button className="bg-primary hover:bg-primary/90 text-white font-bold text-[11px] uppercase tracking-widest px-8 h-10" onClick={handleCreate} disabled={creating || !formData.name}>
              {creating ? "Creating…" : "Create Ingress"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Ingress">
        <div className="space-y-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-500">This action cannot be undone</p>
              <p className="text-xs text-muted-foreground mt-1">The ingress endpoint will be permanently removed.</p>
            </div>
          </div>
          <p className="text-sm text-foreground">Are you sure you want to delete <strong>{deleteConfirmName}</strong>?</p>
          <div className="flex justify-end gap-3 pt-3 border-t border-border/60">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="text-xs h-9">Cancel</Button>
            <Button className="bg-red-500 hover:bg-red-600 text-white font-bold text-[11px] uppercase tracking-widest px-6 h-9" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
