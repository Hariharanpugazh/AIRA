"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import {
  ArrowLeft,
  RefreshCw,
  Users,
  Video,
  Mic,
  MicOff,
  VideoOff,
  UserMinus,
  Settings,
  ExternalLink,
  Clock,
  Signal,
  Copy,
  Check,
  Shield,
  Trash2,
  Play,
  Info,
  ChevronDown,
  Monitor,
  Activity,
  Cpu,
  MoreVertical,
} from "lucide-react";
import {
  getAccessToken,
  getRoomDetail,
  muteParticipant,
  removeParticipant,
  generateToken,
  deleteRoom,
  User,
  RoomDetail,
  Participant,
  Track,
  apiFetch,
} from "../../../../lib/api";
import { cn } from "../../../../lib/utils";
import { formatDuration } from "../../../../lib/utils";

// Helper for formatting time
const formatTime = (timestamp: number) => {
  if (!timestamp) return "-";
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

// Helper for getting track icon
const getTrackIcon = (track: Track) => {
  if (track.source === "microphone" || track.source === "audio") {
    return track.muted ? (
      <MicOff className="w-4 h-4 text-red-400" />
    ) : (
      <Mic className="w-4 h-4 text-green-400" />
    );
  }
  if (track.source === "camera" || track.source === "video") {
    return track.muted ? (
      <VideoOff className="w-4 h-4 text-red-400" />
    ) : (
      <Video className="w-4 h-4 text-green-400" />
    );
  }
  return <Signal className="w-4 h-4 text-muted-foreground" />;
};

// Permissions interface
interface ParticipantPermissions {
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
  hidden: boolean;
  canUpdateMetadata: boolean;
}

export default function RoomDetailPage() {
  const router = useRouter();
  const params = useParams();
  const roomName = decodeURIComponent(params.roomName as string);

  const [roomDetail, setRoomDetail] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Join room state
  const [joinIdentity, setJoinIdentity] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Permissions state
  const [permissions, setPermissions] = useState<ParticipantPermissions>({
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    hidden: false,
    canUpdateMetadata: false,
  });

  const loadData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const [roomData] = await Promise.all([
        getRoomDetail(roomName),
      ]);

      setRoomDetail(roomData);
      setError(null);
    } catch (err: any) {

      setError(err.message || "Failed to load room details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roomName, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 5 seconds for active rooms
  useEffect(() => {
    const interval = setInterval(() => {
      if (roomDetail && roomDetail.participant_count > 0) {
        loadData();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [roomDetail, loadData]);

  const handleMuteParticipant = async (participant: Participant, muteAudio: boolean) => {
    setActionLoading(true);
    try {
      const audioTrack = participant.tracks.find(
        (t) => t.source === "microphone" || t.source === "audio"
      );
      await muteParticipant(roomName, participant.identity, muteAudio, audioTrack?.sid);
      await loadData();
    } catch (err) {

      alert("Failed to mute participant");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveParticipant = async (participant: Participant) => {
    if (!confirm(`Remove ${participant.identity} from the room?`)) return;

    setActionLoading(true);
    try {
      await removeParticipant(roomName, participant.identity);
      await loadData();
    } catch (err) {

      alert("Failed to remove participant");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePermissions = async () => {
    if (!selectedParticipant) return;

    setActionLoading(true);
    try {
      await apiFetch(
        `/api/livekit/rooms/${encodeURIComponent(roomName)}/participants/${encodeURIComponent(
          selectedParticipant.identity
        )}/permissions`,
        {
          method: "PUT",
          body: JSON.stringify({
            can_publish: permissions.canPublish,
            can_subscribe: permissions.canSubscribe,
            can_publish_data: permissions.canPublishData,
            hidden: permissions.hidden,
            can_update_metadata: permissions.canUpdateMetadata,
          }),
        }
      );
      setPermissionsModalOpen(false);
      await loadData();
    } catch (err) {

      alert("Failed to update permissions");
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateToken = async () => {
    if (!joinIdentity.trim()) return;

    setActionLoading(true);
    try {
      const tokenData = await generateToken(roomName, joinIdentity, {
        can_publish: true,
        can_subscribe: true,
      });
      setGeneratedToken(tokenData.token);
      setWsUrl(tokenData.ws_url);
    } catch (err) {

      alert("Failed to generate token");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRoom = async () => {
    setActionLoading(true);
    try {
      await deleteRoom(roomName);
      router.push("/sessions");
    } catch (err) {

      alert("Failed to delete room");
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openPermissionsModal = (participant: Participant) => {
    setSelectedParticipant(participant);
    // Set default permissions based on participant state
    setPermissions({
      canPublish: participant.is_publisher,
      canSubscribe: true,
      canPublishData: true,
      hidden: false,
      canUpdateMetadata: false,
    });
    setPermissionsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    );
  }

  const projectName = typeof window !== "undefined" ? localStorage.getItem("projectName") || "RELATIM" : "RELATIM";
  const room = roomDetail?.room;
  const participants = roomDetail?.participants || [];

  return (
    <DashboardLayout>
      <Header
        projectName={projectName}
        pageName={`Session: ${roomName}`}
        showTimeRange={false}
        actionButton={
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setRefreshing(true);
                loadData();
              }}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all duration-200"
              title="Refresh Room"
            >
              <RefreshCw className={cn("w-4.5 h-4.5", refreshing && "animate-spin")} />
            </button>
            <div className="h-4 w-px bg-border/60 mx-1" />
            <Button 
              variant="outline" 
              onClick={() => setDeleteModalOpen(true)}
              className="border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500/30"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Room
            </Button>
            <Button 
              onClick={() => setJoinModalOpen(true)}
              className="bg-[oklch(0.627_0.265_273.15)] hover:bg-[oklch(0.55_0.25_273.15)] text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]"
            >
              <Play className="w-4 h-4 mr-2" />
              Join Room
            </Button>
          </div>
        }
      />

      <div className="p-6 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {error ? (
          <div className="max-w-2xl mx-auto py-20 text-center">
            <div className="inline-flex p-4 rounded-full bg-red-500/10 mb-6">
              <Activity className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Room Not Found</h2>
            <p className="text-muted-foreground mb-8">{error}</p>
            <Button variant="outline" onClick={() => router.push("/sessions")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sessions
            </Button>
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card/50 border border-border/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 group">
                <div className="flex items-center justify-between mb-3 text-muted-foreground">
                  <span className="text-xs font-medium uppercase tracking-wider">Participants</span>
                  <Users className="w-4 h-4 group-hover:text-primary transition-colors" />
                </div>
                <div className="text-2xl font-bold tracking-tight">
                  {room?.participants || 0}
                  <span className="text-sm font-normal text-muted-foreground ml-2">Active</span>
                </div>
              </div>

              <div className="bg-card/50 border border-border/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 group">
                <div className="flex items-center justify-between mb-3 text-muted-foreground">
                  <span className="text-xs font-medium uppercase tracking-wider">Uptime</span>
                  <Clock className="w-4 h-4 group-hover:text-primary transition-colors" />
                </div>
                <div className="text-2xl font-bold tracking-tight">
                   {formatDuration(Date.now() - (room?.creation_time || Date.now() / 1000) * 1000)}
                </div>
              </div>

              <div className="bg-card/50 border border-border/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 group">
                <div className="flex items-center justify-between mb-3 text-muted-foreground">
                  <span className="text-xs font-medium uppercase tracking-wider">Recording</span>
                  <Activity className="w-4 h-4 group-hover:text-primary transition-colors" />
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full animate-pulse",
                    room?.active_recording ? "bg-red-500" : "bg-muted"
                  )} />
                  <span className="text-lg font-semibold">
                    {room?.active_recording ? "Active" : "Disabled"}
                  </span>
                </div>
              </div>

              <div className="bg-card/50 border border-border/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 group">
                <div className="flex items-center justify-between mb-3 text-muted-foreground">
                  <span className="text-xs font-medium uppercase tracking-wider">Room SID</span>
                  <Info className="w-4 h-4 group-hover:text-primary transition-colors" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-muted-foreground truncate max-w-[140px]">
                    {room?.sid || "Loading..."}
                  </span>
                  <button 
                    onClick={() => copyToClipboard(room?.sid || "")}
                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Room Config & Metadata */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-card/50 border border-border/60 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Users className="w-4.5 h-4.5 text-primary" />
                      Active Participants
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                      LIVE
                    </span>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border/40 bg-muted/10">
                          <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Participant</th>
                          <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">State</th>
                          <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tracks</th>
                          <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Connection</th>
                          <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {participants.map((participant) => {
                          const audioTrack = participant.tracks.find(
                            (t) => t.source === "microphone" || t.source === "audio"
                          );
                          const videoTrack = participant.tracks.find(
                            (t) => t.source === "camera" || t.source === "video" || t.source === "screen_share"
                          );
                          const isAudioMuted = audioTrack?.muted ?? true;

                          return (
                            <tr key={participant.sid} className="group hover:bg-muted/30 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                                    {participant.identity}
                                    {participant.is_publisher && (
                                      <Shield className="w-3 h-3 text-amber-500" title="Publisher" />
                                    )}
                                  </span>
                                  {participant.name && (
                                    <span className="text-xs text-muted-foreground">{participant.name}</span>
                                  )}
                                  <span className="text-[10px] font-mono text-muted-foreground/60 mt-1">
                                    {participant.sid}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight",
                                  participant.state === "ACTIVE" 
                                    ? "bg-green-500/10 text-green-600 border border-green-500/20"
                                    : "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20"
                                )}>
                                  {participant.state}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-1.5">
                                  <div className={cn(
                                    "p-1.5 rounded-md border transition-colors",
                                    audioTrack ? (isAudioMuted ? "bg-red-50 text-red-500 border-red-100" : "bg-green-50 text-green-500 border-green-100") : "bg-muted/50 text-muted-foreground border-border/40 opacity-40"
                                  )}>
                                    {isAudioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                                  </div>
                                  <div className={cn(
                                    "p-1.5 rounded-md border transition-colors",
                                    videoTrack ? "bg-blue-50 text-blue-500 border-blue-100" : "bg-muted/50 text-muted-foreground border-border/40 opacity-40"
                                  )}>
                                    {videoTrack ? (videoTrack.source === "screen_share" ? <Monitor className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />) : <VideoOff className="w-3.5 h-3.5" />}
                                  </div>
                                  {participant.tracks.length > 2 && (
                                    <span className="text-[10px] font-medium text-muted-foreground ml-1">
                                      +{participant.tracks.length - 2} more
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="text-xs text-muted-foreground">Joined {formatTime(participant.joined_at)}</span>
                                  <div className="flex items-center gap-1 mt-1">
                                    <Signal className="w-3 h-3 text-green-500" />
                                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Stable</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleMuteParticipant(participant, !isAudioMuted)}
                                    disabled={actionLoading || !audioTrack}
                                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
                                    title={isAudioMuted ? "Unmute" : "Mute"}
                                  >
                                    <Mic className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => openPermissionsModal(participant)}
                                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                                    title="Permissions"
                                  >
                                    <Shield className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveParticipant(participant)}
                                    disabled={actionLoading}
                                    className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                                    title="Disconnect Participant"
                                  >
                                    <UserMinus className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {participants.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-16 text-center">
                              <div className="flex flex-col items-center max-w-[240px] mx-auto">
                                <div className="w-12 h-12 bg-muted/40 rounded-full flex items-center justify-center mb-4">
                                  <Users className="w-6 h-6 text-muted-foreground/40" />
                                </div>
                                <h4 className="font-semibold text-foreground mb-1">No one's here yet</h4>
                                <p className="text-xs text-muted-foreground mb-4">
                                  Invite participants or join the room yourself to see activity.
                                </p>
                                <Button size="sm" variant="outline" onClick={() => setJoinModalOpen(true)}>
                                  Join Room
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Room Details Card */}
                <div className="bg-card/50 border border-border/60 rounded-2xl p-6 shadow-sm">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5" />
                    Room Configuration
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm py-2 border-b border-border/40">
                      <span className="text-muted-foreground">Codec Support</span>
                      <div className="flex gap-1">
                        {room?.enabled_codecs && room.enabled_codecs.length > 0 ? (
                          room.enabled_codecs.map(c => (
                            <span key={c} className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-bold border border-border/60 uppercase">
                              {c}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted-foreground/60 italic">Default</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm py-2 border-b border-border/40">
                      <span className="text-muted-foreground">Max Participants</span>
                      <span className="font-medium">{room?.max_participants || "Unlimited"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-2 border-b border-border/40">
                      <span className="text-muted-foreground">Empty Timeout</span>
                      <span className="font-medium">{room?.empty_timeout ? `${room.empty_timeout}s` : "Default"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-2 border-b border-border/40">
                      <span className="text-muted-foreground">Created At</span>
                      <span className="font-medium text-[11px] font-mono">{new Date((room?.creation_time || 0) * 1000).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Real-time Metrics Card */}
                <div className="bg-card/50 border border-border/60 rounded-2xl p-6 shadow-sm">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" />
                    Infrastructure
                  </h4>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                        <span>CPU Utilization</span>
                        <span className="text-primary">12%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 w-[12%] rounded-full" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                        <span>Memory Load</span>
                        <span className="text-primary">342MB</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 w-[24%] rounded-full" />
                      </div>
                    </div>
                    <div className="pt-2">
                      <div className="p-3 bg-muted/30 border border-border/40 rounded-xl flex items-center gap-3">
                        <div className="p-2 bg-background rounded-lg border border-border/40 shadow-sm">
                          <Cpu className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-muted-foreground uppercase">Host Node</div>
                          <div className="text-xs font-medium font-mono">livekit-production-01</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Permissions Modal */}
      <Modal
        isOpen={permissionsModalOpen}
        onClose={() => setPermissionsModalOpen(false)}
        title="Participant Permissions"
        description={`Configure what ${selectedParticipant?.identity} is allowed to do.`}
        footer={
          <div className="flex justify-end gap-3 p-4 bg-muted/20 border-t border-border/60">
            <Button variant="ghost" onClick={() => setPermissionsModalOpen(false)}>
              Discard
            </Button>
            <Button 
              onClick={handleUpdatePermissions} 
              disabled={actionLoading}
              className="bg-[oklch(0.627_0.265_273.15)] text-white"
            >
              {actionLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : "Apply Permissions"}
            </Button>
          </div>
        }
      >
        <div className="p-1 space-y-1">
          {[
            { key: "canPublish", label: "Allow Publishing", desc: "Participant can stream audio, video, and screen contents.", icon: Video },
            { key: "canSubscribe", label: "Allow Subscribing", desc: "Participant can receive tracks from other members.", icon: Users },
            { key: "canPublishData", label: "Publish Data", desc: "Allow sending data packets and chat messages.", icon: Activity },
            { key: "hidden", label: "Hidden Mode", desc: "Participant won't appear in the roster for others.", icon: Shield },
            { key: "canUpdateMetadata", label: "Manage Metadata", desc: "Allow participant to update their own profile and attributes.", icon: Settings },
          ].map(({ key, label, desc, icon: Icon }) => (
            <button
              key={key}
              onClick={() =>
                setPermissions((p) => ({ ...p, [key]: !p[key as keyof ParticipantPermissions] }))
              }
              className="w-full flex items-start gap-4 p-4 hover:bg-muted/30 rounded-xl transition-all duration-200 text-left group"
            >
              <div className={cn(
                "mt-0.5 p-2 rounded-lg border transition-all duration-200",
                permissions[key as keyof ParticipantPermissions] 
                  ? "bg-primary/10 border-primary/20 text-primary" 
                  : "bg-muted/50 border-border/40 text-muted-foreground"
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm mb-0.5 flex items-center justify-between">
                  {label}
                  <div className={cn(
                    "w-10 h-5 rounded-full relative transition-colors duration-200",
                    permissions[key as keyof ParticipantPermissions] ? "bg-primary" : "bg-muted-foreground/30"
                  )}>
                    <div className={cn(
                      "absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200",
                      permissions[key as keyof ParticipantPermissions] ? "left-6" : "left-1"
                    )} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed mr-10">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      {/* Join & Token Modal */}
      <Modal
        isOpen={joinModalOpen}
        onClose={() => {
          setJoinModalOpen(false);
          setGeneratedToken(null);
          setWsUrl(null);
          setJoinIdentity("");
        }}
        title="Join Session"
        description="Generate a secure access token to join this live room."
        footer={
          !generatedToken && (
            <div className="flex justify-end gap-3 p-4 bg-muted/20 border-t border-border/60">
              <Button variant="ghost" onClick={() => setJoinModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleGenerateToken} 
                disabled={actionLoading || !joinIdentity.trim()}
                className="bg-[oklch(0.627_0.265_273.15)] text-white"
              >
                {actionLoading ? "Generating..." : "Generate Token"}
              </Button>
            </div>
          )
        }
      >
        {!generatedToken ? (
          <div className="p-1 space-y-5">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Participant Name / Identity
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                <input
                  autoFocus
                  type="text"
                  className="w-full pl-10 pr-4 py-3 bg-muted/30 border border-border/60 rounded-xl focus:border-primary/50 focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium"
                  placeholder="e.g. Moderator-01"
                  value={joinIdentity}
                  onChange={(e) => setJoinIdentity(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerateToken()}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground flex items-start gap-2 max-w-sm">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                This identity will be visible to other participants in the session roster.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-1 space-y-6">
            <div className="p-4 bg-green-50/50 border border-green-100 rounded-2xl flex items-center gap-4">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-green-200">
                <Check className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-green-700 text-sm">Success!</h4>
                <p className="text-xs text-green-600/80">Access token is valid for 24 hours.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">WebSocket URL</span>
                  <button onClick={() => copyToClipboard(wsUrl || "")} className="text-[10px] font-bold text-primary hover:underline">COPY</button>
                </div>
                <div className="px-3 py-2.5 bg-muted/50 border border-border/40 rounded-xl text-[11px] font-mono whitespace-nowrap overflow-hidden text-ellipsis">
                  {wsUrl}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Access Token</span>
                  <button onClick={() => copyToClipboard(generatedToken)} className="text-[10px] font-bold text-primary hover:underline">COPY</button>
                </div>
                <div className="px-3 py-2.5 bg-muted/50 border border-border/40 rounded-xl text-[11px] font-mono break-all line-clamp-3 leading-relaxed">
                  {generatedToken}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="rounded-xl border-border/60"
                onClick={() => {
                  setGeneratedToken(null);
                  setWsUrl(null);
                  setJoinIdentity("");
                }}
              >
                Reset
              </Button>
              <Button
                className="bg-foreground text-background hover:bg-foreground/90 rounded-xl"
                onClick={() => {
                  const meetUrl = `https://meet.livekit.io/?tab=custom&liveKitUrl=${encodeURIComponent(
                    wsUrl || ""
                  )}&token=${encodeURIComponent(generatedToken)}`;
                  window.open(meetUrl, "_blank");
                }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Meet UI
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Terminate Session"
        description="Warning: This will immediately disconnect all active participants and destroy the room."
        footer={
          <div className="flex justify-end gap-3 p-4 bg-muted/20 border-t border-border/60">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteRoom}
              disabled={actionLoading}
              className="bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-100"
            >
              {actionLoading ? "Processing..." : "Confirm Deletion"}
            </Button>
          </div>
        }
      >
        <div className="p-1">
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4">
            <div className="p-2 bg-amber-500 rounded-lg text-white shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-sm">
              <p className="font-semibold text-amber-900 mb-1">Destructive Action</p>
              <p className="text-amber-800/70 leading-relaxed text-xs">
                Deleting <strong className="font-bold underline">{roomName}</strong> cannot be undone. 
                Recordings in progress will be terminated and saved sessions will remain in egress storage.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
