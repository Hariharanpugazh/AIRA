"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/layouts/DashboardLayout";
import Header from "../../components/Header";
import { Card } from "../../../components/ui/Card";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { getAccessToken, getMe, getEgresses, stopEgress, startRoomEgress, User, Egress } from "../../../lib/api";
import { Modal } from "../../../components/ui/Modal";
import { Plus, Download as DownloadIcon, Radio, StopCircle } from "lucide-react";

export default function EgressesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [egresses, setEgresses] = useState<Egress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roomName, setRoomName] = useState("");

  const loadData = async () => {
    if (!getAccessToken()) { router.push("/login"); return; }
    try {
      const [u, e] = await Promise.all([getMe(), getEgresses()]);
      setUser(u);
      setEgresses(e);
    } catch (err) {
      console.error(err);
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
    if (!roomName) return;
    try {
      await startRoomEgress(roomName);
      handleRefresh();
      setIsModalOpen(false);
      setRoomName("");
    } catch (e) {
      alert("Failed to start egress. Ensure room exists.");
    }
  };

  const handleStop = async (id: string) => {
    if (!confirm("Stop this egress?")) return;
    try {
      await stopEgress(id);
      handleRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading || !user) return null;

  return (
    <DashboardLayout user={user}>
      <Header projectName="RELATIM" pageName="Egress" showTimeRange={false}
        actionButton={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={handleRefresh} leftIcon={<RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />}>
              Refresh
            </Button>
            <Button size="sm" onClick={() => setIsModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
              Start Recording
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-8">
        {egresses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-surface/30 rounded-lg border border-white/5">
            <DownloadIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <h2 className="text-foreground text-xl font-bold mb-2">No active egresses</h2>
            <p className="text-muted-foreground text-sm mb-6">Start a recording for an active room.</p>
            <Button onClick={() => setIsModalOpen(true)}>Start Recording</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {egresses.map((egress) => (
              <Card key={egress.egress_id} variant="glass" className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <DownloadIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${egress.status === "starting" ? "bg-yellow-500/10 text-yellow-500" : egress.status === "active" ? "bg-green-500/10 text-green-500" : "bg-white/10 text-secondary"}`}>
                      {egress.status}
                    </span>
                    {(egress.status === "active" || egress.status === "starting") && (
                      <button onClick={() => handleStop(egress.egress_id)} className="text-red-500 hover:bg-red-500/10 p-1 rounded">
                        <StopCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="font-medium text-foreground mb-1">{egress.room_name}</h3>
                <p className="text-xs text-secondary font-mono truncate">{egress.egress_id}</p>
                {egress.file_url && <a href={egress.file_url} target="_blank" className="text-xs text-[#00d4aa] mt-2 block hover:underline">Download Recording</a>}
              </Card>
            ))}
          </div>
        )}

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Start Room Recording"
          footer={<><Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button><Button onClick={handleStart}>Start</Button></>}>
          <div className="space-y-4">
            <label className="block text-sm font-medium">Room Name</label>
            <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="e.g. daily-standup" className="w-full bg-surface border border-white/10 rounded p-2" />
            <p className="text-xs text-secondary">Note: The room must be active for recording to start.</p>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
