"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { DashboardLayout } from "../layouts/DashboardLayout";
import AgentPreview from "./AgentPreview";
import { Button } from "../ui/Button";
import { ChevronRight, Save, Rocket, Activity } from "lucide-react";

interface AgentLayoutProps {
    children: React.ReactNode;
}

export default function AgentLayout({
    children,
}: AgentLayoutProps) {
    const pathname = usePathname();
    const params = useParams();
    const agentId = Array.isArray(params.agentId) ? params.agentId[0] : params.agentId;

    const isOverview = pathname?.includes("/overview");

    const tabs = [
        { name: "Overview", path: `/agents/${agentId}/overview` },
        { name: "Instructions", path: `/agents/${agentId}/instructions` },
        { name: "Models & Voice", path: `/agents/${agentId}/models` },
        { name: "Actions", path: `/agents/${agentId}/actions` },
        { name: "Logs", path: `/agents/${agentId}/logs` },
        { name: "Transcripts", path: `/agents/${agentId}/transcripts` },
        { name: "Advanced", path: `/agents/${agentId}/advanced` },
        { name: "Deploy", path: `/agents/${agentId}/deploy` },
    ];

    const isActive = (path: string) => pathname === path;

    return (
        <DashboardLayout>
            <div className="flex flex-col h-screen md:h-[calc(100vh_-_20px)] overflow-hidden">

                <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-background/80 backdrop-blur-xl z-20">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1.5 font-medium">
                            <Link href="/dashboard" className="hover:text-foreground transition-colors">Divith</Link>
                            <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                            <Link href="/agents" className="hover:text-foreground transition-colors">Agents</Link>
                            <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                            <span className="text-foreground font-display font-semibold">{agentId}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center relative">
                                <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_theme(colors.amber.500)]" />
                                <div className="absolute inset-0 w-2 h-2 rounded-full bg-amber-500 animate-ping opacity-75" />
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider font-semibold">Pending Deploy</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" className="hidden md:flex gap-2 border-white/10 bg-surface/50 text-muted-foreground hover:text-foreground">
                            <Save className="w-3.5 h-3.5" />
                            <span>Changes saved</span>
                        </Button>
                        <Link href={`/agents/${agentId}/deploy`}>
                            <Button size="sm" variant="primary" className="gap-2 px-5 shadow-lg shadow-primary/20">
                                <Rocket className="w-3.5 h-3.5" />
                                <span>Deploy</span>
                            </Button>
                        </Link>
                    </div>
                </header>


                <div className="px-6 border-b border-white/5 bg-surface/30 backdrop-blur-sm">
                    <div className="flex items-center gap-8 overflow-x-auto no-scrollbar">
                        {tabs.map((tab) => (
                            <Link
                                key={tab.path}
                                href={tab.path}
                                className={`py-4 text-sm font-medium border-b-2 transition-all duration-300 relative ${isActive(tab.path)
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-white/10"
                                    }`}
                            >
                                {tab.name}
                                {isActive(tab.path) && (
                                    <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent pointer-events-none" />
                                )}
                            </Link>
                        ))}
                    </div>
                </div>


                <div className="flex-1 overflow-hidden flex">

                    <div className={`flex-1 overflow-y-auto bg-black/20 ${isOverview ? 'w-full' : ''}`}>
                        {children}
                    </div>


                    {!isOverview && (
                        <div className="hidden lg:block w-[400px] border-l border-white/5 bg-surface/30 backdrop-blur-md flex-shrink-0 relative z-10 shadow-2xl">
                            <AgentPreview />
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
