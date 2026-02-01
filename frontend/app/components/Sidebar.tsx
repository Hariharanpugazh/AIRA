"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  OverviewIcon,
  SessionsIcon,
  AgentsIcon,
  TelephonyIcon,
  CallsIcon,
  DispatchIcon,
  SipTrunksIcon,
  EgressesIcon,
  IngressesIcon,
  SandboxIcon,
  SettingsIcon,
  ProjectIcon,
  TeamIcon,
  ApiKeysIcon,
  WebhooksIcon,
  SearchIcon,
  SupportIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from "./icons";
import { ThemeToggle } from "../../components/ui/ThemeToggle";
import { DollarSign } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  user: { name: string; email: string } | null;
  className?: string;
  onClose?: () => void;
}

export default function Sidebar({ user, className, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [telephonyOpen, setTelephonyOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);

  const isActive = (path: string) => pathname === path;
  const isTelephonyActive = pathname?.startsWith("/telephony");
  const isSettingsActive = pathname?.startsWith("/settings");

  useEffect(() => {
    if (isTelephonyActive) setTelephonyOpen(true);
    if (isSettingsActive) setSettingsOpen(true);
  }, [isTelephonyActive, isSettingsActive]);

  const navItemClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group relative overflow-hidden font-display",
      active
        ? "bg-primary/10 text-primary font-medium shadow-sm shadow-primary/5"
        : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
    );

  const subNavItemClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 pl-9 border-l border-transparent font-display",
      active
        ? "text-primary font-medium border-primary/20 bg-primary/5"
        : "text-muted-foreground hover:text-foreground hover:bg-surface-hover border-transparent"
    );

  return (
    <aside className={cn("bg-background border-r border-border flex flex-col h-full font-sans", className)}>

      <div className="px-6 py-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-3 group" onClick={onClose}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-all duration-300">
            <span className="text-primary-foreground text-lg font-bold font-display">R</span>
          </div>
          <span className="text-foreground font-display font-semibold text-xl tracking-tight group-hover:text-primary transition-colors">
            Relatim
          </span>
        </Link>
      </div>


      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        <Link href="/dashboard" className={navItemClass(isActive("/dashboard"))} onClick={onClose}>
          <OverviewIcon />
          Overview
        </Link>
        <Link href="/sessions" className={navItemClass(isActive("/sessions"))} onClick={onClose}>
          <SessionsIcon />
          Sessions
        </Link>
        <Link href="/agents" className={navItemClass(isActive("/agents"))} onClick={onClose}>
          <AgentsIcon />
          Agents
        </Link>

        <div className="pt-2">
          <button
            onClick={() => setTelephonyOpen(!telephonyOpen)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors group",
              isTelephonyActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            )}
          >
            <span className="flex items-center gap-3">
              <TelephonyIcon />
              Telephony
            </span>
            <ChevronRightIcon className={cn("w-4 h-4 transition-transform duration-200 text-muted-foreground group-hover:text-foreground", telephonyOpen && "rotate-90")} />
          </button>
          <div className={cn("grid transition-all duration-300 ease-in-out", telephonyOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
            <div className="overflow-hidden space-y-0.5 mt-1">
              <Link href="/telephony/calls" className={subNavItemClass(isActive("/telephony/calls"))} onClick={onClose}>
                <CallsIcon />
                Calls
              </Link>
              <Link href="/telephony/dispatch-rules" className={subNavItemClass(isActive("/telephony/dispatch-rules"))} onClick={onClose}>
                <DispatchIcon />
                Dispatch rules
              </Link>
              <Link href="/telephony/phone-numbers" className={subNavItemClass(isActive("/telephony/phone-numbers"))} onClick={onClose}>
                <SipTrunksIcon />
                Phone numbers
              </Link>
              <Link href="/telephony/sip-trunks" className={subNavItemClass(isActive("/telephony/sip-trunks"))} onClick={onClose}>
                <SipTrunksIcon />
                SIP trunks
              </Link>
            </div>
          </div>
        </div>

        <Link href="/egresses" className={navItemClass(isActive("/egresses"))} onClick={onClose}>
          <EgressesIcon />
          Egresses
        </Link>
        <Link href="/ingresses" className={navItemClass(isActive("/ingresses"))} onClick={onClose}>
          <IngressesIcon />
          Ingresses
        </Link>
        <Link href="/sandbox" className={navItemClass(isActive("/sandbox"))} onClick={onClose}>
          <SandboxIcon />
          Sandbox
        </Link>

        <div className="pt-2">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors group",
              isSettingsActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            )}
          >
            <span className="flex items-center gap-3">
              <SettingsIcon />
              Settings
            </span>
            <ChevronRightIcon className={cn("w-4 h-4 transition-transform duration-200 text-muted-foreground group-hover:text-foreground", settingsOpen && "rotate-90")} />
          </button>
          <div className={cn("grid transition-all duration-300 ease-in-out", settingsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
            <div className="overflow-hidden space-y-0.5 mt-1">
              <Link href="/settings/project" className={subNavItemClass(isActive("/settings/project"))} onClick={onClose}>
                <ProjectIcon />
                Project
              </Link>
              <Link href="/settings/members" className={subNavItemClass(isActive("/settings/members"))} onClick={onClose}>
                <TeamIcon />
                Team members
              </Link>
              <Link href="/settings/keys" className={subNavItemClass(isActive("/settings/keys"))} onClick={onClose}>
                <ApiKeysIcon />
                API keys
              </Link>
              <Link href="/settings/webhooks" className={subNavItemClass(isActive("/settings/webhooks"))} onClick={onClose}>
                <WebhooksIcon />
                Webhooks
              </Link>
              <Link href="/admin/billing" className={subNavItemClass(isActive("/admin/billing"))} onClick={onClose}>
                <DollarSign className="w-4 h-4" />
                Billing
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border space-y-1">
          <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover text-sm transition-colors group">
            <span className="flex items-center gap-3">
              <SearchIcon />
              Search
            </span>
            <kbd className="text-[10px] items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-surface text-muted-foreground group-hover:border-foreground/20 hidden sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
          <Link href="#" className="flex items-center justify-between px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover text-sm transition-colors group">
            <span className="flex items-center gap-3">
              <SupportIcon />
              Support
            </span>
            <ChevronRightIcon className="w-4 h-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
          </Link>
        </div>
      </nav>


      <div className="p-4 border-t border-border bg-background space-y-2">
        <div className="flex justify-start px-2">
          <ThemeToggle />
        </div>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-hover transition-all border border-transparent hover:border-border group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-sm font-bold text-primary-foreground shadow-sm ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 text-left overflow-hidden">
            <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{user?.name || "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email || "user@example.com"}</p>
          </div>
          <ChevronDownIcon className="text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      </div>
    </aside>
  );
}
