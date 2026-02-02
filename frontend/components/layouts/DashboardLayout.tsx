"use client";

import React, { useState } from "react";
import Sidebar from "../../app/components/Sidebar";
import { Menu, X } from "lucide-react";

interface DashboardLayoutProps {
    children: React.ReactNode;
}

import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "../ui/ThemeToggle";

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const { user, isLoading } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
            </div>
        );
    }


    return (
        <div className="min-h-screen bg-background text-foreground flex relative">

            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-xl border-b border-border/50 flex items-center px-4 z-40 justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <span className="font-semibold text-lg tracking-tight">Relatim</span>
                </div>
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-xs font-bold text-white">
                        {user?.name?.[0]?.toUpperCase() || "U"}
                    </div>
                </div>
            </div>


            <div className="hidden md:block w-[260px] fixed inset-y-0 left-0 z-30">
                <Sidebar user={user} className="w-full h-full" />
            </div>


            {isSidebarOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                    <div className="absolute inset-y-0 left-0 w-[260px] animate-slide-right">
                        <Sidebar
                            user={user}
                            onClose={() => setIsSidebarOpen(false)}
                            className="w-full h-full shadow-2xl"
                        />
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="absolute top-4 right-[-40px] p-2 bg-surface border border-white/10 rounded-lg text-foreground shadow-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}


            <main className="flex-1 w-full md:ml-[260px] min-h-screen transition-all duration-300 pt-16 md:pt-0">
                <div className="max-w-[1600px] mx-auto p-4 md:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}

