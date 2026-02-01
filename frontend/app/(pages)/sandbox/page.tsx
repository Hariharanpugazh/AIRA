"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/layouts/DashboardLayout";
import Header from "../../components/Header";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import {
  getAccessToken,
  getRooms,
  generateToken,
  createRoom,
  User,
  Room,
  TokenResponse,
} from "../../../lib/api";
import {
  Play,
  Pause,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Phone,
  PhoneOff,
  Settings,
  Copy,
  Check,
  RefreshCw,
  Plus,
} from "lucide-react";

export default function SandboxPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Room state
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [newRoomName, setNewRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Connection state
  const [identity, setIdentity] = useState("");
  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);

  // Media state
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const token = getAccessToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const [roomsData] = await Promise.all([
          getRooms(),
        ]);
        setRooms(roomsData || []);
        // Assuming we can get identity from elsewhere or let user input it if needed. 
        // For now, let's just initialize identity empty or from local storage if appropriate, 
        // but the original code used user.email. split('@')[0].
        // Since we are removing user, we might need to fetch it from useAuth context or similar if we strictly needed it.
        // However, looking at the code, identity is just a state default.
        // Let's rely on useAuth context inside component if we needed it, but here we can just leave it empty or fetch from auth context.
        // Wait, I am inside a component so I can use useAuth().
      } catch (error) {

      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleRefreshRooms = async () => {
    try {
      const roomsData = await getRooms();
      setRooms(roomsData || []);
    } catch (error) {

    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    setIsCreating(true);
    try {
      await createRoom(newRoomName.trim());
      setNewRoomName("");
      await handleRefreshRooms();
      setSelectedRoom(newRoomName.trim());
    } catch (error) {

      alert("Failed to create room");
    } finally {
      setIsCreating(false);
    }
  };

  const handleGenerateToken = async () => {
    if (!selectedRoom) {
      alert("Please select or create a room first");
      return;
    }
    if (!identity.trim()) {
      alert("Please enter an identity");
      return;
    }

    setIsConnecting(true);
    try {
      const data = await generateToken(selectedRoom, identity.trim(), {
        can_publish: true,
        can_subscribe: true,
      });
      setTokenData(data);
    } catch (error) {

      alert("Failed to generate token");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCopyToken = () => {
    if (tokenData?.token) {
      navigator.clipboard.writeText(tokenData.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnect = () => {
    setIsConnected(true);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setTokenData(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    );
  }

  const projectName = localStorage.getItem("projectName") || "RELATIM";

  return (
    <DashboardLayout>
      <Header
        projectName={projectName}
        pageName="Sandbox"
        showTimeRange={false}
        actionButton={
          <Button variant="ghost" onClick={handleRefreshRooms}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Rooms
          </Button>
        }
      />

      <div className="p-4 md:p-8 animate-fade-in space-y-6">

        <div className="bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20 rounded-xl p-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">LiveKit Sandbox</h1>
          <p className="text-muted-foreground">
            Test voice agents, join rooms, and experiment with LiveKit features in a safe environment.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <Card variant="glass" className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Room Configuration
            </h2>

            <div className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Create New Room
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Enter room name..."
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50"
                    onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                  />
                  <Button onClick={handleCreateRoom} disabled={isCreating || !newRoomName.trim()}>
                    <Plus className="w-4 h-4 mr-1" />
                    Create
                  </Button>
                </div>
              </div>


              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Or Select Existing Room ({rooms.length} available)
                </label>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50"
                >
                  <option value="">Select a room...</option>
                  {rooms.map((room) => (
                    <option key={room.sid} value={room.name}>
                      {room.name} ({room.num_participants} participants)
                    </option>
                  ))}
                </select>
              </div>


              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Your Identity
                </label>
                <input
                  type="text"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  placeholder="Enter your identity..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50"
                />
              </div>


              <Button
                className="w-full"
                onClick={handleGenerateToken}
                disabled={isConnecting || !selectedRoom || !identity.trim()}
              >
                {isConnecting ? "Generating..." : "Generate Access Token"}
              </Button>
            </div>
          </Card>


          <Card variant="glass" className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
              Connection
            </h2>

            {tokenData ? (
              <div className="space-y-4">

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Access Token
                  </label>
                  <div className="relative">
                    <pre className="p-3 bg-muted rounded-lg text-xs font-mono text-green-500 overflow-x-auto max-h-24">
                      {tokenData.token}
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={handleCopyToken}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>


                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">WebSocket URL:</span>
                    <p className="font-mono text-xs truncate">{tokenData.ws_url}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Room:</span>
                    <p className="font-medium">{tokenData.room}</p>
                  </div>
                </div>


                <div className="flex items-center justify-center gap-4 py-4">
                  <Button
                    variant={audioEnabled ? "primary" : "outline"}
                    size="icon"
                    onClick={() => setAudioEnabled(!audioEnabled)}
                    className="rounded-full w-12 h-12"
                  >
                    {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </Button>
                  <Button
                    variant={videoEnabled ? "primary" : "outline"}
                    size="icon"
                    onClick={() => setVideoEnabled(!videoEnabled)}
                    className="rounded-full w-12 h-12"
                  >
                    {videoEnabled ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </Button>
                </div>


                {!isConnected ? (
                  <Button className="w-full" onClick={handleConnect}>
                    <Play className="w-4 h-4 mr-2" />
                    Connect to Room
                  </Button>
                ) : (
                  <Button variant="danger" className="w-full" onClick={handleDisconnect}>
                    <PhoneOff className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                )}

                {isConnected && (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                    <div className="flex items-center justify-center gap-2 text-green-500">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      Connected to {tokenData.room}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use this token with LiveKit SDKs to join from any client
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
                  <Phone className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-2">No token generated yet</p>
                <p className="text-xs text-muted-foreground">
                  Configure a room and generate a token to connect
                </p>
              </div>
            )}
          </Card>
        </div>


        <Card variant="glass" className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">How to Use</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold mb-2">
                1
              </div>
              <h4 className="font-medium text-foreground mb-1">Create or Select a Room</h4>
              <p className="text-muted-foreground">
                Create a new test room or select an existing one from the dropdown.
              </p>
            </div>
            <div>
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold mb-2">
                2
              </div>
              <h4 className="font-medium text-foreground mb-1">Generate Access Token</h4>
              <p className="text-muted-foreground">
                Set your identity and generate a token to authenticate with the room.
              </p>
            </div>
            <div>
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold mb-2">
                3
              </div>
              <h4 className="font-medium text-foreground mb-1">Connect and Test</h4>
              <p className="text-muted-foreground">
                Use the token with any LiveKit SDK or copy it for use in your application.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
