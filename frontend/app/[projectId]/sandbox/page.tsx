"use client";

import React, { useState, useEffect } from "react";
// DashboardLayout removed
import Header from "../../components/Header";
import { Button } from "../../../components/ui/Button";
import {
  ChevronLeft,
  ChevronRight,
  Monitor,
  Database,
  Users,
  ExternalLink,
} from "lucide-react";

export default function ProjectSandboxPage(props: any) {
  const [projectName, setProjectName] = useState("AIRA");

  useEffect(() => {
    const name = localStorage.getItem("projectName") || "AIRA";
    setProjectName(name);
  }, []);

  return (
    <>
      <Header
        projectName={projectName}
        pageName="Sandbox"
        showTimeRange={false}
      />

      <div className="p-8 space-y-12">
        {/* Get started section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-medium text-foreground">Get started</h2>
            <div className="flex gap-1">
              <button className="p-1 rounded border border-border/40 hover:bg-surface transition-colors disabled:opacity-30" disabled>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="p-1 rounded border border-border/40 hover:bg-surface transition-colors disabled:opacity-30" disabled>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: Web Voice Agent */}
            <div className="group cursor-pointer rounded-xl border border-border/60 bg-white dark:bg-surface/30 hover:shadow-lg dark:hover:border-primary/40 transition-all overflow-hidden shadow-sm">
              <div className="h-44 bg-slate-300/80 dark:bg-black/40 flex items-center justify-center relative overflow-hidden">
                <div className="flex items-center gap-1.5 h-12">
                  {[0.4, 0.7, 1, 0.6, 0.8, 0.4].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-white rounded-full shadow-sm"
                      style={{ height: `${h * 100}%` }}
                    />
                  ))}
                </div>
                {/* Speech bubbles style from image */}
                <div className="absolute top-4 left-4 scale-75 origin-top-left opacity-80">
                  <div className="bg-white/40 dark:bg-muted/20 backdrop-blur-sm rounded-full px-3 py-1 text-[10px] mb-2 font-medium">How are you?</div>
                  <div className="bg-blue-600/40 dark:bg-blue-600/30 backdrop-blur-sm rounded-full px-3 py-1 text-[10px] text-white">Hello, how are you?</div>
                </div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 scale-75">
                  <div className="w-8 h-8 rounded-full bg-white/40 dark:bg-muted/20 backdrop-blur-sm flex items-center justify-center shadow-sm"><Monitor className="w-4 h-4 text-white dark:text-white/60" /></div>
                  <div className="w-8 h-8 rounded-full bg-white/40 dark:bg-muted/20 backdrop-blur-sm flex items-center justify-center shadow-sm"><Users className="w-4 h-4 text-white dark:text-white/60" /></div>
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">Web Voice Agent</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A starter app for Next.js, featuring a flexible voice AI frontend
                </p>
              </div>
            </div>

            {/* Card 2: Token server */}
            <div className="group cursor-pointer rounded-xl border border-border/60 bg-white dark:bg-surface/30 hover:shadow-lg dark:hover:border-primary/40 transition-all overflow-hidden shadow-sm">
              <div className="h-44 bg-slate-300/80 dark:bg-black/40 flex items-center justify-center relative">
                <div className="absolute inset-0 opacity-10 dark:opacity-10"
                  style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '16px 16px' }}
                />
                <div className="w-12 h-12 rounded-lg bg-white/40 dark:bg-muted/20 border border-white/20 flex items-center justify-center relative z-10 shadow-sm backdrop-blur-sm">
                  <Database className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">Token server</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A hosted token server to help you prototype your mobile applications faster
                </p>
              </div>
            </div>

            {/* Card 3: Video conference */}
            <div className="group cursor-pointer rounded-xl border border-border/60 bg-white dark:bg-surface/30 hover:shadow-lg dark:hover:border-primary/40 transition-all overflow-hidden shadow-sm">
              <div className="h-44 bg-slate-300/80 dark:bg-black/40 flex items-center justify-center relative p-6">
                <div className="w-full h-full border border-white/20 rounded-md bg-white/20 backdrop-blur-sm flex gap-2 p-2 shadow-sm">
                  <div className="flex-1 bg-white/20 rounded flex items-center justify-center">
                    <Users className="w-6 h-6 text-white/40 dark:text-white/20" />
                  </div>
                  <div className="w-12 flex flex-col gap-2">
                    <div className="h-10 bg-white/10 rounded" />
                    <div className="h-10 border border-white/40 rounded bg-white/30" />
                    <div className="h-10 bg-white/10 rounded" />
                  </div>
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">Video conference</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  An open source video conferencing app built on LiveKit Components, LiveKit Cloud, and...
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sandbox apps section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-medium text-foreground">Sandbox apps</h2>
          </div>

          <div className="w-full min-h-[300px] rounded-xl border border-border/40 bg-zinc-50 dark:bg-surface/10 flex flex-col items-center justify-center text-center p-8 border-dashed">
            <div className="mb-6 opacity-30 dark:opacity-40">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 dark:text-foreground">
                <path d="M3 13h18"></path>
                <path d="M12 13v8"></path>
                <path d="m8 13-2 8"></path>
                <path d="m16 13 2 8"></path>
                <path d="M7 2h10l1 11H6L7 2Z"></path>
              </svg>
            </div>
            <div className="max-w-md space-y-4">
              <p className="text-muted-foreground text-sm leading-relaxed">
                Sandbox allows you to quickly prototype apps and agents running in your cloud without the need to manage deployments and tokens. Read our <a href="#" className="text-primary hover:underline inline-flex items-center gap-0.5">sandbox documentation<ExternalLink className="w-3 h-3" /></a> to learn more.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
