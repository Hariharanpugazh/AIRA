"use client";

import React, { useState } from "react";
// DashboardLayout removed
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { UserPlus, Trash2, Info } from "lucide-react";
import { getTeamMembers, createTeamMember, deleteTeamMember, getMe, TeamMember } from "../../../../lib/api";

const roleDescriptions: Record<string, string> = {
  Read: "Allow read-only access to the dashboard, excluding billing.",
  Write: "Allow full access to the dashboard and write permissions to settings, excluding billing.",
  Admin: "Allow full access and control, including billing and user management.",
};

export default function TeamMembersPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("Admin");

  const [me, setMe] = useState<any>(null);

  React.useEffect(() => {
    loadMembers();
    getMe().then(setMe).catch(console.error);
  }, []);

  const loadMembers = async () => {
    try {
      setIsLoading(true);
      const data = await getTeamMembers();
      setMembers(data);
    } catch (error) {
      console.error("Failed to load members:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (email.trim() && password.trim()) {
      try {
        await createTeamMember(email, email.split("@")[0], password, selectedRole);
        await loadMembers();
        setEmail("");
        setPassword("");
        setSelectedRole("Admin");
        setShowInvite(false);
      } catch (error) {
        alert("Failed to create member: " + (error instanceof Error ? error.message : String(error)));
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to remove this member?")) {
      try {
        await deleteTeamMember(id);
        await loadMembers();
      } catch (error) {
        alert("Failed to delete member");
      }
    }
  };

  return (
    <>
      <Header
        projectName="Default Project"
        pageName="Members"
        showTimeRange={false}
        actionButton={
          <Button size="sm" onClick={() => setShowInvite(true)} leftIcon={<UserPlus className="w-4 h-4" />}>
            Invite team member
          </Button>
        }
      />

      <div className="p-4 md:p-8 animate-fade-in max-w-4xl">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">Team members</h2>
            <p className="text-muted-foreground">Manage project access and roles.</p>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="py-20 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mx-auto mb-4">
                  <Info className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No team members yet</p>
              </div>
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-white dark:bg-surface/30 hover:bg-gray-50 dark:hover:bg-surface/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-white font-semibold text-sm">
                      {(member.name || member.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-foreground font-medium text-sm">{member.name || member.email}</span>
                        {member.id === me?.id && (
                          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-foreground">{member.role}</span>
                    {member.id !== me?.id && (
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="p-2 rounded-lg text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        title="Invite team members"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!email.trim() || !password.trim()}>
              Invite
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Add a team member to the project.
          </p>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-muted/20 border border-border/60 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-muted/20 border border-border/60 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <label className="block text-sm font-medium text-foreground">User role</label>
            </div>

            <div className="space-y-2">
              {Object.entries(roleDescriptions).map(([role, description]) => (
                <label
                  key={role}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-white dark:bg-muted/10 hover:bg-gray-50 dark:hover:bg-muted/20 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    checked={selectedRole === role}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-4 h-4 mt-0.5 cursor-pointer accent-primary"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{role}</div>
                    <div className="text-xs text-muted-foreground mt-1">{description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
