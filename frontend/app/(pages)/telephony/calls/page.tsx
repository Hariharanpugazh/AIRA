"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { Card } from "../../../../components/ui/Card";
import { getAccessToken, getMe, User } from "../../../../lib/api";
import { Phone, PhoneOutgoing, PhoneIncoming, Clock } from "lucide-react";

export default function CallsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState<string>("Default Project");

  useEffect(() => {
    const loadData = async () => {
      const token = getAccessToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const userData = await getMe();
        setUser(userData);
        setProjectName(localStorage.getItem("projectName") || "Default Project");
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout user={user}>
      <Header projectName={projectName} pageName="Calls" />

      <div className="space-y-6 pb-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card variant="glass" className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Calls</span>
            </div>
            <div className="text-2xl font-bold text-foreground">0</div>
          </Card>

          <Card variant="glass" className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <PhoneIncoming className="w-5 h-5 text-green-500" />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Active Calls</span>
            </div>
            <div className="text-2xl font-bold text-green-500">0</div>
          </Card>

          <Card variant="glass" className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Avg Duration</span>
            </div>
            <div className="text-2xl font-bold text-foreground">0s</div>
          </Card>

          <Card variant="glass" className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <PhoneOutgoing className="w-5 h-5 text-red-500" />
              </div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Issues</span>
            </div>
            <div className="text-2xl font-bold text-foreground">0</div>
          </Card>
        </div>

        {/* Calls Table */}
        <Card variant="glass" className="overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="font-medium text-foreground">Recent Calls</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">ID</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">From</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">To</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Direction</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Started</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Duration</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-surface border border-white/10 flex items-center justify-center mb-4">
                      <Phone className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No calls yet</p>
                    <p className="text-xs text-muted-foreground mt-1">SIP calls will appear here when connected</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
