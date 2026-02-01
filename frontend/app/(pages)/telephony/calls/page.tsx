"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { Card } from "../../../../components/ui/Card";
import { getAccessToken, User, apiFetch } from "../../../../lib/api";
import { Phone, PhoneOutgoing, PhoneIncoming, Clock, Plus, RefreshCw, PhoneOff } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";

interface SIPTrunk {
  id: string;
  name: string;
  outbound_number: string;
}

interface CallLog {
  id: string;
  call_id: string;
  from_number: string;
  to_number: string;
  direction: "inbound" | "outbound";
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  status: string;
  trunk_id?: string;
}

export default function CallsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState<string>("Default Project");

  // Outbound call state
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [trunks, setTrunks] = useState<SIPTrunk[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callForm, setCallForm] = useState({
    trunkId: "",
    toNumber: "",
    roomName: "",
    participantIdentity: "",
  });

  useEffect(() => {
    const loadData = async () => {
      const token = getAccessToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        setProjectName(localStorage.getItem("projectName") || "Default Project");

        // Load SIP trunks and call logs
        try {
          const [trunksData, callsData] = await Promise.all([
            apiFetch<SIPTrunk[]>('/api/telephony/sip-trunks'),
            apiFetch<CallLog[]>('/api/telephony/call-logs?limit=50'),
          ]);
          setTrunks(trunksData || []);
          setCalls(callsData || []);
          if (trunksData?.length > 0) {
            setCallForm(prev => ({ ...prev, trunkId: trunksData[0].id }));
          }
        } catch (e) {
          console.log("SIP data not available:", e);
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const callsData = await apiFetch<CallLog[]>('/api/telephony/call-logs?limit=50');
      setCalls(callsData || []);
    } catch (e) {

    } finally {
      setRefreshing(false);
    }
  };

  const handleMakeCall = async () => {
    if (!callForm.toNumber || !callForm.trunkId) {
      alert("Please fill in all required fields");
      return;
    }

    setCalling(true);
    try {
      await apiFetch('/api/telephony/outbound-call', {
        method: 'POST',
        body: JSON.stringify({
          trunk_id: callForm.trunkId,
          to_number: callForm.toNumber,
          room_name: callForm.roomName || undefined,
          participant_identity: callForm.participantIdentity || undefined,
        }),
      });
      setIsCallModalOpen(false);
      setCallForm({ trunkId: trunks[0]?.id || "", toNumber: "", roomName: "", participantIdentity: "" });
      handleRefresh();
    } catch (e) {
      alert("Failed to make call: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setCalling(false);
    }
  };

  const handleEndCall = async (callId: string) => {
    if (!confirm("End this call?")) return;
    try {
      await apiFetch(`/api/telephony/calls/${callId}/end`, { method: 'POST' });
      handleRefresh();
    } catch (e) {

    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const activeCalls = calls.filter(c => c.status === "active" || c.status === "ringing");
  const totalCalls = calls.length;
  const avgDuration = calls.length > 0
    ? Math.round(calls.filter(c => c.duration_seconds).reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / calls.filter(c => c.duration_seconds).length)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <Header
        projectName={projectName}
        pageName="Calls"
        actionButton={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" onClick={() => setIsCallModalOpen(true)} leftIcon={<PhoneOutgoing className="w-4 h-4" />}>
              Make Call
            </Button>
          </div>
        }
      />

      <div className="space-y-6 pb-8">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card variant="glass" className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Calls</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{totalCalls}</div>
          </Card>

          <Card variant="glass" className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <PhoneIncoming className="w-5 h-5 text-green-500" />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Active Calls</span>
            </div>
            <div className="text-2xl font-bold text-green-500">{activeCalls.length}</div>
          </Card>

          <Card variant="glass" className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Avg Duration</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{avgDuration}s</div>
          </Card>

          <Card variant="glass" className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <PhoneOutgoing className="w-5 h-5 text-purple-500" />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">SIP Trunks</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{trunks.length}</div>
          </Card>
        </div>


        <Card variant="glass" className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-medium text-foreground">Recent Calls</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">ID</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">From</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">To</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Direction</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Started</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Duration</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {calls.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-4">
                          <Phone className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">No calls yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Make an outbound call or receive inbound calls via SIP</p>
                        {trunks.length > 0 && (
                          <Button size="sm" className="mt-4" onClick={() => setIsCallModalOpen(true)}>
                            <PhoneOutgoing className="w-4 h-4 mr-2" />
                            Make First Call
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  calls.map((call) => (
                    <tr key={call.id} className="border-b border-border hover:bg-surface-hover">
                      <td className="px-4 py-3 font-mono text-xs">{call.call_id?.substring(0, 8) || call.id.substring(0, 8)}</td>
                      <td className="px-4 py-3 text-sm">{call.from_number}</td>
                      <td className="px-4 py-3 text-sm">{call.to_number}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs ${call.direction === "inbound" ? "text-green-400" : "text-blue-400"}`}>
                          {call.direction === "inbound" ? <PhoneIncoming className="w-3 h-3" /> : <PhoneOutgoing className="w-3 h-3" />}
                          {call.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(call.started_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">{formatDuration(call.duration_seconds)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${call.status === "active" ? "bg-green-500/10 text-green-500" :
                          call.status === "ringing" ? "bg-yellow-500/10 text-yellow-500" :
                            call.status === "completed" ? "bg-white/10 text-secondary" :
                              "bg-red-500/10 text-red-500"
                          }`}>
                          {call.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(call.status === "active" || call.status === "ringing") && (
                          <button
                            onClick={() => handleEndCall(call.call_id || call.id)}
                            className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
                            title="End call"
                          >
                            <PhoneOff className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>


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
        <div className="space-y-4">
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
                >
                  {trunks.map((trunk) => (
                    <option key={trunk.id} value={trunk.id}>
                      {trunk.name} ({trunk.outbound_number})
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
                />
                <p className="text-xs text-muted-foreground mt-1">Identity for the caller in the room</p>
              </div>
            </>
          )}
        </div>
      </Modal>
    </DashboardLayout>
  );
}
