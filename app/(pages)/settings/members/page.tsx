"use client";

import React, { useState } from "react";
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { Card } from "../../../../components/ui/Card";
import { DelayedLoader } from "../../../../components/ui/DelayedLoader";
import { UserPlus, Trash2, Users } from "lucide-react";
import { createTeamMember, deleteTeamMember, getMe, getTeamMembers, TeamMember } from "../../../../lib/api";

const roleDescriptions: Record<string, string> = {
  Read: "Read-only dashboard access.",
  Write: "Read and write access to project resources.",
  Admin: "Full control including user management.",
};

interface TeamMembersPageProps {
  projectId?: string;
}

export default function TeamMembersPage({ projectId: _projectId }: TeamMembersPageProps) {
  void _projectId;
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("Admin");
  const [projectName, setProjectName] = useState("Project");
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    const run = async () => {
      await loadMembers();
      getMe().then((user) => setMe({ id: user.id })).catch(() => null);
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("projectName");
        if (stored) setProjectName(stored);
      }
    };
    run();
  }, []);

  const loadMembers = async () => {
    try {
      setIsLoading(true);
      const data = await getTeamMembers();
      setMembers(data);
      setError(null);
    } catch {
      setError("Failed to load members.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!email.trim() || !password.trim()) return;
    try {
      await createTeamMember(email.trim(), email.split("@")[0], password, selectedRole);
      await loadMembers();
      setEmail("");
      setPassword("");
      setSelectedRole("Admin");
      setShowInvite(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create member.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this member?")) return;
    try {
      await deleteTeamMember(id);
      await loadMembers();
    } catch {
      setError("Failed to remove member.");
    }
  };

  return (
    <>
      {isLoading && <DelayedLoader />}
      <Header
        projectName={projectName}
        pageName="Team Members"
        showTimeRange={false}
        actionButton={
          <Button size="sm" onClick={() => setShowInvite(true)} leftIcon={<UserPlus className="w-4 h-4" />}>
            Invite Member
          </Button>
        }
      />

      <div className="p-4 md:p-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-0">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Members</h2>
                <p className="text-sm text-muted-foreground">Manage dashboard access for your team.</p>
              </div>
              <div className="divide-y divide-border">
                {!isLoading && members.length === 0 && (
                  <div className="px-6 py-10 text-center text-sm text-muted-foreground">No members found.</div>
                )}
                {members.map((member) => (
                  <div key={member.id} className="px-6 py-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {member.name || member.email}{" "}
                        {member.id === me?.id && <span className="text-xs text-primary">(You)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs rounded-md bg-muted px-2 py-1 text-foreground">{member.role}</span>
                      {member.id !== me?.id && (
                        <button
                          onClick={() => handleDelete(member.id)}
                          className="p-2 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                          title="Remove member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Summary</h3>
              </div>
              <div className="text-sm text-muted-foreground">Total members: <span className="text-foreground font-medium">{members.length}</span></div>
            </Card>
            <Card>
              <h3 className="text-sm font-semibold text-foreground mb-3">Role Access</h3>
              <div className="space-y-2">
                {Object.entries(roleDescriptions).map(([role, desc]) => (
                  <div key={role}>
                    <p className="text-sm font-medium text-foreground">{role}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
            </Card>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        title="Invite Team Member"
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
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@company.com"
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground focus:outline-none focus:border-primary/60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Temporary Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set an initial password"
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground focus:outline-none focus:border-primary/60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-sm text-foreground focus:outline-none focus:border-primary/60"
            >
              {Object.keys(roleDescriptions).map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </>
  );
}
