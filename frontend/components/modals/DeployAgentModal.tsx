"use client";

import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Copy, Check, ChevronDown, ChevronRight, Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface DeployAgentModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectUrl: string;
}

export function DeployAgentModal({ isOpen, onClose, projectUrl }: DeployAgentModalProps) {
    const [copiedStep, setCopiedStep] = useState<number | null>(null);

    const copyToClipboard = (text: string, step: number) => {
        navigator.clipboard.writeText(text);
        setCopiedStep(step);
        setTimeout(() => setCopiedStep(null), 2000);
    };

    const steps = [
        {
            title: "Install the CLI",
            command: "winget install LiveKit.LiveKitCLI",
            desc: "View full instructions in our documentation."
        },
        {
            title: "Authenticate",
            command: "lk cloud auth",
            desc: null
        },
        {
            title: "Use a starter template (optional)",
            command: "lk app create \\\n  --template agent-starter-python <my-app>; cd <my-app>",
            desc: null
        },
        {
            title: "Create a new deployable agent",
            command: "lk agent create",
            desc: null
        }
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
            <div 
                className="w-full max-w-2xl bg-card border border-border/50 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden"
                role="dialog"
                aria-labelledby="deploy-agent-title"
                aria-describedby="deploy-agent-description"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-border/40 bg-card">
                    <h2 id="deploy-agent-title" className="text-lg font-extrabold text-foreground tracking-tight">Deploy an agent to LiveKit Cloud</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-xl transition-all text-muted-foreground/60 hover:text-foreground"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-8 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Info Box */}
                    <div id="deploy-agent-description" className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-900/20 rounded-xl p-4 flex gap-4">
                        <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 mt-0.5">
                            <Info className="w-3.5 h-3.5 text-amber-700 dark:text-amber-500" />
                        </div>
                        <div className="text-[13px] text-amber-900/80 dark:text-amber-200/60 leading-relaxed">
                            You must use the LiveKit CLI to deploy an agent to LiveKit Cloud.
                            <br />
                            <a href="#" className="text-amber-700 dark:text-amber-500 font-bold underline decoration-amber-700/30 hover:decoration-amber-700 transition-all">Learn more in the docs.</a>
                        </div>
                    </div>

                    {/* Setup Section */}
                    <div className="space-y-5">
                        <div className="flex items-center gap-2.5 text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                            <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                            Setup
                        </div>

                        <div className="space-y-8 pl-6 border-l border-border/40 ml-1.5">
                            {steps.map((step, idx) => (
                                <div key={idx} className="space-y-3 relative">
                                    <div className="absolute -left-[29px] top-0 w-[14px] h-[14px] rounded-full bg-card border-2 border-border/60" />
                                    <div className="text-[13px] font-bold text-foreground flex items-center gap-2">
                                        <span className="text-muted-foreground/40 font-mono text-[11px]">{idx + 1}.</span>
                                        {step.title}
                                    </div>
                                    <div className="relative group">
                                        <pre className="bg-slate-950 border border-white/5 rounded-xl p-4 text-[12px] font-mono text-blue-400 overflow-x-auto shadow-inner">
                                            <code>{step.command}</code>
                                        </pre>
                                        <button
                                            onClick={() => copyToClipboard(step.command, idx)}
                                            className="absolute right-3 top-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 border border-white/5"
                                            aria-label={`Copy ${step.title} command to clipboard`}
                                        >
                                            {copiedStep === idx ? (
                                                <Check className="w-4 h-4 text-green-400" />
                                            ) : (
                                                <Copy className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                    {step.desc && (
                                        <div className="text-[12px] text-muted-foreground/60 leading-relaxed font-medium">
                                            {step.desc.includes("documentation") ? (
                                                <>View full instructions in our <a href="#" className="text-primary font-bold hover:underline">documentation</a>.</>
                                            ) : (
                                                step.desc
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Configuration Section */}
                    <div className="pt-6 border-t border-border/40">
                        <div className="flex items-center gap-2.5 text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] cursor-pointer group hover:text-foreground transition-colors">
                            <ChevronRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                            Configuration, monitoring, and logs
                        </div>
                        <div className="mt-4 text-[12px] text-muted-foreground/60 pl-6 font-medium leading-relaxed">
                            For additional instructions, see the <a href="#" className="text-primary font-bold hover:underline">documentation</a>.
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end px-8 py-6 border-t border-border/40 bg-muted/5">
                    <Button
                        onClick={onClose}
                        className="bg-primary hover:bg-primary/90 text-white font-bold text-[12px] uppercase tracking-widest px-8 py-3 h-auto rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
}
