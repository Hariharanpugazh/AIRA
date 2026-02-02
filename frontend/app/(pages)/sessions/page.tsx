"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/layouts/DashboardLayout";
import Header from "../../components/Header";
import { Card } from "../../../components/ui/Card";
import { Video, RefreshCw, Search, Filter, ChevronLeft, ChevronRight, Phone, Users as UsersIcon, Bot, ChevronDown } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { getAccessToken, getSessions, getSessionStats, User, Session, SessionStats, SessionsListResponse } from "../../../lib/api";
import { createRoom } from "../../../lib/api";
import { Modal } from "../../../components/ui/Modal";
import { cn } from "../../../lib/utils";

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

  const projectName = localStorage.getItem("projectName") || "Relatim";

  return (
    <DashboardLayout>
      <Header
        projectName={projectName}
        pageName="Sessions"
        showTimeRange={true}
        onRefresh={loadData}
        actionButton={
          <div className="flex gap-2">
            <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
              <Video className="w-4 h-4 mr-2" />
              Create Room
            </Button>
          </div>
        }
      />

      <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Unique Participants
              <button className="opacity-40 hover:opacity-100 transition-opacity">
                <div className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[10px]">i</div>
              </button>
            </div>
            <div className="text-[42px] font-light text-foreground tracking-tight">
              {stats?.unique_participants || 0}
            </div>
          </Card>

          <Card className="p-6 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Total Rooms
              <button className="opacity-40 hover:opacity-100 transition-opacity">
                <div className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[10px]">i</div>
              </button>
            </div>
            <div className="text-[42px] font-light text-foreground tracking-tight">
              {stats?.total_rooms || 0}
            </div>
          </Card>
        </div>


        {/* Sessions Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Sessions</h2>
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-background border border-border/60 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead className="bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-widest border-b border-border/50">
                  <tr>
                    <th className="px-6 py-3 font-bold">Session ID</th>
                    <th className="px-6 py-3 font-bold">Room Name</th>
                    <th className="px-6 py-3 font-bold flex items-center gap-1.5">
                      Started At
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </th>
                    <th className="px-6 py-3 font-bold">Ended At</th>
                    <th className="px-6 py-3 font-bold">Duration</th>
                    <th className="px-6 py-3 font-bold">Participants</th>
                    <th className="px-6 py-3 font-bold">Features</th>
                    <th className="px-6 py-3 font-bold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {sessionsData?.data.map((session) => (
                    <tr
                      key={session.sid}
                      className="group hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => session.status === 'active' && router.push(`/sessions/${encodeURIComponent(session.room_name)}`)}
                    >
                      <td className="px-6 py-4 font-mono text-[11px] text-muted-foreground opacity-70">
                        {session.sid}
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">
                        {session.room_name}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {formatDate(session.start_time)}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {session.end_time ? formatDate(session.end_time) : "-"}
                      </td>
                      <td className="px-6 py-4 text-foreground">
                        {session.status === 'active' ? (
                          <span className="flex items-center gap-2 text-primary font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            Live
                          </span>
                        ) : (
                          formatDuration(session.duration)
                        )}
                      </td>
                      <td className="px-6 py-4 text-foreground">
                        {session.total_participants}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1.5 flex-wrap">
                          {session.features?.map(f => (
                            <span key={f} className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium text-muted-foreground">
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                          session.status === 'active' 
                            ? "bg-primary/10 text-primary border-primary/20" 
                            : "bg-muted text-muted-foreground border-border/50"
                        )}>
                          {session.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {(!sessionsData?.data || sessionsData.data.length === 0) && (
                    <tr>
                      <td colSpan={8} className="px-6 py-24 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-sm text-muted-foreground font-medium">No results.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {sessionsData && sessionsData.total > 10 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="text-xs font-medium"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground font-medium">Page {page}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!sessionsData || sessionsData.data.length < 10}
                  className="text-xs font-medium"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>


      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Room"
        footer={
          <div className="flex justify-end gap-3 p-4 bg-muted/20 border-t border-border/50">
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)} className="text-xs font-semibold">Cancel</Button>
            <Button onClick={handleCreateRoom} disabled={createLoading || !newRoomName} size="sm" className="px-6">
              {createLoading ? "Creating..." : "Create"}
            </Button>
          </div>
        }
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Room Name</label>
            <input
              autoFocus
              type="text"
              className="w-full px-4 py-2.5 bg-background border border-border/60 rounded-xl focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm placeholder:text-muted-foreground/30"
              placeholder="e.g. daily-sync-meeting"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
            />
            <p className="mt-2 text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-primary/40" />
              This name will be used to identify the session in logs and billing.
            </p>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
