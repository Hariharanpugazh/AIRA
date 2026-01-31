"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/layouts/DashboardLayout";
import Header from "../../components/Header";
import { Card } from "../../../components/ui/Card";
import { Video, Users, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { getAccessToken, getMe, getRooms, User, Room } from "../../../lib/api";

export default function SessionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const token = getAccessToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const [userData, roomsData] = await Promise.all([
        getMe(),
        getRooms(),
      ]);

      setUser(userData);
      setRooms(roomsData);
    } catch (error) {
      console.error("Failed to load sessions:", error);
      router.push("/login");
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

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    );
  }

  const projectName = localStorage.getItem("projectName") || "RELATIM";

  return (
    <DashboardLayout user={user}>
      <Header
        projectName={projectName}
        pageName="Sessions"
        showTimeRange={false}
        actionButton={
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        }
      />

      <div className="p-4 md:p-8 animate-fade-in">
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full animate-pulse-slow" />
              <div className="w-20 h-20 rounded-2xl bg-surface border border-white/10 flex items-center justify-center mb-8 relative">
                <Video className="w-10 h-10 text-primary" />
              </div>
            </div>
            <h2 className="text-foreground font-display text-2xl font-bold mb-3">No active sessions</h2>
            <p className="text-muted-foreground text-sm text-center max-w-md">
              LiveKit rooms will appear here when participants connect.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => (
                <Card key={room.sid} variant="glass" className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Video className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">{room.num_participants}</span>
                    </div>
                  </div>
                  <h3 className="text-foreground font-medium mb-1">{room.name}</h3>
                  <p className="text-muted-foreground text-xs truncate">{room.sid}</p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
