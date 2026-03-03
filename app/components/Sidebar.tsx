"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutGrid,
  Radio,
  Phone,
  Upload,
  Download,
  FlaskConical,
  Settings,
  Folder,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  X,
  Check,
  LogOut,
} from "lucide-react";
import { createProject, logout, getProjects } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { DelayedLoader } from "../../components/ui/DelayedLoader";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  user: { name: string; email: string } | null;
}

export default function LiveKitStyleSidebar({ user: initialUser }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [telephonyOpen, setTelephonyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [requireProjectCreation, setRequireProjectCreation] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(initialUser ?? auth?.user ?? null);

  // Determine which sections contain active routes
  const isTelephonyActive = pathname.startsWith("/telephony");
  const isSettingsActive = pathname.startsWith("/settings");

  // Load persisted state from localStorage on mount
  useEffect(() => {
    setMounted(true);

    try {
      const saved = localStorage.getItem("sidebar-state");
      if (saved) {
        const state = JSON.parse(saved);
        setTelephonyOpen(state.telephonyOpen ?? false);
        setSettingsOpen(state.settingsOpen ?? false);
      }
    } catch (e) {
      console.error("Failed to load sidebar state:", e);
    }
  }, []);

  // Keep local user state in sync with Auth context
  useEffect(() => {
    if (auth && auth.user) setUser(auth.user as any);
  }, [auth?.user]);

  // Auto-expand sections containing active routes
  useEffect(() => {
    if (isTelephonyActive) {
      setTelephonyOpen(true);
    }
    if (isSettingsActive) {
      setSettingsOpen(true);
    }
  }, [pathname, isTelephonyActive, isSettingsActive]);

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    if (mounted) {
      try {
        localStorage.setItem(
          "sidebar-state",
          JSON.stringify({ telephonyOpen, settingsOpen })
        );
      } catch (e) {
        console.error("Failed to save sidebar state:", e);
      }
    }
  }, [telephonyOpen, settingsOpen, mounted]);

  const handleCreateProject = async () => {
    if (newProjectName.trim()) {
      try {
        const created = await createProject(newProjectName.trim());
        // refresh projects list
        try { const list = await getProjects(); setProjectsList(list || []); } catch (e) { console.error(e); }
        setNewProjectName("");
        setCreateProjectOpen(false);
        setCreateProjectError(null);
        setRequireProjectCreation(false);
        // navigate to project settings for the created project if available
        if (created && (created.short_id || created.id)) {
          const sid = created.short_id || created.id;
          try {
            if (created.id) localStorage.setItem("projectId", created.id);
            if (created.name) localStorage.setItem("projectName", created.name);
          } catch (e) {
            // ignore storage errors
          }
          router.push(`/${sid}/settings/project`);
        }
      } catch (error) {
        console.error("Failed to create project:", error);
        setCreateProjectError("Failed to create project. Please try again.");
      }
    }
  };

  const loadProjects = async () => {
    try {
      const list = await getProjects();
      setProjectsList(list || []);
    } catch (e) {
      console.error("Failed to load projects", e);
      setProjectsList([]);
    } finally {
      setProjectsLoaded(true);
    }
  };

  // Load projects for project switcher when sidebar mounts
  useEffect(() => {
    loadProjects();
  }, []);

  // Only show create project dialog if user truly has zero projects.
  // Guard with `projectsLoaded` and add a short debounce to avoid flashes
  // when the list is temporarily empty during navigation/switches.
  useEffect(() => {
    if (!mounted || !auth?.user || !projectsLoaded) return;
    if (Array.isArray(projectsList) && projectsList.length === 0) {
      const t = setTimeout(() => {
        setCreateProjectOpen(true);
        setRequireProjectCreation(true);
      }, 250);
      return () => clearTimeout(t);
    } else {
      setCreateProjectOpen(false);
      setRequireProjectCreation(false);
    }
  }, [mounted, auth?.user, projectsLoaded, projectsList.length]);

  // derive current project preferring localStorage selection, otherwise fall back to pathname
  const pathParts = (pathname || "").split("/").filter(Boolean);
  const pathShort = pathParts[0] || null;
  let storedProjectId: string | null = null;
  if (mounted) {
    try {
      storedProjectId = localStorage.getItem("projectId");
    } catch (e) {
      storedProjectId = null;
    }
  }

  const selectedKey = storedProjectId || pathShort;
  const currentProject = projectsList.find((p) => p.id === selectedKey || p.short_id === selectedKey) || null;
  const basePrefix = currentProject ? `/${currentProject.short_id ?? currentProject.id}` : "";

  const makeHref = (href: string) => {
    if (!href.startsWith("/")) href = `/${href}`;
    return `${basePrefix}${href}`;
  };

  const navItem = (href: string, label: string, Icon: any) => {
    const fullHref = makeHref(href);
    const isActive = pathname === fullHref || pathname.startsWith(fullHref + '/') || pathname.startsWith(fullHref);
    return (
      <Link
        href={fullHref}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-200 group relative",
          isActive
            ? "bg-primary/10 text-primary font-semibold"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        )}
      >
        <Icon className={cn("w-4 h-4 transition-colors shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        <span className="flex-1 truncate">{label}</span>
      </Link>
    );
  };

  const subItem = (href: string, label: string) => {
    const fullHref = makeHref(href);
    const isActive = pathname === fullHref || pathname.startsWith(fullHref + '/') || pathname.startsWith(fullHref);
    return (
      <Link
        href={fullHref}
        className={cn(
          "flex px-3 py-1.5 rounded-md text-[13px] transition-all duration-200",
          "ml-7",
          isActive
            ? "text-primary font-medium bg-primary/5"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        )}
      >
        {label}
      </Link>
    );
  };

  const collapsibleSection = (
    label: string,
    Icon: any,
    isOpen: boolean,
    setIsOpen: (v: boolean) => void,
    children: React.ReactNode
  ) => {
    return (
      <div className="space-y-0.5">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-[13px] text-muted-foreground hover:bg-muted/60 hover:text-foreground rounded-lg transition-all duration-200"
        >
          <span className="flex items-center gap-3">
            <Icon className="w-4 h-4" /> {label}
          </span>
          <ChevronRight className={cn("w-3.5 h-3.5 transition-transform duration-300", isOpen && "rotate-90")} />
        </button>
        <div className={cn(
          "grid transition-all duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
        )}>
          <div className="overflow-hidden">
            <div className="pt-0.5 space-y-0.5 animate-in fade-in duration-500">
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {isLoggingOut && <DelayedLoader />}
      <aside className="h-screen flex flex-col bg-background sticky top-0 font-sans text-foreground transition-all duration-300 ease-in-out w-64">
        {/* Header */}
        <div className="px-6 py-8 flex items-center">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="h-6 w-auto flex items-center justify-center shrink-0">
              <img
                src="/aira-logo.svg"
                alt="AIRA"
                className="h-full w-auto object-contain dark:filter dark:invert dark:brightness-150 dark:contrast-125 transition-transform duration-500 group-hover:scale-110"
              />
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-hide">
          {navItem("/dashboard", "Overview", LayoutGrid)}
          {navItem("/sessions", "Sessions", Radio)}
          {collapsibleSection("Telephony", Phone, telephonyOpen, setTelephonyOpen, (
            <>
              {subItem("/telephony/calls", "Calls")}
              {subItem("/telephony/sip-trunks", "SIP Trunks")}
              {subItem("/telephony/dispatch-rules", "Dispatch Rules")}
            </>
          ))}

          {navItem("/egresses", "Egresses", Upload)}
          {navItem("/ingresses", "Ingresses", Download)}
          {navItem("/sandbox", "Sandbox", FlaskConical)}

          {collapsibleSection("Settings", Settings, settingsOpen, setSettingsOpen, (
            <>
              {subItem("/settings/project", "Project")}
              {subItem("/settings/members", "Team Members")}
              {subItem("/settings/keys", "API Keys")}
              {subItem("/settings/webhooks", "Webhooks")}
            </>
          ))}
        </nav>

        {/* Footer / User Profile & Project Switcher */}
        <div className="mt-auto p-4 space-y-4">
          <div className="flex flex-col gap-2">
            {/* User Profile Info */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/40 border border-border/60 group cursor-pointer hover:bg-muted/60 transition-all duration-300" onClick={() => setUserSettingsOpen(true)}>
              <div
                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary to-accent border border-primary/20 text-primary-foreground font-black text-[13px] shadow-lg shadow-primary/20 ring-1 ring-white/10 group-hover:scale-105 transition-transform duration-300"
              >
                {user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : (user?.email?.[0]?.toUpperCase() || 'U')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold truncate text-foreground group-hover:text-primary transition-colors">
                  {user?.name || user?.email?.split('@')[0] || "User"}
                </div>
                <div className="text-[10px] text-muted-foreground/60 truncate uppercase tracking-widest font-black flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-success/60" />
                  Administrator
                </div>
              </div>
            </div>

            {/* Project Switcher */}
            <div className="relative w-full">
              <button
                onClick={() => {
                  setProjectOpen(!projectOpen);
                }}
                className={cn(
                  "w-full flex items-center justify-between rounded-lg text-[13px] font-medium transition-all duration-200",
                  projectOpen
                    ? "bg-primary/5 border-primary/20 text-primary"
                    : "bg-muted/40 hover:bg-muted/70 border-transparent text-foreground",
                  "border",
                  "px-3 py-2"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="w-4 h-4 text-accent shrink-0" />
                  <span className="truncate">{currentProject?.name || "Select project"}</span>
                </div>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform opacity-50 shrink-0", projectOpen && "rotate-180")} />
              </button>

              {projectOpen && (
                <div className={cn(
                  "absolute z-[80] animate-in fade-in slide-in-from-bottom-2 duration-200",
                  "left-0 right-0 bottom-full mb-2"
                )}>
                  <div className="bg-background/95 border border-primary/20 shadow-[0_12px_40px_rgba(0,0,0,0.15)] backdrop-blur-xl rounded-xl overflow-hidden p-1.5 max-h-80 overflow-auto">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Projects</div>
                    {projectsList.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No projects</div>
                    )}
                    {projectsList.map((p, idx) => (
                      <button
                        key={p.id || p.short_id || `proj-${idx}`}
                        onClick={() => {
                          setProjectOpen(false);
                          const target = p.short_id ?? p.id ?? null;
                          if (!target || target === "undefined") {
                            console.warn("Attempted to navigate to invalid project id", p);
                            return;
                          }
                          try {
                            if (p.id) localStorage.setItem("projectId", p.id);
                            if (p.name) localStorage.setItem("projectName", p.name);
                          } catch (e) {
                            // ignore storage errors
                          }
                          router.push(`/${target}/dashboard`);
                        }}
                        className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px]", (currentProject && (currentProject.id === p.id || currentProject.short_id === p.short_id)) ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
                      >
                        <span className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-accent shrink-0" />
                          <span className="truncate">{p.name}</span>
                        </span>
                        {(currentProject && (currentProject.id === p.id || currentProject.short_id === p.short_id)) && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setCreateProjectOpen(true);
                        setCreateProjectError(null);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-primary hover:bg-primary/5 font-medium"
                    >
                      + New Project
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* User Settings Modal */}
      {userSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={() => setUserSettingsOpen(false)} />
          <div className="relative w-full max-w-[420px] bg-background/95 backdrop-blur-xl border border-primary/20 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-in zoom-in-95 fade-in duration-200 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20">
              <h2 className="text-[15px] font-semibold">User settings</h2>
              <button onClick={() => setUserSettingsOpen(false)} className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Profile Section */}
              <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl border border-border/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg border border-primary/20 shadow-sm">
                    {(user?.name || user?.email)?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{user?.name || user?.email || "Loading..."}</span>
                      <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded uppercase tracking-wider">Admin</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{user?.email ?? "-"}</div>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setIsLoggingOut(true);
                    await logout();
                    router.push('/login');
                  }}
                  disabled={isLoggingOut}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border hover:bg-muted transition-colors bg-background"
                >
                  <span className="sr-only">Sign out</span>
                  <span className="text-xs">Sign out</span>
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Preferences */}
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 rounded border-muted bg-muted accent-primary cursor-pointer" />
                  <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                    Help AIRA improve our products and services by enabling cookies.
                    You can learn more about how we collect and store your information in our
                    <a href="#" className="text-primary hover:underline ml-1">cookie policy</a> and
                    <a href="#" className="text-primary hover:underline ml-1">privacy policy</a>.
                  </span>
                </label>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-medium">Theme</span>
                  <div className="flex bg-muted p-1 rounded-lg">
                    <button
                      onClick={() => setTheme("light")}
                      className={cn(
                        "p-1.5 rounded-md transition-all",
                        theme === "light" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Sun className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={cn(
                        "p-1.5 rounded-md transition-all",
                        theme === "dark" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Moon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setTheme("system")}
                      className={cn(
                        "p-1.5 rounded-md transition-all",
                        theme === "system" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Monitor className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end p-4 border-t bg-muted/30">
              <button
                onClick={() => setUserSettingsOpen(false)}
                className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg transition-colors shadow-lg shadow-primary/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Project Modal */}
      {createProjectOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={() => { if (!requireProjectCreation) setCreateProjectOpen(false); }} />
          <div className="relative w-full max-w-[520px] bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-in zoom-in-95 fade-in duration-200 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border/50">
              <h2 className="text-[17px] font-semibold text-foreground">Create a new project</h2>
              {!requireProjectCreation && (
                <button onClick={() => setCreateProjectOpen(false)} className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-6 space-y-5">
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Each project is a separate container for agents, WebRTC sessions, and telephony. Free quota is shared among all your projects
              </p>

              <div className="space-y-2">
                <label className="text-[13px] font-medium text-foreground">Project name</label>
                <input
                  type="text"
                  placeholder="My new project"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateProject();
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  autoFocus
                />
                {createProjectError && (
                  <p className="text-red-500 text-xs">{createProjectError}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-border/50 bg-muted/30">
              {!requireProjectCreation && (
                <button
                  onClick={() => setCreateProjectOpen(false)}
                  className="px-6 py-2 bg-muted hover:bg-muted/80 text-foreground text-[13px] font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed text-primary-foreground text-[13px] font-bold rounded-lg transition-colors shadow-lg shadow-primary/20"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
