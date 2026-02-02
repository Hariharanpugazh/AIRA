"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { Card } from "../../../../components/ui/Card";
import { getAccessToken, User, apiFetch } from "../../../../lib/api";
import { Phone, PhoneOutgoing, PhoneIncoming, Clock, Plus, RefreshCw, PhoneOff, Search, Filter, ChevronDown, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { cn } from "../../../../lib/utils";

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

  const totalCallDuration = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
  const avgDurationSeconds = calls.length > 0
    ? Math.round(totalCallDuration / calls.length)
    : 0;
  const totalCalls = calls.length;
  const activeCalls = calls.filter(c => c.status === "active" || c.status === "ringing");

  return (
    <DashboardLayout>
      <Header
        projectName={projectName}
        sectionName="Telephony"
        pageName="Calls"
        showTimeRange={true}
        onRefresh={handleRefresh}
        actionButton={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setIsCallModalOpen(true)}>
              <PhoneOutgoing className="w-4 h-4 mr-2" />
              Make Call
            </Button>
          </div>
        }
      />

      <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto animate-fade-in">
        {/* Top Row Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Total Calls
              <Info className="w-3.5 h-3.5 opacity-40" />
            </div>
            <div className="text-[32px] font-light text-foreground">{totalCalls}</div>
          </Card>

          <Card className="p-6 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Total Call Duration
              <Info className="w-3.5 h-3.5 opacity-40" />
            </div>
            <div className="text-[32px] font-light text-foreground">{totalCallDuration} sec</div>
          </Card>

          <Card className="p-6 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Average Call Duration
              <Info className="w-3.5 h-3.5 opacity-40" />
            </div>
            <div className="text-[32px] font-light text-foreground">{avgDurationSeconds} sec</div>
          </Card>
        </div>

        {/* Middle Row Large Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-12 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm text-center">
            <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-8">
              Active Calls
              <Info className="w-3.5 h-3.5 opacity-40" />
            </div>
            <div className="text-[64px] font-light text-primary tracking-tight">
              {activeCalls.length}
            </div>
          </Card>

          <Card className="p-12 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm text-center">
            <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-8">
              Calls with Issues
              <Info className="w-3.5 h-3.5 opacity-40" />
            </div>
            <div className="text-[64px] font-light text-primary tracking-tight">
              0
            </div>
          </Card>
        </div>

        {/* Calls Table Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Calls</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 px-3 text-xs font-medium border-border/60 bg-background hover:bg-muted text-muted-foreground">
                <Filter className="w-3.5 h-3.5 mr-2" />
                Filters
              </Button>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="Search"
                  className="h-9 w-64 pl-9 pr-4 bg-background border border-border/60 rounded-lg text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/50"
                />
              </div>
            </div>
          </div>

          <div className="bg-background border border-border/60 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead className="bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-widest border-b border-border/50">
                  <tr>
                    <th className="px-6 py-3 font-bold">ID</th>
                    <th className="px-6 py-3 font-bold">From</th>
                    <th className="px-6 py-3 font-bold">To</th>
                    <th className="px-6 py-3 font-bold">Direction</th>
                    <th className="px-6 py-3 font-bold flex items-center gap-1.5">
                      Started At
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </th>
                    <th className="px-6 py-3 font-bold flex items-center gap-1.5">
                      Ended At
                      <ChevronDown className="w-3 h-3 text-muted-foreground opacity-0" />
                    </th>
                    <th className="px-6 py-3 font-bold">Duration</th>
                    <th className="px-6 py-3 font-bold">Session</th>
                    <th className="px-6 py-3 font-bold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {calls.map((call) => (
                    <tr key={call.id} className="group hover:bg-muted/30 transition-colors cursor-pointer">
                      <td className="px-6 py-4 font-mono text-[11px] text-muted-foreground opacity-70">
                        {call.call_id?.substring(0, 8) || call.id.substring(0, 8)}
                      </td>
                      <td className="px-6 py-4 text-foreground">{call.from_number}</td>
                      <td className="px-6 py-4 text-foreground">{call.to_number}</td>
                      <td className="px-6 py-4 transition-colors">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                          call.direction === "inbound" ? "bg-green-500/10 text-green-600" : "bg-blue-500/10 text-blue-600"
                        )}>
                          {call.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {new Date(call.started_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {call.ended_at ? new Date(call.ended_at).toLocaleString() : "-"}
                      </td>
                      <td className="px-6 py-4 text-foreground">
                        {formatDuration(call.duration_seconds)}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs italic">
                        -
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                          call.status === "active" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border/50"
                        )}>
                          {call.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {calls.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-24 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-sm text-muted-foreground font-medium">No results.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
