"use client";

import React, { useState } from "react";
import { Button } from "../ui/Button";
import { Mic, PhoneOff, Terminal, XCircle, Code2 } from "lucide-react";

export default function AgentPreview() {
    const [isConnected, setIsConnected] = useState(false);
    const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');

    const pythonCode = `import logging
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    cli,
    inference,
    room_io,
)
from livekit.plugins import (
    noise_cancellation,
    silero,
)
from livekit.plugins.turn_detector.multilingual import MultilingualModel

logger = logging.getLogger("agent-finley-1e01")

load_dotenv(".env.local")


class DefaultAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a friendly, reliable voice assistant..."""
            # Output rules
            # You are interacting with the user via voice...
        )`;

    return (
        <div className="flex flex-col h-full bg-surface relative">
            
            <div className="flex items-center justify-center px-4 border-b border-border/40 bg-muted/5">
                <div className="flex items-center w-full">
                    <button
                        onClick={() => setActiveTab('preview')}
                        className={`flex-1 text-[11px] font-bold uppercase tracking-widest py-3 border-b-2 transition-all ${activeTab === 'preview' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        Preview
                    </button>
                    <button
                        onClick={() => setActiveTab('code')}
                        className={`flex-1 text-[11px] font-bold uppercase tracking-widest py-3 border-b-2 transition-all ${activeTab === 'code' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    >
                        Code
                    </button>
                </div>
            </div>

            {activeTab === 'preview' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface border-l border-border/40">
                    {!isConnected ? (
                        <div className="flex flex-col items-center">
                            <div className="mb-8 relative">
                                <div className="flex items-center gap-1.5 h-12">
                                    {[1, 2, 3, 4, 3, 2, 3, 4, 3, 2, 1].map((h, i) => (
                                        <div
                                            key={i}
                                            className="w-1 bg-foreground/20 rounded-full"
                                            style={{ height: `${h * 20}%` }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <h3 className="text-[17px] font-bold text-foreground mb-1">Preview your agent</h3>
                            <p className="text-[13px] text-muted-foreground max-w-[280px] leading-relaxed mb-10">
                                Start a live test call to speak to your agent as you configure and iterate.
                            </p>

                            <Button
                                onClick={() => setIsConnected(true)}
                                className="bg-primary/10 hover:bg-primary/15 text-primary border border-primary/20 font-bold text-[11px] uppercase tracking-widest px-8 py-2.5 h-auto transition-all shadow-none"
                            >
                                Start Call
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center w-full">
                            <div className="mb-12 relative flex items-center justify-center h-24">
                                <div className="flex items-center gap-1 h-12">
                                    {[...Array(15)].map((_, i) => (
                                        <div
                                            key={i}
                                            className="w-1 bg-primary rounded-full animate-wave"
                                            style={{
                                                height: `${20 + Math.random() * 80}%`,
                                                animationDelay: `${i * 0.1}s`
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <p className="text-[13px] font-bold text-foreground mb-8">Agent is listening...</p>

                            <Button
                                variant="outline"
                                onClick={() => setIsConnected(false)}
                                className="border-error/20 text-error hover:bg-error/10 font-bold text-[11px] uppercase tracking-widest px-8 py-2.5 h-auto transition-colors"
                            >
                                <PhoneOff className="w-4 h-4 mr-2" />
                                End Call
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-1 overflow-hidden flex flex-col bg-muted/5">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-surface">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            <Code2 className="w-3.5 h-3.5" />
                            agent.py
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md">
                                <Terminal className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto bg-surface font-mono text-[12px] leading-relaxed text-foreground/80 flex">
                        <div className="w-12 bg-muted/10 border-r border-border/40 flex flex-col items-center py-4 text-muted-foreground/40 select-none">
                            {[...Array(pythonCode.split('\n').length)].map((_, i) => (
                                <div key={i}>{i + 1}</div>
                            ))}
                        </div>
                        <div className="flex-1 p-4 whitespace-pre overflow-x-auto selection:bg-primary/20">
                            <code>{pythonCode}</code>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
