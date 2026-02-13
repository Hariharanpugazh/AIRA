"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
// DashboardLayout removed
import Header from "../../components/Header";
import { Card } from "../../../components/ui/Card";
import { Upload, RefreshCw, Globe, Video, Radio, Link2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { getAccessToken, getIngresses, createIngress, deleteIngress, User, Ingress, apiFetch } from "../../../lib/api";
import { Modal } from "../../../components/ui/Modal";
import Loader from "../../../components/ui/Loader";
import { Select } from "../../../components/ui/Select";
import { Plus, Trash2, Upload as UploadIcon } from "lucide-react";

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

export default function ProjectIngressesPage(props: any) {
  const router = useRouter();
  const [ingresses, setIngresses] = useState<Ingress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<IngressFormData>({
    name: "",
    type: "rtmp",
    url: "",
    roomName: "",
    participantIdentity: "",
    participantName: "",
    audioEnabled: true,
    videoEnabled: true,
  });

  const loadData = async () => {
    if (!getAccessToken()) { router.push("/login"); return; }
    try {
      const [i] = await Promise.all([getIngresses()]);
      setIngresses(i);
    } catch (e) {

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

  const handleCreate = async () => {
    if (!formData.name) return;
    setCreating(true);

    try {
      if (formData.type === "url") {
        // URL ingress uses different endpoint
        if (!formData.url || !formData.roomName) {
          alert("URL and Room Name are required for URL ingress");
          setCreating(false);
          return;
        }

        await apiFetch('/api/livekit/ingress/url', {
          method: 'POST',
          body: JSON.stringify({
            name: formData.name,
            url: formData.url,
            room_name: formData.roomName,
            participant_identity: formData.participantIdentity || `url-${Date.now()}`,
            participant_name: formData.participantName || formData.name,
            audio_enabled: formData.audioEnabled,
            video_enabled: formData.videoEnabled,
          }),
        });
        handleRefresh();
      } else {
        const newIngress = await createIngress(formData.name, formData.type as "rtmp" | "whip");
        setIngresses([newIngress, ...ingresses]);
      }

      setIsModalOpen(false);
      setFormData({
        name: "",
        type: "rtmp",
        url: "",
        roomName: "",
        participantIdentity: "",
        participantName: "",
        audioEnabled: true,
        videoEnabled: true,
      });
    } catch (e) {

      alert("Failed to create ingress: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete ingress?")) return;
    try {
      await deleteIngress(id);
      setIngresses(ingresses.filter(i => i.ingress_id !== id));
    } catch (e) {

    }
  };

  const getIngressTypeIcon = (type: string) => {
    switch (type) {
      case "rtmp": return <Video className="w-5 h-5 text-red-400" />;
      case "whip": return <Radio className="w-5 h-5 text-blue-400" />;
      case "url": return <Link2 className="w-5 h-5 text-green-400" />;
      default: return <UploadIcon className="w-5 h-5 text-primary" />;
    }
  };

  const ingressTypeOptions = [
    { value: "rtmp", label: "RTMP", description: "OBS, Streamlabs, etc.", icon: Video },
    { value: "whip", label: "WHIP", description: "WebRTC HTTP Ingest Protocol", icon: Radio },
    { value: "url", label: "URL", description: "HLS, MP4, MKV sources", icon: Link2 },
  ];

  if (loading) return <Loader message="Loading ingresses..." />;

  return (
    <>
      <Header projectName="AIRA" pageName="Ingress" showTimeRange={false}
        actionButton={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" onClick={() => setIsModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
              New Ingress
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-8">
        {ingresses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-surface/30 rounded-lg border border-border">
            <UploadIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <h2 className="text-foreground text-xl font-bold mb-2">No active ingresses</h2>
            <p className="text-muted-foreground text-sm mb-6">Create an ingress to stream media into a room.</p>
            <Button onClick={() => setIsModalOpen(true)}>Create Ingress</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ingresses.map((ingress) => (
              <Card key={ingress.ingress_id} variant="glass" className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 rounded bg-primary/10">
                    {getIngressTypeIcon(ingress.ingress_type)}
                  </div>
                  <button onClick={() => handleDelete(ingress.ingress_id)} className="text-red-500 hover:bg-red-500/10 p-1 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-medium text-foreground mb-1">{ingress.name}</h3>
                {ingress.url && (
                  <div className="text-xs text-secondary font-mono bg-muted p-2 rounded mb-2 break-all">
                    URL: {ingress.url}
                    {ingress.stream_key && <><br />Key: {ingress.stream_key}</>}
                  </div>
                )}
                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${ingress.ingress_type === "rtmp" ? "bg-red-500/10 text-red-400" :
                  ingress.ingress_type === "whip" ? "bg-blue-500/10 text-blue-400" :
                    ingress.ingress_type === "url" ? "bg-green-500/10 text-green-400" :
                      "bg-surface text-secondary"
                  }`}>{ingress.ingress_type}</span>
              </Card>
            ))}
          </div>
        )}

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Ingress"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </>
          }>
          <div className="space-y-5">

            <div>
              <label className="block text-sm font-medium mb-3">Ingress Type</label>
              <div className="grid grid-cols-3 gap-2">
                {ingressTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: option.value as IngressType })}
                    className={`p-3 rounded-lg border text-center transition-all ${formData.type === option.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/30 bg-surface/50"
                      }`}
                  >
                    <option.icon className={`w-5 h-5 mx-auto mb-2 ${formData.type === option.value ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="font-medium text-sm">{option.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>


            <div>
              <label className="block text-sm font-medium mb-2">Name *</label>
              <input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-surface border border-border rounded-lg p-2.5 focus:border-primary/50 focus:outline-none"
                placeholder="My Stream"
              />
            </div>


            {formData.type === "url" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Source URL *</label>
                  <input
                    value={formData.url}
                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                    className="w-full bg-surface border border-border rounded-lg p-2.5 focus:border-primary/50 focus:outline-none"
                    placeholder="https://example.com/stream.m3u8"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports HLS (.m3u8), MP4, MKV, WebM, and other media URLs
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Room Name *</label>
                  <input
                    value={formData.roomName}
                    onChange={e => setFormData({ ...formData, roomName: e.target.value })}
                    className="w-full bg-surface border border-border rounded-lg p-2.5 focus:border-primary/50 focus:outline-none"
                    placeholder="stream-room"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Participant Identity</label>
                    <input
                      value={formData.participantIdentity}
                      onChange={e => setFormData({ ...formData, participantIdentity: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg p-2.5 focus:border-primary/50 focus:outline-none"
                      placeholder="url-stream"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Participant Name</label>
                    <input
                      value={formData.participantName}
                      onChange={e => setFormData({ ...formData, participantName: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg p-2.5 focus:border-primary/50 focus:outline-none"
                      placeholder="URL Stream"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.audioEnabled}
                      onChange={e => setFormData({ ...formData, audioEnabled: e.target.checked })}
                      className="w-4 h-4 rounded border-border"
                    />
                    Enable Audio
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.videoEnabled}
                      onChange={e => setFormData({ ...formData, videoEnabled: e.target.checked })}
                      className="w-4 h-4 rounded border-border"
                    />
                    Enable Video
                  </label>
                </div>
              </>
            )}


            {formData.type !== "url" && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-300">
                  {formData.type === "rtmp"
                    ? "RTMP ingress will provide a stream URL and key for OBS, Streamlabs, and similar tools."
                    : "WHIP ingress enables browser-based streaming using WebRTC."
                  }
                </p>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </>
  );
}
