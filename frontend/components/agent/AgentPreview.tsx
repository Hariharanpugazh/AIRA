"use client";

import React, { useState } from "react";
import { Button } from "../ui/Button";
import { Mic, PhoneOff, Terminal, XCircle, Code2 } from "lucide-react";

export default function AgentPreview() {
    const [isConnected, setIsConnected] = useState(false);
    const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');

    return (
        <div className="flex flex-col h-full bg-black/40 backdrop-blur-sm relative">
            
            <div className="flex items-center justify-between px-4 py-0 border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => setActiveTab('preview')}
                        className={`text-xs font-medium py-3 border-b-2 transition-all ${activeTab === 'preview' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        Preview
                    </button>
                    <button
                        onClick={() => setActiveTab('code')}
                        className={`text-xs font-medium py-3 border-b-2 transition-all ${activeTab === 'code' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        Code
                    </button>
                </div>
            </div>

            
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />

                {!isConnected ? (
                    <div className="relative z-10 w-full max-w-xs mx-auto">
                        <div className="w-20 h-20 rounded-2xl bg-surface border border-white/5 flex items-center justify-center mb-6 mx-auto shadow-2xl shadow-black/50">
                            <Mic className="w-8 h-8 text-muted-foreground" />
                        </div>

                        <h3 className="text-foreground font-display font-medium text-lg mb-2">Test your agent</h3>
                        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                            Start a call to interact with your agent in real-time.
                        </p>

                        <Button
                            onClick={() => setIsConnected(true)}
                            variant="primary"
                            className="w-full gap-2 shadow-lg shadow-primary/20"
                        >
                            <Mic className="w-4 h-4" />
                            Start Call
                        </Button>
                    </div>
                ) : (
                    <div className="relative z-10 flex flex-col items-center w-full">
                        <div className="relative mb-8">
                            <div className="absolute inset-0 bg-primary/20 blur-[30px] rounded-full animate-pulse-slow" />
                            <div className="w-24 h-24 rounded-full bg-surface border border-white/10 flex items-center justify-center relative z-10 shadow-2xl">
                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                                    <div className="flex items-center gap-0.5 h-8">
                                        {[...Array(5)].map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-1 bg-primary rounded-full animate-pulse"
                                                style={{
                                                    height: `${Math.random() * 100}%`,
                                                    animationDuration: '0.8s',
                                                    animationDelay: `${i * 0.1}s`
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-surface border border-white/10 px-2 py-0.5 rounded-full text-[10px] font-mono text-primary shadow-sm whitespace-nowrap">
                                00:12
                            </div>
                        </div>

                        <p className="text-foreground font-medium mb-1">Medical Assistant</p>
                        <p className="text-emerald-500 text-xs mb-8 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Connected
                        </p>

                        <div className="w-full max-w-xs">
                            <Button
                                variant="danger"
                                onClick={() => setIsConnected(false)}
                                className="w-full gap-2"
                            >
                                <PhoneOff className="w-4 h-4" />
                                End Call
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            
            <div className="border-t border-white/5 bg-black/40 backdrop-blur-md">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/5">
                    <div className="flex items-center gap-2">
                        <Terminal className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Live Logs</span>
                    </div>
                    <button className="text-[10px] text-muted-foreground hover:text-foreground uppercase transition-colors flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Clear
                    </button>
                </div>
                <div className="h-32 p-3 overflow-y-auto font-mono text-[11px] text-muted-foreground scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    <div className="mb-1.5 opacity-50 select-none">Waiting for connection...</div>
                    {isConnected && (
                        <div className="space-y-1 animate-fade-in">
                            <div className="text-emerald-400/90 flex gap-2">
                                <span className="opacity-50">10:42:01</span>
                                <span>[System] Connection established</span>
                            </div>
                            <div className="text-blue-400/90 flex gap-2">
                                <span className="opacity-50">10:42:02</span>
                                <span>[Agent] Hello! I'm your medical assistant. How can I help you today?</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
