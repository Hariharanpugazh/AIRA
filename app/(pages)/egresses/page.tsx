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
  Download, Globe, FileVideo, Image as ImageIcon, StopCircle,
  Plus, Search, X, Check, Copy, AlertTriangle, Trash2,
  Radio, Play, Clock, HardDrive, Film, Camera
} from "lucide-react";
import {
  getAccessToken, getEgresses, stopEgress, startRoomEgress,
  startWebEgress, startTrackEgress, startImageEgress, getProjects,
  Egress, Project,
} from "../../../lib/api";

type EgressType = "room_composite" | "web" | "track" | "image";

interface EgressFormData {
  type: EgressType;
  roomName: string;
  url: string;
  trackSid: string;
  outputFormat: string;
  width: number;
  height: number;
  audioOnly: boolean;
  videoOnly: boolean;
}

interface EgressesPageProps {
  projectId?: string;
}

export default function EgressesPage({ projectId }: EgressesPageProps) {
  const router = useRouter();
  const [egresses, setEgresses] = useState<Egress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvedProjectId, setResolvedProjectId] = useState<string | undefined>(undefined);
  const [projectName, setProjectName] = useState("Project");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [formData, setFormData] = useState<EgressFormData>({
    type: "room_composite", roomName: "", url: "", trackSid: "",
    outputFormat: "mp4", width: 1920, height: 1080, audioOnly: false, videoOnly: false,
  });

  const loadData = useCallback(async (showLoader = true) => {
    if (!getAccessToken()) { router.push("/login"); return; }
    if (showLoader) setRefreshing(true);
    try {
      const projects = await getProjects();
      const storedProjectId = localStorage.getItem("projectId");
      const currentProject =
        projects.find((p: Project) => p.id === projectId || p.short_id === projectId) ||
        projects.find((p: Project) => p.id === storedProjectId || p.short_id === storedProjectId) ||
        projects[0];
      if (currentProject) {
        setResolvedProjectId(currentProject.id);
        setProjectName(currentProject.name || "Project");
        try { localStorage.setItem("projectId", currentProject.id); localStorage.setItem("projectName", currentProject.name); } catch { }
        const e = await getEgresses(currentProject.id);
        setEgresses(e);
      } else {
        setEgresses([]);
      }
    } catch {
    } finally {
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

  const handleStart = async () => {
    if (!resolvedProjectId) { alert("No project selected"); return; }
    setIsStarting(true);
    try {
      switch (formData.type) {
        case "room_composite": await startRoomEgress(formData.roomName, resolvedProjectId); break;
        case "web": await startWebEgress({ url: formData.url, audio_only: formData.audioOnly, video_only: formData.videoOnly, output_format: formData.outputFormat }, resolvedProjectId); break;
        case "track": await startTrackEgress({ room_name: formData.roomName, track_sid: formData.trackSid, output_format: formData.outputFormat }, resolvedProjectId); break;
        case "image": await startImageEgress({ room_name: formData.roomName, width: formData.width, height: formData.height }, resolvedProjectId); break;
      }
      await loadData(false);
      setIsModalOpen(false);
      setFormData({ type: "room_composite", roomName: "", url: "", trackSid: "", outputFormat: "mp4", width: 1920, height: 1080, audioOnly: false, videoOnly: false });
    } catch (e) {
      alert("Failed to start egress. " + (e instanceof Error ? e.message : ""));
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async (id: string) => {
    if (!resolvedProjectId) return;
    try {
      await stopEgress(id, resolvedProjectId);
      await loadData(false);
    } catch { }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "active": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "starting": return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "complete": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "failed": return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      default: return "bg-muted text-muted-foreground border-border/50";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "web": return Globe;
      case "track": return FileVideo;
      case "image": return Camera;
      default: return Film;
    }
  };

  const activeEgresses = egresses.filter(e => e.status === "active" || e.status === "starting");
  const completedEgresses = egresses.filter(e => e.status !== "active" && e.status !== "starting");

  const filteredEgresses = searchQuery.trim()
    ? egresses.filter(e => {
      const q = searchQuery.toLowerCase();
      return e.egress_id?.toLowerCase().includes(q) || e.room_name?.toLowerCase().includes(q) || e.url?.toLowerCase().includes(q) || e.type?.toLowerCase().includes(q) || e.status?.toLowerCase().includes(q);
    })
    : egresses;

  const egressTypeOptions = [
    { value: "room_composite", label: "Room Composite", desc: "Record entire room with all participants", icon: Film },
    { value: "web", label: "Web Egress", desc: "Record a webpage URL", icon: Globe },
    { value: "track", label: "Track Egress", desc: "Record a specific audio/video track", icon: FileVideo },
    { value: "image", label: "Image Snapshot", desc: "Generate image snapshots from room", icon: Camera },
  ];

  return (
    <>
      {(loading || isStarting) && <DelayedLoader />}
      <Header
        projectName={projectName}
        pageName="Egress"
        showTimeRange={false}
        onRefresh={handleRefresh}
        actionButton={
          <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-bold text-[11px] uppercase tracking-widest px-6 h-9" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-2 stroke-3" /> Start Egress
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
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10"><Download className="w-4 h-4 text-primary" /></div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Egresses</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{egresses.length}</div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10"><Play className="w-4 h-4 text-emerald-500" /></div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{activeEgresses.length}</div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10"><Check className="w-4 h-4 text-blue-500" /></div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Completed</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{completedEgresses.length}</div>
            </div>
          </Card>
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10"><HardDrive className="w-4 h-4 text-violet-500" /></div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">LiveKit Server</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Connected</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Search + Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>Egress Jobs</h2>
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full font-medium">{filteredEgresses.length}</span>
              {refreshing && <div className="flex items-center gap-1.5 text-xs text-primary animate-pulse"><div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />Refreshing…</div>}
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input type="text" placeholder="Search egresses…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
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
                    <th className="px-5 py-3 font-bold">Egress ID</th>
                    <th className="px-5 py-3 font-bold">Type</th>
                    <th className="px-5 py-3 font-bold">Source</th>
                    <th className="px-5 py-3 font-bold">Status</th>
                    <th className="px-5 py-3 font-bold">Output</th>
                    <th className="px-5 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredEgresses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-2.5">
                          <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center"><Download className="w-4 h-4 text-muted-foreground/50" /></div>
                          <p className="text-sm text-muted-foreground font-medium">No egress jobs</p>
                          <p className="text-xs text-muted-foreground/60">{searchQuery ? "Try adjusting your search" : "Start a recording, web egress, or track capture"}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredEgresses.map(egress => {
                      const TypeIcon = getTypeIcon(egress.type || "room_composite");
                      return (
                        <tr key={egress.egress_id} className="group hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <code className="text-[11px] text-muted-foreground/80 font-mono truncate max-w-[120px]">{egress.egress_id.substring(0, 16)}…</code>
                              <button onClick={() => handleCopy(egress.egress_id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                                {copiedId === egress.egress_id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-semibold capitalize">
                              <TypeIcon className="w-3 h-3" /> {(egress.type || "room_composite").replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-foreground font-medium text-[12.5px]">{egress.room_name || egress.url || "—"}</td>
                          <td className="px-5 py-3.5">
                            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border", getStatusStyle(egress.status))}>
                              {(egress.status === "active" || egress.status === "starting") && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                              {egress.status?.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {egress.file_url ? (
                              <a href={egress.file_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline font-medium">Download</a>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {(egress.status === "active" || egress.status === "starting") && (
                                <button onClick={() => handleStop(egress.egress_id)} className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors" title="Stop egress">
                                  <StopCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
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

      {/* Start Egress Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Start Egress" width="max-w-2xl">
        <div className="space-y-6 py-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Egress Type</label>
            <div className="grid grid-cols-2 gap-2">
              {egressTypeOptions.map(opt => (
                <button key={opt.value} type="button" onClick={() => setFormData({ ...formData, type: opt.value as EgressType })}
                  className={cn("p-3 rounded-xl border text-left transition-all", formData.type === opt.value ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/30 bg-background")}>
                  <opt.icon className={cn("w-5 h-5 mb-2", formData.type === opt.value ? "text-primary" : "text-muted-foreground")} />
                  <p className="font-semibold text-sm">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {formData.type === "room_composite" && (
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Room Name *</label>
              <input value={formData.roomName} onChange={e => setFormData({ ...formData, roomName: e.target.value })} placeholder="e.g. daily-standup"
                className="w-full bg-muted/20 border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
              <p className="mt-1.5 text-[11px] text-muted-foreground">The room must be active for recording to start.</p>
            </div>
          )}

          {formData.type === "web" && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Page URL *</label>
                <input value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} placeholder="https://website-to-record.com"
                  className="w-full bg-muted/20 border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={formData.audioOnly} onChange={e => setFormData({ ...formData, audioOnly: e.target.checked, videoOnly: false })} className="w-4 h-4 rounded" />
                  Audio Only
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={formData.videoOnly} onChange={e => setFormData({ ...formData, videoOnly: e.target.checked, audioOnly: false })} className="w-4 h-4 rounded" />
                  Video Only
                </label>
              </div>
            </>
          )}

          {formData.type === "track" && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Room Name *</label>
                <input value={formData.roomName} onChange={e => setFormData({ ...formData, roomName: e.target.value })} placeholder="e.g. daily-standup"
                  className="w-full bg-muted/20 border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Track SID *</label>
                <input value={formData.trackSid} onChange={e => setFormData({ ...formData, trackSid: e.target.value })} placeholder="TR_xxxxx"
                  className="w-full bg-muted/20 border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
              </div>
            </>
          )}

          {formData.type === "image" && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Room Name *</label>
                <input value={formData.roomName} onChange={e => setFormData({ ...formData, roomName: e.target.value })} placeholder="e.g. daily-standup"
                  className="w-full bg-muted/20 border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Width</label>
                  <input type="number" value={formData.width} onChange={e => setFormData({ ...formData, width: parseInt(e.target.value, 10) || 1920 })}
                    className="w-full bg-muted/20 border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Height</label>
                  <input type="number" value={formData.height} onChange={e => setFormData({ ...formData, height: parseInt(e.target.value, 10) || 1080 })}
                    className="w-full bg-muted/20 border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
                </div>
              </div>
            </>
          )}

          {formData.type !== "image" && (
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Output Format</label>
              <select value={formData.outputFormat} onChange={e => setFormData({ ...formData, outputFormat: e.target.value })}
                className="w-full bg-muted/20 border border-border/60 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all">
                <option value="mp4">MP4</option>
                <option value="ogg">OGG</option>
                <option value="webm">WebM</option>
                {formData.audioOnly && <option value="mp3">MP3</option>}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
            <Button variant="outline" className="text-xs h-10 border-border/60" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button className="bg-primary hover:bg-primary/90 text-white font-bold text-[11px] uppercase tracking-widest px-8 h-10" onClick={handleStart} disabled={isStarting}>
              {isStarting ? "Starting…" : "Start Egress"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
