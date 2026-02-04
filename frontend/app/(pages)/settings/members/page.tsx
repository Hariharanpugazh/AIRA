"use client";

import React, { useState } from "react";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { UserPlus, Trash2, Info } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isYou?: boolean;
}

const mockMembers: TeamMember[] = [
  {
    id: "1",
    name: "Hariharan P",
    email: "hariharanpugazh@gmail.com",
    role: "Admin",
    isYou: true,
  },
];

const roleDescriptions: Record<string, string> = {
  Read: "Allow read-only access to the dashboard, excluding billing.",
  Write: "Allow full access to the dashboard and write permissions to settings, excluding billing.",
  Admin: "Allow full access and control, including billing and user management.",
};

export default function TeamMembersPage() {
  const [members, setMembers] = useState<TeamMember[]>(mockMembers);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("Admin");

  const handleInvite = () => {
    if (email.trim()) {
      const newMember: TeamMember = {
        id: Date.now().toString(),
        name: email.split("@")[0],
        email: email,
        role: selectedRole,
      };
      setMembers([...members, newMember]);
      setEmail("");
      setSelectedRole("Admin");
      setShowInvite(false);
    }
  };

  const handleDelete = (id: string) => {
    setMembers(members.filter((m) => m.id !== id));
  };

  return (
    <DashboardLayout>
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
        {/* Team Members Section */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">Team members</h2>
            <p className="text-muted-foreground">Manage project access and roles.</p>
          </div>

          {/* Members List */}
          <div className="space-y-3">
            {members.length === 0 ? (
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
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-foreground font-medium text-sm">{member.name}</span>
                        {member.isYou && (
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
                    {!member.isYou && (
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

      {/* Invite Team Member Modal */}
      <Modal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        title="Invite team members"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!email.trim()}>
              Invite
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Add a team member to the <span className="font-semibold text-foreground">"Relatim"</span> project.
          </p>

          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              className="w-full px-4 py-2.5 rounded-lg bg-white dark:bg-muted/20 border border-border/60 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* Role Selector */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <label className="block text-sm font-medium text-foreground">User role</label>
              <Info className="w-4 h-4 text-muted-foreground cursor-help" title="Select the role for this user" />
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
    </DashboardLayout>
  );
}
