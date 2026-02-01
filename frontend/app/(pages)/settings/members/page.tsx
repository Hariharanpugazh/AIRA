"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { getAccessToken, getTeamMembers, createTeamMember, deleteTeamMember, getRoles, User, TeamMember, Role } from "../../../../lib/api";
import { Plus, User as UserIcon, Trash2, Shield, Users, Eye, EyeOff } from "lucide-react";

export default function TeamMembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("viewer");
  const [showPassword, setShowPassword] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!getAccessToken()) { router.push("/login"); return; }
      try {
        const [m, r] = await Promise.all([
          getTeamMembers(),
          getRoles()
        ]);
        setMembers(m);
        setRoles(r);
      } catch (e) {

      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleCreate = async () => {
    if (!newUserEmail || !newUserName) return;

    const password = newUserPassword || generatePassword();
    setIsCreating(true);

    try {
      const newMember = await createTeamMember(newUserEmail, newUserName, password, newUserRole);
      setMembers([...members, { ...newMember, role: newUserRole }]);
      setGeneratedCredentials({ email: newUserEmail, password });
      setShowCreate(false);
      setShowCredentials(true);

      // Reset form
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPassword("");
      setNewUserRole("viewer");
    } catch (e: any) {
      alert(e.message || "Failed to create user");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteTeamMember(userId);
      setMembers(members.filter(m => m.id !== userId));
    } catch (e: any) {
      alert(e.message || "Failed to delete user");
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role?.toLowerCase()) {
      case "admin":
      case "super admin":
        return <Shield className="w-4 h-4 text-primary" />;
      case "editor":
        return <Users className="w-4 h-4 text-yellow-500" />;
      default:
        return <UserIcon className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case "admin":
      case "super admin":
        return "bg-primary/10 text-primary border-primary/20";
      case "editor":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "support":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      default:
        return "bg-surface text-muted-foreground border-border";
    }
  };

  if (loading) return null;

  return (
    <DashboardLayout>
      <Header
        projectName="RELATIM"
        pageName="Members"
        showTimeRange={false}
        actionButton={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Member
          </Button>
        }
      />

      <div className="p-4 md:p-8 max-w-5xl mx-auto">

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-foreground">{members.length}</div>
            <div className="text-sm text-muted-foreground">Total Members</div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-primary">
              {members.filter(m => m.role?.toLowerCase().includes("admin")).length}
            </div>
            <div className="text-sm text-muted-foreground">Admins</div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-500">
              {members.filter(m => m.role?.toLowerCase() === "viewer").length}
            </div>
            <div className="text-sm text-muted-foreground">Viewers</div>
          </div>
        </div>


        <Modal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          title="Add New Team Member"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={!newUserEmail || !newUserName || isCreating}
              >
                {isCreating ? "Creating..." : "Create User"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full Name</label>
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground"
              >
                {roles.map(role => (
                  <option key={role.id} value={role.name.toLowerCase().replace(" admin", "")}>
                    {role.name} - {role.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Password (optional - leave blank for auto-generated)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Auto-generated if empty"
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </Modal>


        <Modal
          isOpen={showCredentials}
          onClose={() => setShowCredentials(false)}
          title="User Created Successfully"
          footer={
            <Button onClick={() => setShowCredentials(false)}>Done</Button>
          }
        >
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <p className="text-sm text-green-400 mb-4">
                User has been created successfully. Please copy these credentials and share them securely with the user.
              </p>
              {generatedCredentials && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-surface rounded">
                    <span className="text-sm text-muted-foreground">Email:</span>
                    <span className="text-sm font-mono text-foreground">{generatedCredentials.email}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-surface rounded">
                    <span className="text-sm text-muted-foreground">Password:</span>
                    <span className="text-sm font-mono text-foreground">{generatedCredentials.password}</span>
                  </div>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (generatedCredentials) {
                  navigator.clipboard.writeText(
                    `Email: ${generatedCredentials.email}\nPassword: ${generatedCredentials.password}`
                  );
                }
              }}
            >
              Copy to Clipboard
            </Button>
          </div>
        </Modal>


        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium text-foreground">Team Members</h2>
          </div>
          <div className="divide-y divide-border">
            {members.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No team members yet</p>
              </div>
            ) : (
              members.map(m => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-4 hover:bg-surface-hover transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-primary-foreground font-semibold">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-foreground text-sm font-medium">{m.name}</span>
                      </div>
                      <p className="text-secondary text-xs">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-full text-xs border flex items-center gap-1 ${getRoleColor(m.role)}`}>
                      {getRoleIcon(m.role)}
                      {m.role}
                    </span>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="p-2 rounded-lg text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Delete user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
