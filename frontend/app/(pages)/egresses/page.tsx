"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/layouts/DashboardLayout";
import Header from "../../components/Header";
import { Card } from "../../../components/ui/Card";
import { Download, RefreshCw, Globe, FileVideo, Mic, Image as ImageIcon } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { getAccessToken, getEgresses, stopEgress, startRoomEgress, User, Egress, apiFetch } from "../../../lib/api";
import { Modal } from "../../../components/ui/Modal";
import { Plus, Download as DownloadIcon, Radio, StopCircle } from "lucide-react";

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

export default function EgressesPage() {
  const router = useRouter();
  const [egresses, setEgresses] = useState<Egress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<EgressFormData>({
    type: "room_composite",
    roomName: "",
    url: "",
    trackSid: "",
    outputFormat: "mp4",
    width: 1920,
    height: 1080,
    audioOnly: false,
    videoOnly: false,
  });
  const [isStarting, setIsStarting] = useState(false);

  const loadData = async () => {
    if (!getAccessToken()) { router.push("/login"); return; }
    try {
      const [e] = await Promise.all([getEgresses()]);
      setEgresses(e);
    } catch (err) {

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [router]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleStart = async () => {
    setIsStarting(true);
    try {
      switch (formData.type) {
        case "room_composite":
          await startRoomEgress(formData.roomName);
          break;
        case "web":
          await apiFetch('/api/livekit/egress/web', {
            method: 'POST',
            body: JSON.stringify({
              url: formData.url,
              audio_only: formData.audioOnly,
              video_only: formData.videoOnly,
              output_format: formData.outputFormat,
            }),
          });
          break;
        case "track":
          await apiFetch('/api/livekit/egress/track', {
            method: 'POST',
            body: JSON.stringify({
              room_name: formData.roomName,
              track_sid: formData.trackSid,
              output_format: formData.outputFormat,
            }),
          });
          break;
        case "image":
          await apiFetch('/api/livekit/egress/image', {
            method: 'POST',
            body: JSON.stringify({
              room_name: formData.roomName,
              width: formData.width,
              height: formData.height,
            }),
          });
          break;
      }
      handleRefresh();
      setIsModalOpen(false);
      setFormData({
        type: "room_composite",
        roomName: "",
        url: "",
        trackSid: "",
        outputFormat: "mp4",
        width: 1920,
        height: 1080,
        audioOnly: false,
        videoOnly: false,
      });
    } catch (e) {
      alert("Failed to start egress. " + (e instanceof Error ? e.message : ""));
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async (id: string) => {
    if (!confirm("Stop this egress?")) return;
    try {
      await stopEgress(id);
      handleRefresh();
    } catch (e) {

    }
  };

  const getEgressTypeIcon = (type: string) => {
    switch (type) {
      case "web": return <Globe className="w-5 h-5 text-purple-400" />;
      case "track": return <FileVideo className="w-5 h-5 text-blue-400" />;
      case "image": return <ImageIcon className="w-5 h-5 text-green-400" />;
      default: return <DownloadIcon className="w-5 h-5 text-primary" />;
    }
  };

  if (loading) return null;

  const egressTypeOptions = [
    { value: "room_composite", label: "Room Composite", description: "Record entire room with all participants", icon: DownloadIcon },
    { value: "web", label: "Web Egress", description: "Record a webpage URL", icon: Globe },
    { value: "track", label: "Track Egress", description: "Record a specific audio/video track", icon: FileVideo },
    { value: "image", label: "Image Snapshot", description: "Generate image snapshots from room", icon: ImageIcon },
  ];

  return (
    <DashboardLayout>
      <Header projectName="RELATIM" pageName="Egress" showTimeRange={false}
        actionButton={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={handleRefresh} leftIcon={<RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />}>
              Refresh
            </Button>
            <Button size="sm" onClick={() => setIsModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
              Start Egress
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-8">
        {egresses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-surface/30 rounded-lg border border-border">
            <DownloadIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <h2 className="text-foreground text-xl font-bold mb-2">No active egresses</h2>
            <p className="text-muted-foreground text-sm mb-6">Start a recording, web egress, or track capture.</p>
            <Button onClick={() => setIsModalOpen(true)}>Start Egress</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {egresses.map((egress) => (
              <Card key={egress.egress_id} variant="glass" className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    {getEgressTypeIcon((egress as any).type || "room_composite")}
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${egress.status === "starting" ? "bg-yellow-500/10 text-yellow-500" : egress.status === "active" ? "bg-green-500/10 text-green-500" : "bg-surface text-secondary"}`}>
                      {egress.status}
                    </span>
                    {(egress.status === "active" || egress.status === "starting") && (
                      <button onClick={() => handleStop(egress.egress_id)} className="text-red-500 hover:bg-red-500/10 p-1 rounded">
                        <StopCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="font-medium text-foreground mb-1">{egress.room_name || (egress as any).url || "Egress"}</h3>
                <p className="text-xs text-muted-foreground mb-1 capitalize">{(egress as any).type || "room_composite"} egress</p>
                <p className="text-xs text-secondary font-mono truncate">{egress.egress_id}</p>
                {egress.file_url && <a href={egress.file_url} target="_blank" className="text-xs text-[#00d4aa] mt-2 block hover:underline">Download Recording</a>}
              </Card>
            ))}
          </div>
        )}

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Start Egress"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleStart} disabled={isStarting}>
                {isStarting ? "Starting..." : "Start Egress"}
              </Button>
            </>
          }>
          <div className="space-y-5">

            <div>
              <label className="block text-sm font-medium mb-3">Egress Type</label>
              <div className="grid grid-cols-2 gap-2">
                {egressTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: option.value as EgressType })}
                    className={`p-3 rounded-lg border text-left transition-all ${formData.type === option.value
                      ? "border-cyan-500 bg-cyan-500/10"
                      : "border-border hover:border-primary/30 bg-surface/50"
                      }`}
                  >
                    <option.icon className={`w-5 h-5 mb-2 ${formData.type === option.value ? "text-cyan-400" : "text-muted-foreground"}`} />
                    <p className="font-medium text-sm">{option.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>


            {formData.type === "room_composite" && (
              <div>
                <label className="block text-sm font-medium mb-2">Room Name</label>
                <input
                  value={formData.roomName}
                  onChange={e => setFormData({ ...formData, roomName: e.target.value })}
                  placeholder="e.g. daily-standup"
                  className="w-full bg-surface border border-border rounded-lg p-2.5 focus:border-cyan-500/50 focus:outline-none"
                />
                <p className="text-xs text-muted-foreground mt-2">The room must be active for recording to start.</p>
              </div>
            )}


            {formData.type === "web" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Page URL</label>
                  <input
                    value={formData.url}
                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://example.com"
                    className="w-full bg-surface border border-border rounded-lg p-2.5 focus:border-cyan-500/50 focus:outline-none"
                  />
                  <p className="text-xs text-muted-foreground mt-2">A custom webpage URL to record.</p>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.audioOnly}
                      onChange={e => setFormData({ ...formData, audioOnly: e.target.checked, videoOnly: false })}
                      className="w-4 h-4 rounded border-border"
                    />
                    Audio Only
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.videoOnly}
                      onChange={e => setFormData({ ...formData, videoOnly: e.target.checked, audioOnly: false })}
                      className="w-4 h-4 rounded border-border"
                    />
                    Video Only
                  </label>
                </div>
              </>
            )}


            {formData.type === "track" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Room Name</label>
                  <input
                    value={formData.roomName}
                    onChange={e => setFormData({ ...formData, roomName: e.target.value })}
                    placeholder="e.g. daily-standup"
                    className="w-full bg-surface border border-white/10 rounded-lg p-2.5 focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Track SID</label>
                  <input
                    value={formData.trackSid}
                    onChange={e => setFormData({ ...formData, trackSid: e.target.value })}
                    placeholder="TR_xxxxx"
                    className="w-full bg-surface border border-border rounded-lg p-2.5 focus:border-cyan-500/50 focus:outline-none"
                  />
                  <p className="text-xs text-muted-foreground mt-2">Track SID from a participant (can be found in room details).</p>
                </div>
              </>
            )}


            {formData.type === "image" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Room Name</label>
                  <input
                    value={formData.roomName}
                    onChange={e => setFormData({ ...formData, roomName: e.target.value })}
                    placeholder="e.g. daily-standup"
                    className="w-full bg-surface border border-white/10 rounded-lg p-2.5 focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Width</label>
                    <input
                      type="number"
                      value={formData.width}
                      onChange={e => setFormData({ ...formData, width: parseInt(e.target.value) || 1920 })}
                      className="w-full bg-surface border border-border rounded-lg p-2.5 focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Height</label>
                    <input
                      type="number"
                      value={formData.height}
                      onChange={e => setFormData({ ...formData, height: parseInt(e.target.value) || 1080 })}
                      className="w-full bg-surface border border-border rounded-lg p-2.5 focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>
                </div>
              </>
            )}


            {formData.type !== "image" && (
              <div>
                <label className="block text-sm font-medium mb-2">Output Format</label>
                <select
                  value={formData.outputFormat}
                  onChange={e => setFormData({ ...formData, outputFormat: e.target.value })}
                  className="w-full bg-surface border border-border rounded-lg p-2.5 focus:border-cyan-500/50 focus:outline-none"
                >
                  <option value="mp4">MP4</option>
                  <option value="ogg">OGG</option>
                  <option value="webm">WebM</option>
                  {formData.audioOnly && <option value="mp3">MP3</option>}
                </select>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
