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
        pageName={`Room: ${roomName}`}
        showTimeRange={false}
        actionButton={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setRefreshing(true);
                loadData();
              }}
              className="text-muted-foreground"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" onClick={() => setDeleteModalOpen(true)} className="text-red-400 hover:text-red-300">
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button onClick={() => setJoinModalOpen(true)}>
              <Play className="w-4 h-4 mr-2" />
              Join Room
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-8 animate-fade-in space-y-6">
        {error ? (
          <Card className="p-8 text-center">
            <div className="text-red-400 mb-4">{error}</div>
            <Button variant="ghost" onClick={() => router.push("/sessions")}>
              Back to Sessions
            </Button>
          </Card>
        ) : (
          <>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Room SID</div>
                <div className="text-sm font-mono text-foreground truncate">{room?.sid || "-"}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Participants</div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <span className="text-2xl font-bold text-foreground">{room?.participants || 0}</span>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Created</div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{formatTime(room?.creation_time || 0)}</span>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Recording</div>
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${room?.active_recording
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : "bg-surface text-muted-foreground border-border"
                  }`}>
                  {room?.active_recording ? "● Recording" : "Not Recording"}
                </div>
              </Card>
            </div>


            {room?.enabled_codecs && room.enabled_codecs.length > 0 && (
              <Card className="p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Enabled Codecs</div>
                <div className="flex gap-2 flex-wrap">
                  {room.enabled_codecs.map((codec) => (
                    <span
                      key={codec}
                      className="px-2 py-1 bg-surface border border-border rounded text-xs text-foreground"
                    >
                      {codec}
                    </span>
                  ))}
                </div>
              </Card>
            )}


            <Card className="overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="font-medium text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Participants ({participants.length})
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-background/50 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-medium">Identity</th>
                      <th className="px-6 py-4 font-medium">State</th>
                      <th className="px-6 py-4 font-medium">Joined</th>
                      <th className="px-6 py-4 font-medium">Tracks</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {participants.map((participant) => {
                      const audioTrack = participant.tracks.find(
                        (t) => t.source === "microphone" || t.source === "audio"
                      );
                      const isAudioMuted = audioTrack?.muted ?? true;

                      return (
                        <tr key={participant.sid} className="group hover:bg-surface-hover transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-foreground">{participant.identity}</div>
                            {participant.name && participant.name !== participant.identity && (
                              <div className="text-xs text-muted-foreground">{participant.name}</div>
                            )}
                            <div className="text-xs text-muted-foreground font-mono mt-0.5 opacity-60">
                              {participant.sid}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium border ${participant.state === "ACTIVE"
                                ? "bg-green-500/10 text-green-400 border-green-500/20"
                                : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                }`}
                            >
                              {participant.state}
                            </span>
                            {participant.is_publisher && (
                              <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px]">
                                Publisher
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                            {formatTime(participant.joined_at)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              {participant.tracks.length > 0 ? (
                                participant.tracks.map((track) => (
                                  <div
                                    key={track.sid}
                                    className="flex items-center gap-1 px-2 py-1 bg-surface rounded border border-border"
                                    title={`${track.source} - ${track.mime_type}`}
                                  >
                                    {getTrackIcon(track)}
                                    <span className="text-xs text-muted-foreground">{track.source}</span>
                                  </div>
                                ))
                              ) : (
                                <span className="text-muted-foreground/50 text-xs">No tracks</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMuteParticipant(participant, !isAudioMuted)}
                                disabled={actionLoading || !audioTrack}
                                title={isAudioMuted ? "Unmute" : "Mute"}
                              >
                                {isAudioMuted ? (
                                  <MicOff className="w-4 h-4 text-red-400" />
                                ) : (
                                  <Mic className="w-4 h-4 text-green-400" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openPermissionsModal(participant)}
                                title="Permissions"
                              >
                                <Shield className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveParticipant(participant)}
                                disabled={actionLoading}
                                className="text-red-400 hover:text-red-300"
                                title="Remove"
                              >
                                <UserMinus className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {participants.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-3">
                            <div className="p-3 rounded-full bg-surface">
                              <Users className="w-6 h-6 opacity-30" />
                            </div>
                            <span>No participants in this room</span>
                            <Button variant="ghost" size="sm" onClick={() => setJoinModalOpen(true)}>
                              Join Room
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>


      <Modal
        isOpen={permissionsModalOpen}
        onClose={() => setPermissionsModalOpen(false)}
        title={`Permissions: ${selectedParticipant?.identity}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPermissionsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePermissions} disabled={actionLoading}>
              {actionLoading ? "Updating..." : "Update Permissions"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {[
            { key: "canPublish", label: "Can Publish", desc: "Allow publishing audio/video tracks" },
            { key: "canSubscribe", label: "Can Subscribe", desc: "Allow subscribing to other participants" },
            { key: "canPublishData", label: "Can Publish Data", desc: "Allow sending data messages" },
            { key: "hidden", label: "Hidden", desc: "Hide participant from others" },
            { key: "canUpdateMetadata", label: "Can Update Metadata", desc: "Allow updating own metadata" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border">
              <div>
                <div className="font-medium text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
              <button
                onClick={() =>
                  setPermissions((p) => ({ ...p, [key]: !p[key as keyof ParticipantPermissions] }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${permissions[key as keyof ParticipantPermissions]
                  ? "bg-primary"
                  : "bg-surface-hover"
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${permissions[key as keyof ParticipantPermissions]
                    ? "translate-x-6"
                    : "translate-x-1"
                    }`}
                />
              </button>
            </div>
          ))}
        </div>
      </Modal>


      <Modal
        isOpen={joinModalOpen}
        onClose={() => {
          setJoinModalOpen(false);
          setGeneratedToken(null);
          setWsUrl(null);
          setJoinIdentity("");
        }}
        title="Join Room"
        footer={
          !generatedToken && (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setJoinModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerateToken} disabled={actionLoading || !joinIdentity.trim()}>
                {actionLoading ? "Generating..." : "Generate Token"}
              </Button>
            </div>
          )
        }
      >
        {!generatedToken ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                Participant Identity
              </label>
              <input
                autoFocus
                type="text"
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                placeholder="e.g. test-user"
                value={joinIdentity}
                onChange={(e) => setJoinIdentity(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerateToken()}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Generate a token to join the room. You can use this token with the LiveKit client SDK or
              copy the connection details.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <Check className="w-4 h-4" />
                <span className="font-medium">Token Generated!</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Use these details to connect to the room
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">
                WebSocket URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={wsUrl || ""}
                  className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm font-mono"
                />
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(wsUrl || "")}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">
                Access Token
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedToken}
                  className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm font-mono truncate"
                />
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedToken)}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setGeneratedToken(null);
                  setWsUrl(null);
                  setJoinIdentity("");
                }}
              >
                Generate Another
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  const meetUrl = `https://meet.livekit.io/?tab=custom&liveKitUrl=${encodeURIComponent(
                    wsUrl || ""
                  )}&token=${encodeURIComponent(generatedToken)}`;
                  window.open(meetUrl, "_blank");
                }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in LiveKit Meet
              </Button>
            </div>
          </div>
        )}
      </Modal>


      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Room"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteRoom}
              disabled={actionLoading}
              className="bg-red-500 hover:bg-red-600"
            >
              {actionLoading ? "Deleting..." : "Delete Room"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Are you sure you want to delete the room <strong className="text-foreground">{roomName}</strong>?
          </p>
          <p className="text-sm text-red-400">
            This will disconnect all participants and cannot be undone.
          </p>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
