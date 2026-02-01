"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface AnalyticsCardProps {
    title: string;
    children: React.ReactNode;
    className?: string;
    headerAction?: React.ReactNode;
}

export function AnalyticsCard({ title, children, className, headerAction }: AnalyticsCardProps) {
    return (
        <div className={cn("relative rounded-xl border border-border bg-surface/50 overflow-hidden group text-foreground", className)}>

            <div className="absolute inset-0 bg-primary/[0.02] pointer-events-none" />


            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    {title}
                    <div className="w-1 h-1 rounded-full bg-muted-foreground/50 group-hover:bg-primary/50 transition-colors" />
                </h3>
                {headerAction}
            </div>


            <div className="p-4 relative z-10">
                {children}
            </div>
        </div>
    );
}
