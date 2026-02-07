"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutGrid,
  Radio,
  Bot,
  Phone,
  Upload,
  Download,
  FlaskConical,
  Settings,
  Folder,
  ChevronRight,
  ChevronDown,
  Search,
  LifeBuoy,
  Sun,
  Moon,
  Monitor,
  X,
  Check,
  LogOut,
  ExternalLink,
  Slack,
  BookOpen,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  user: { name: string; email: string } | null;
}

export default function LiveKitStyleSidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const [telephonyOpen, setTelephonyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      // TODO: Call API to create project
      console.log("Creating project:", newProjectName);
      setNewProjectName("");
      setCreateProjectOpen(false);
    }
  };

  // Handle Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setSearchQuery("");
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  const navItem = (href: string, label: string, Icon: any) => {
    const isActive = pathname === href;
    return (
      <Link
        href={href}
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
    const isActive = pathname === href;
    return (
      <Link
        href={href}
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

  if (!mounted) return <aside className="w-64 border-r h-screen bg-background" />;

  return (
    <>
      <aside className="h-screen flex flex-col bg-background sticky top-0 font-sans text-foreground transition-all duration-300 ease-in-out w-64">
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[15px] tracking-tight animate-in fade-in slide-in-from-left-2 transition-all">LiveKit</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-hide">
          {navItem("/dashboard", "Overview", LayoutGrid)}
          {navItem("/sessions", "Sessions", Radio)}
          {navItem("/agents", "Agents", Bot)}

          {collapsibleSection("Telephony", Phone, telephonyOpen, setTelephonyOpen, (
            <>
              {subItem("/telephony/calls", "Calls")}
              {subItem("/telephony/sip-trunks", "SIP Trunks")}
              {subItem("/telephony/dispatch-rules", "Dispatch Rules")}
              {subItem("/telephony/phone-numbers", "Phone Numbers")}
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
          {/* Search & Support Buttons */}
          <div className="space-y-1">
            <button 
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2 text-[13px] text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-lg transition-colors group"
            >
              <Search className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">Search</span>
              <kbd className="hidden group-hover:inline-flex px-1.5 py-0.5 bg-background border rounded text-[10px] font-sans text-muted-foreground">CTRL+K</kbd>
            </button>
            
            <div className="relative group/support">
              <button 
                onClick={() => {
                  setSupportOpen(!supportOpen);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-[13px] rounded-lg transition-all duration-200 overflow-visible relative group",
                  supportOpen 
                    ? "bg-primary/5 text-primary border border-primary/20" 
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-transparent"
                )}
              >
                <LifeBuoy className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">Support</span>
                <ChevronRight className={cn("w-3.5 h-3.5 opacity-50 transition-transform", supportOpen ? "rotate-90" : "group-hover:translate-x-0.5")} />
              </button>
              
              {/* Support Popover */}
              {supportOpen && (
                <div id="support-popover" className={cn(
                  "absolute bg-background/95 border border-primary/20 shadow-[0_12px_40px_rgba(0,0,0,0.15)] backdrop-blur-xl rounded-xl p-4 animate-in fade-in slide-in-from-left-2 duration-200 z-[80]",
                  "left-[calc(100%+8px)] bottom-0 w-64"
                )}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Get Help</div>
                    <button onClick={() => setSupportOpen(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <a href="#" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors text-[13px] font-medium group/link">
                      <div className="flex items-center gap-3">
                         <Slack className="w-4 h-4 text-accent" />
                         Community Slack
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover/link:opacity-100 transition-opacity" />
                    </a>
                    <a href="#" className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors text-[13px] font-medium group/link">
                      <div className="flex items-center gap-3">
                         <BookOpen className="w-4 h-4 text-primary" />
                         Documentation
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover/link:opacity-100 transition-opacity" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Project Switcher */}
            <div className="relative flex-1 w-full">
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
                  <span className="truncate">Relatim</span>
                </div>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform opacity-50 shrink-0", projectOpen && "rotate-180")} />
              </button>

              {projectOpen && (
                <div className={cn(
                  "absolute z-[80] animate-in fade-in slide-in-from-bottom-2 duration-200",
                  "left-0 right-0 bottom-full mb-2"
                )}>
                  <div className="bg-background/95 border border-primary/20 shadow-[0_12px_40px_rgba(0,0,0,0.15)] backdrop-blur-xl rounded-xl overflow-hidden p-1.5">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Projects</div>
                    <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] bg-primary/10 text-primary font-medium">
                      <span className="flex items-center gap-2">
                        <Folder className="w-4 h-4 text-accent shrink-0" />
                        Relatim
                      </span>
                      <Check className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setCreateProjectOpen(true)}
                      className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-primary hover:bg-primary/5 font-medium"
                    >
                      + New Project
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Avatar */}
            <button 
              onClick={() => setUserSettingsOpen(true)}
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-[13px] hover:ring-2 hover:ring-primary/20 transition-all border border-primary/20 h-10 w-10"
            >
              {user?.name?.[0]?.toUpperCase() ?? "H"}
            </button>
          </div>
        </div>
      </aside>

      {/* User Settings Modal */}
      {userSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={() => setUserSettingsOpen(false)} />
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
                    {user?.name?.[0]?.toUpperCase() ?? "H"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <span className="font-semibold text-sm">{user?.name ?? "Hariharan P"}</span>
                       <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded uppercase tracking-wider">Admin</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{user?.email ?? "hariharanpugazh@gmail.com"}</div>
                  </div>
                </div>
                <button className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border hover:bg-muted transition-colors bg-background">
                  Sign out
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Preferences */}
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 rounded border-muted bg-muted accent-primary cursor-pointer" />
                  <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                    Help LiveKit improve our products and services by enabling cookies. 
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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={() => setCreateProjectOpen(false)} />
          <div className="relative w-full max-w-[520px] bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-in zoom-in-95 fade-in duration-200 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-border/50">
              <h2 className="text-[17px] font-semibold text-foreground">Create a new project</h2>
              <button onClick={() => setCreateProjectOpen(false)} className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
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
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-border/50 bg-muted/30">
              <button 
                onClick={() => setCreateProjectOpen(false)}
                className="px-6 py-2 bg-muted hover:bg-muted/80 text-foreground text-[13px] font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
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

      {/* Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-[110] flex items-start justify-center pt-20">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={() => {
            setSearchOpen(false);
            setSearchQuery("");
          }} />
          <div className="relative w-full max-w-[640px] mx-4 animate-in zoom-in-95 fade-in slide-in-from-top-4 duration-200">
            <div className="bg-background/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[600px]">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50 bg-background">
                <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Search by exact ID or name within Relatim"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                  autoFocus
                />
                <button 
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }}
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Results */}
              <div className="flex-1 overflow-y-auto">
                {searchQuery.trim() === "" ? (
                  <div className="flex items-center justify-center py-20 px-6">
                    <div className="text-center space-y-3">
                      <Search className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                      <p className="text-[13px] text-muted-foreground">
                        Search by exact room or participant name, as well as session, participant, egress or call ID.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 px-6">
                    <div className="text-center space-y-3">
                      <p className="text-[14px] font-medium text-foreground">
                        No results found for "<span className="font-semibold">{searchQuery}</span>".
                      </p>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">
                        Try searching by exact room or participant name, as well as session, participant, egress or call ID.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Info */}
              <div className="px-5 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Press <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs font-medium mx-1">ESC</kbd> to close</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
