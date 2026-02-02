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
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [telephonyOpen, setTelephonyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItem = (href: string, label: string, Icon: any) => {
    const isActive = pathname === href;
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-200 group relative",
          isActive
            ? "bg-primary/10 text-primary font-semibold"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          isCollapsed && "justify-center px-0 h-10 w-10 mx-auto"
        )}
        title={isCollapsed ? label : ""}
      >
        <Icon className={cn("w-4 h-4 transition-colors shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
        {!isCollapsed && <span className="flex-1 truncate">{label}</span>}
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
          !isCollapsed ? "ml-7" : "mx-2 justify-center",
          isActive
            ? "text-primary font-medium bg-primary/5"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        )}
      >
        {!isCollapsed ? label : <div className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />}
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
    if (isCollapsed) {
      return (
        <div className="relative group/section">
          <button
            className={cn(
              "flex items-center justify-center h-10 w-10 mx-auto rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all duration-200",
              isOpen && "bg-primary/5 text-primary"
            )}
            onClick={() => setIsOpen(!isOpen)}
          >
            <Icon className="w-4 h-4" />
          </button>
          
          {/* Floating Menu for Collapsed State */}
          <div className="absolute left-[calc(100%+8px)] top-0 hidden group-hover/section:block z-[70] animate-in fade-in slide-in-from-left-2 duration-200">
            <div className="bg-background border border-border/80 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl rounded-xl p-1.5 min-w-[160px]">
              <div className="px-3 py-1.5 text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">{label}</div>
              <div className="space-y-0.5 mt-1">
                {children}
              </div>
            </div>
          </div>
        </div>
      );
    }

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
      <aside className={cn(
        "h-screen flex flex-col border-r bg-background sticky top-0 font-sans text-foreground transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[72px]" : "w-64"
      )}>
        {/* Header */}
        <div className={cn("px-6 py-5 flex items-center justify-between", isCollapsed && "px-0 justify-center")}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4 text-white" />
            </div>
            {!isCollapsed && <span className="font-bold text-[15px] tracking-tight animate-in fade-in slide-in-from-left-2 transition-all">LiveKit</span>}
          </div>
          
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200",
              isCollapsed && "absolute -right-3 top-6 bg-background border shadow-sm z-50 rounded-full"
            )}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-4 h-4 rotate-90" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-hide",
          isCollapsed && "px-2"
        )}>
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
        <div className={cn("mt-auto p-4 space-y-4", isCollapsed && "px-2")}>
          {/* Search & Support Buttons */}
          <div className="space-y-1">
            <button className={cn(
              "w-full flex items-center gap-3 px-3 py-2 text-[13px] text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-lg transition-colors group",
              isCollapsed && "justify-center px-0 h-10 w-10 mx-auto"
            )}>
              <Search className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="flex-1 text-left">Search</span>}
              {!isCollapsed && <kbd className="hidden group-hover:inline-flex px-1.5 py-0.5 bg-background border rounded text-[10px] font-sans text-muted-foreground">CTRL+K</kbd>}
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
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-transparent",
                  isCollapsed && "justify-center px-0 h-10 w-10 mx-auto"
                )}
              >
                <LifeBuoy className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span className="flex-1 text-left">Support</span>}
                {!isCollapsed && <ChevronRight className={cn("w-3.5 h-3.5 opacity-50 transition-transform", supportOpen ? "rotate-90" : "group-hover:translate-x-0.5")} />}
              </button>
              
              {/* Support Popover */}
              {supportOpen && (
                <div id="support-popover" className={cn(
                  "absolute bg-background/95 border border-primary/20 shadow-[0_12px_40px_rgba(0,0,0,0.15)] backdrop-blur-xl rounded-xl p-4 animate-in fade-in slide-in-from-left-2 duration-200 z-[80]",
                  isCollapsed ? "left-[calc(100%+12px)] bottom-0 w-64" : "left-[calc(100%+8px)] bottom-0 w-64"
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
                         <Slack className="w-4 h-4 text-[#4A154B]" />
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

          <div className="h-px bg-border/50" />

          <div className={cn("flex items-center gap-2", isCollapsed && "flex-col")}>
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
                  isCollapsed ? "h-10 w-10 mx-auto justify-center px-0" : "px-3 py-2"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="w-4 h-4 text-blue-500/80 shrink-0" />
                  {!isCollapsed && <span className="truncate">Relatim</span>}
                </div>
                {!isCollapsed && <ChevronDown className={cn("w-3.5 h-3.5 transition-transform opacity-50 shrink-0", projectOpen && "rotate-180")} />}
              </button>

              {projectOpen && (
                <div className={cn(
                  "absolute z-[80] animate-in fade-in slide-in-from-bottom-2 duration-200",
                  isCollapsed ? "left-[calc(100%+12px)] bottom-0 w-56" : "left-0 right-0 bottom-full mb-2"
                )}>
                  <div className="bg-background/95 border border-primary/20 shadow-[0_12px_40px_rgba(0,0,0,0.15)] backdrop-blur-xl rounded-xl overflow-hidden p-1.5">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Projects</div>
                    <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] bg-primary/10 text-primary font-medium">
                      <span className="flex items-center gap-2">
                        <Folder className="w-4 h-4 text-blue-500/80 shrink-0" />
                        Relatim
                      </span>
                      <Check className="w-4 h-4" />
                    </button>
                    <div className="h-px bg-border my-1.5 mx-1" />
                    <button className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-primary hover:bg-primary/5 font-medium">
                      + New Project
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Avatar */}
            <button 
              onClick={() => setUserSettingsOpen(true)}
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold text-[13px] hover:ring-2 hover:ring-primary/20 transition-all border border-blue-200/50 dark:border-blue-800/50 h-10 w-10"
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
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-blue-500/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
