"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Card } from "../../../../../components/ui/Card";
import { StatsCard } from "../../../../../components/StatsCard";
import { Info, Server, Activity, Clock, Shield, Database, Cpu, Globe, Zap, ArrowUpRight } from "lucide-react";
import { Button } from "../../../../../components/ui/Button";
import { cn } from "../../../../../lib/utils";

export default function AgentOverviewPage() {
  const params = useParams();
  const agentId = Array.isArray(params.agentId) ? params.agentId[0] : params.agentId;

  return (
    <div className="p-6 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Sessions", value: "3,254", icon: Activity, trend: "+12.4%", trendUp: true },
          { label: "Avg. Latency", value: "118ms", icon: Zap, trend: "-5.2ms", trendUp: true },
          { label: "Uptime (30d)", value: "99.99%", icon: Clock, trend: "Stable", trendUp: null },
          { label: "Success Rate", value: "98.2%", icon: Globe, trend: "+0.4%", trendUp: true }
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-border/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</span>
              <div className="p-2 bg-muted/30 rounded-lg group-hover:text-primary transition-colors">
                <stat.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground">{stat.value}</span>
              {stat.trend && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                  stat.trendUp === true ? "bg-green-50 text-green-600" : 
                  stat.trendUp === false ? "bg-red-50 text-red-600" :
                  "bg-muted text-muted-foreground"
                )}>
                  {stat.trend}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Analytics Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-border/60 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between">
               <div>
                 <h3 className="font-bold flex items-center gap-2 text-foreground">
                   <Activity className="w-4.5 h-4.5 text-primary" />
                   Performance Activity
                 </h3>
                 <p className="text-xs text-muted-foreground mt-0.5">Real-time engagement and processing throughput.</p>
               </div>
               <div className="flex bg-muted/30 p-1 rounded-lg border border-border/40">
                 {['24h', '7d', '30d'].map((p) => (
                   <button key={p} className={cn(
                     "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                     p === '24h' ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                   )}>
                     {p}
                   </button>
                 ))}
               </div>
            </div>
            
            <div className="p-8">
              <div className="h-[240px] flex items-end justify-between gap-1.5 border-b border-border/40 pb-2 relative">
                {/* Simulated Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none opacity-50">
                   {[...Array(5)].map((_, i) => (
                     <div key={i} className="w-full border-t border-dashed border-border/40" />
                   ))}
                </div>
                
                {[...Array(32)].map((_, i) => (
                  <div key={i} className="group relative flex-1 flex flex-col justify-end h-full">
                    <div 
                      className="w-full bg-[oklch(0.627_0.265_273.15)]/20 rounded-t-sm group-hover:bg-[oklch(0.627_0.265_273.15)]/40 transition-all duration-300 relative"
                      style={{ height: `${20 + Math.random() * 70}%` }}
                    >
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-bold py-1.5 px-2.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-30 shadow-xl scale-95 group-hover:scale-100">
                        {Math.floor(Math.random() * 100)} Requests
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-4 font-bold uppercase tracking-wider">
                <span>12:00 AM</span>
                <span>06:00 AM</span>
                <span>12:00 PM</span>
                <span>06:00 PM</span>
                <span>11:59 PM</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-border/60 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-border/60 bg-muted/10">
              <h3 className="font-bold flex items-center gap-2 text-foreground">
                <Database className="w-4.5 h-4.5 text-primary" />
                Resource Configuration
              </h3>
            </div>
            <div className="divide-y divide-border/40">
              {[
                { label: "Deployment Region", value: "US-East (N. Virginia)", icon: Globe },
                { label: "Agent Environment", value: "Production v2.4.1", icon: Server },
                { label: "Compute Engine", value: "Dedicated Instance (2 vCPU)", icon: Cpu },
                { label: "Data Retention", value: "30 Days (Rolling)", icon: Clock }
              ].map((item, i) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted/20 border border-border/40 rounded-lg">
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info & Activity Feed */}
        <div className="space-y-6">
          <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-5">Agent Identity</h3>
            <div className="space-y-5">
               <div className="p-4 bg-muted/20 rounded-xl border border-border/40">
                 <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                   Internal ID <Info className="w-3 h-3" />
                 </div>
                 <div className="font-mono text-sm text-foreground break-all bg-white px-2 py-1 rounded border border-border/40">{agentId}</div>
               </div>
               
               <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <span className="text-xs text-muted-foreground font-medium">Model</span>
                   <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full">GPT-4o</span>
                 </div>
                 <div className="flex items-center justify-between">
                   <span className="text-xs text-muted-foreground font-medium">Last Deployment</span>
                   <span className="text-xs font-medium text-foreground">3h ago by <span className="underline">D. Relatim</span></span>
                 </div>
                 <div className="flex items-center justify-between">
                   <span className="text-xs text-muted-foreground font-medium">API Version</span>
                   <span className="text-xs font-medium font-mono">v1.2.0-stable</span>
                 </div>
               </div>
            </div>
          </div>

          <div className="bg-white border border-border/60 rounded-2xl p-6 shadow-sm">
             <div className="flex items-center justify-between mb-5">
               <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Secrets & Safety</h3>
               <Shield className="w-4 h-4 text-amber-500" />
             </div>
             
             <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100/50 mb-5">
               <p className="text-xs text-amber-900 leading-relaxed font-medium">
                 Ensure all API keys and LLM providers are configured in the Models section.
               </p>
             </div>

             <Button variant="outline" className="w-full border-border/60 shadow-sm rounded-xl">
               Manage Environment
             </Button>
          </div>

          <div className="bg-[oklch(0.627_0.265_273.15)]/5 rounded-2xl p-6 border border-[oklch(0.627_0.265_273.15)]/10 text-center">
             <div className="w-10 h-10 bg-white shadow-sm rounded-lg flex items-center justify-center mx-auto mb-3">
               <ArrowUpRight className="w-5 h-5 text-primary" />
             </div>
             <h4 className="text-sm font-bold text-foreground">Need help scaling?</h4>
             <p className="text-[11px] text-muted-foreground mt-1 mb-4">Read our documentation on deploying voice agents at scale.</p>
             <button className="text-xs font-bold text-primary hover:underline uppercase tracking-wider">Read Guide →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
    );
}
