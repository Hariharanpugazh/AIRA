"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Card } from "../../../../../components/ui/Card";
import { StatsCard } from "../../../../../components/StatsCard";
import { Info, Server, Activity, Clock, Shield } from "lucide-react";
import { Button } from "../../../../../components/ui/Button";

export default function AgentOverviewPage() {
    const params = useParams();
    const agentId = Array.isArray(params.agentId) ? params.agentId[0] : params.agentId;

    return (
        <div className="p-6 md:p-8 animate-fade-in max-w-7xl mx-auto">

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card variant="glass" className="p-5 flex flex-col justify-between group hover:border-primary/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1.5 mb-2">
                        Agent Name <Info className="w-3 h-3 cursor-help text-muted-foreground/60 hover:text-foreground" />
                    </span>
                    <span className="text-base font-display font-medium text-foreground group-hover:text-primary transition-colors truncate">Medical Assistant</span>
                </Card>
                <Card variant="glass" className="p-5 flex flex-col justify-between group hover:border-primary/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1.5 mb-2">
                        Agent ID <Info className="w-3 h-3 cursor-help text-muted-foreground/60 hover:text-foreground" />
                    </span>
                    <span className="text-base font-mono font-medium text-foreground truncate group-hover:text-primary transition-colors">{agentId}</span>
                </Card>
                <Card variant="glass" className="p-5 flex flex-col justify-between group hover:border-primary/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1.5 mb-2">
                        Active Sessions <Activity className="w-3 h-3 cursor-help text-muted-foreground/60 hover:text-foreground" />
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-display font-bold text-foreground">0</span>
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    </div>
                </Card>
                <Card variant="glass" className="p-5 flex flex-col justify-between group hover:border-primary/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1.5 mb-2">
                        Region <Server className="w-3 h-3 cursor-help text-muted-foreground/60 hover:text-foreground" />
                    </span>
                    <span className="text-base font-medium text-foreground flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        US East (N. Virginia)
                    </span>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

                <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-display font-medium text-foreground">Analytics</h2>
                        <div className="flex gap-2">
                            {['24h', '7d', '30d'].map((period) => (
                                <button key={period} className={`text-xs px-3 py-1 rounded-md border transition-all ${period === '7d' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-surface border-border text-muted-foreground hover:text-foreground'}`}>
                                    {period}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Card variant="glass" className="p-6 h-[300px] flex flex-col">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Sessions Served</span>
                            <Info className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 flex items-end justify-between px-2 gap-1.5 border-b border-border pb-2">
                            {[...Array(24)].map((_, i) => (
                                <div
                                    key={i}
                                    className="w-full bg-primary/20 rounded-t-sm hover:bg-primary/40 transition-all duration-300 relative group"
                                    style={{ height: `${Math.random() * 80 + 10}%` }}
                                >
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface border border-border text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                        {Math.floor(Math.random() * 50)} sessions
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-3 font-mono">
                            <span>00:00</span>
                            <span>06:00</span>
                            <span>12:00</span>
                            <span>18:00</span>
                            <span>23:59</span>
                        </div>
                    </Card>
                </div>


                <div className="space-y-6">
                    <h2 className="text-lg font-display font-medium text-foreground invisible">Metrics</h2>
                    <Card variant="glass" className="p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Clock className="w-20 h-20 text-blue-500 rotate-12" />
                        </div>
                        <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider mb-2 flex items-center gap-2">
                            Uptime (30d) <Info className="w-3.5 h-3.5" />
                        </span>
                        <div className="text-4xl font-display font-bold text-foreground mt-4 mb-1">99.9%</div>
                        <div className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            Operational
                        </div>
                    </Card>

                    <Card variant="glass" className="p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Activity className="w-20 h-20 text-purple-500 -rotate-12" />
                        </div>
                        <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider mb-2 flex items-center gap-2">
                            Avg. Latency <Info className="w-3.5 h-3.5" />
                        </span>
                        <div className="text-4xl font-display font-bold text-foreground mt-4 mb-1">124ms</div>
                        <div className="text-xs text-muted-foreground font-medium">
                            <span className="text-emerald-500">-12ms</span> vs last week
                        </div>
                    </Card>
                </div>
            </div>


            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-display font-medium text-foreground">Configuration</h3>
                </div>

                <Card variant="glass" className="overflow-hidden p-0">
                    <div className="px-6 py-4 border-b border-border bg-surface flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" />
                        <h4 className="text-sm font-semibold text-foreground">Secrets & Environment Variables</h4>
                    </div>

                    <div className="min-h-[150px] flex flex-col items-center justify-center p-8 text-center bg-background/50">
                        <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center mb-3 shadow-inner">
                            <Shield className="w-6 h-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm text-muted-foreground font-medium">No secrets configured</p>
                        <p className="text-xs text-muted-foreground/60 max-w-xs mt-1">
                            Securely store API keys and other sensitive information for your agent flow.
                        </p>
                        <Button variant="outline" size="sm" className="mt-4 border-border hover:bg-surface-hover">
                            Add Secret
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}
