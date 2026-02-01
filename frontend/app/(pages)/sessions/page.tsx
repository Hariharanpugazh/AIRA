"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/layouts/DashboardLayout";
import Header from "../../components/Header";
import { Card } from "../../../components/ui/Card";
import { Video, RefreshCw, Search, Filter, ChevronLeft, ChevronRight, Phone, Users as UsersIcon, Bot } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { StatsLineChart } from "../../../components/Charts";
import { getAccessToken, getSessions, getSessionStats, User, Session, SessionStats, SessionsListResponse } from "../../../lib/api";
import { createRoom } from "../../../lib/api";
import { Modal } from "../../../components/ui/Modal";

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} mins`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
};

export default function SessionsPage() {
  const router = useRouter();
  const [sessionsData, setSessionsData] = useState<SessionsListResponse | null>(null);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const [sessionsRes, statsRes] = await Promise.all([
        getSessions(page, 10, statusFilter === "all" ? undefined : statusFilter, debouncedSearch),
        getSessionStats("24h")
      ]);

      setSessionsData(sessionsRes);
      setStats(statsRes);
    } catch (error) {
      setLoading(false);
      setRefreshing(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, statusFilter, debouncedSearch, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    setCreateLoading(true);
    try {
      await createRoom(newRoomName);
      setNewRoomName("");
      setIsCreateModalOpen(false);
      setTimeout(loadData, 1000);
    } catch (e) {
      alert("Failed to create room");
    } finally {
      setCreateLoading(false);
    }
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
        pageName="Sessions"
        showTimeRange={false}
        actionButton={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => { setRefreshing(true); loadData(); }}
              className="text-muted-foreground"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Video className="w-4 h-4 mr-2" />
              Create Room
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-8 animate-fade-in space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-0 overflow-hidden relative group">
            <div className="p-6 pb-2 relative z-10">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Unique Participants (24h)</div>
              <div className="text-3xl font-bold text-cyan-400">{stats?.unique_participants || 0}</div>
            </div>
            <div className="h-[120px] w-full absolute bottom-0 left-0 right-0 opacity-50 group-hover:opacity-80 transition-opacity">
              <StatsLineChart data={stats?.timeseries || []} dataKey="participants" color="#00F0FF" />
            </div>
          </Card>

          <Card className="p-0 overflow-hidden relative group">
            <div className="p-6 pb-2 relative z-10">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Rooms (24h)</div>
              <div className="text-3xl font-bold text-primary">{stats?.total_rooms || 0}</div>
            </div>
            <div className="h-[120px] w-full absolute bottom-0 left-0 right-0 opacity-50 group-hover:opacity-80 transition-opacity">
              <StatsLineChart data={stats?.timeseries || []} dataKey="rooms" color="#BD00FF" />
            </div>
          </Card>
        </div>


        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-surface/30 p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search rooms"
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="h-8 w-[1px] bg-border mx-2 hidden md:block" />
            <div className="flex gap-1 bg-background/50 p-1 rounded-lg">
              {['all', 'active', 'closed'].map(filters => (
                <button
                  key={filters}
                  onClick={() => setStatusFilter(filters)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${statusFilter === filters
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-surface-hover'
                    }`}
                >
                  {filters.charAt(0).toUpperCase() + filters.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
            Showing {(page - 1) * 10 + 1}-{Math.min(page * 10, sessionsData?.total || 0)} of {sessionsData?.total || 0}
          </div>
        </div>


        <div className="bg-surface/50 border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-background/50 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">Session ID / Room</th>
                  <th className="px-6 py-4 font-medium">Started At</th>
                  <th className="px-6 py-4 font-medium">Duration</th>
                  <th className="px-6 py-4 font-medium">Participants</th>
                  <th className="px-6 py-4 font-medium">Features</th>
                  <th className="px-6 py-4 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessionsData?.data.map((session) => (
                  <tr
                    key={session.sid}
                    className="group hover:bg-surface-hover transition-colors cursor-pointer"
                    onClick={() => session.status === 'active' && router.push(`/sessions/${encodeURIComponent(session.room_name)}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground group-hover:text-primary transition-colors">{session.room_name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5 opacity-60">{session.sid}</div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                      {formatDate(session.start_time)}
                    </td>
                    <td className="px-6 py-4 text-foreground font-mono">
                      {session.status === 'active' ? (
                        <span className="animate-pulse text-cyan-400">Live</span>
                      ) : (
                        formatDuration(session.duration)
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <UsersIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-foreground">{session.total_participants}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1.5 flex-wrap">
                        {session.features && session.features.length > 0 ? (
                          session.features.map(f => (
                            <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-border text-[10px] text-muted-foreground">
                              {f === 'Agents' ? <Bot className="w-3 h-3" /> : f === 'SIP' ? <Phone className="w-3 h-3" /> : null}
                              {f}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted-foreground/30 text-xs">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium border ${session.status === 'active'
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-surface text-muted-foreground border-border'
                        }`}>
                        {session.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}

                {(!sessionsData?.data || sessionsData.data.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-3 rounded-full bg-surface">
                          <Video className="w-6 h-6 opacity-30" />
                        </div>
                        <span>No sessions found</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>


          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={!sessionsData || sessionsData.data.length < 10} // Simple check, ideally check total
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>


      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Start New Session"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRoom} disabled={createLoading || !newRoomName}>
              {createLoading ? "Starting..." : "Start Session"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Room Name</label>
            <input
              autoFocus
              type="text"
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 outline-none transition-all"
              placeholder="e.g. daily-standup"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
            />
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
