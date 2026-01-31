"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { getAccessToken, getMe, getTeamMembers, inviteMember, User, TeamMember } from "../../../../lib/api";
import { Plus, User as UserIcon } from "lucide-react";

export default function TeamMembersPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    const loadData = async () => {
      if (!getAccessToken()) { router.push("/login"); return; }
      try {
        const [u, m] = await Promise.all([getMe(), getTeamMembers()]);
        setUser(u);
        setMembers(m);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    try {
      await inviteMember(inviteEmail, "viewer");
      alert(`Invitation sent to ${inviteEmail}`);
      setShowInvite(false);
      setInviteEmail("");
    } catch (e) {
      console.error(e);
    }
  };

  if (!user && loading) return null;

  return (
    <DashboardLayout user={user || { name: "", email: "", id: "" }}>
      <Header projectName="RELATIM" pageName="Members"
        actionButton={
          <Button size="sm" onClick={() => setShowInvite(true)} leftIcon={<Plus className="w-4 h-4" />}>
            Invite member
          </Button>
        }
      />
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-xl font-semibold mb-6">Team Members</h1>

        {showInvite && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-surface border border-white/10 rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-medium text-foreground mb-4">Invite Team Member</h3>
              <input
                autoFocus
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-foreground mb-4 focus:outline-none focus:border-primary"
              />
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
                <Button onClick={handleInvite} disabled={!inviteEmail}>Invite</Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between p-4 bg-surface rounded-lg border border-white/10 transition-colors hover:bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded bg-gradient-to-br from-[#00d4aa] to-[#00a8e8] flex items-center justify-center text-white font-semibold">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-foreground text-[13px] font-medium">{m.name}</span>
                    {m.id === user?.id && <span className="px-1.5 py-0.5 rounded bg-white/10 text-secondary text-[10px] uppercase font-semibold">You</span>}
                  </div>
                  <p className="text-secondary text-[12px]">{m.email} · {m.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
