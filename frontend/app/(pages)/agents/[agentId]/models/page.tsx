"use client";

import React from "react";
import { Card } from "../../../../../components/ui/Card";
import { ChevronDown, Brain, Mic, Volume2, Radio, Check } from "lucide-react";
import { cn } from "../../../../../lib/utils";

export default function ModelsPage() {
    return (
        <div className="p-10 max-w-4xl space-y-10 animate-in fade-in duration-500">
            {/* Pipeline Mode Section */}
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[13px] font-bold text-foreground">
                        Pipeline mode
                    </label>
                    <div className="text-[13px] text-muted-foreground">
                        Choose how your agent processes conversations
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="border border-primary bg-primary/5 rounded-lg p-4 cursor-pointer relative">
                        <div className="flex justify-between items-start">
                             <div className="space-y-1">
                                <span className="text-[13px] font-bold text-primary block">STT-LLM-TTS pipeline</span>
                                <a href="#" className="text-[12px] text-primary/80 hover:underline">Configure your STT, LLM, and TTS options.</a>
                             </div>
                             <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center">
                                 <div className="w-2 h-2 rounded-full bg-primary" />
                             </div>
                        </div>
                    </div>

                    <div className="border border-border/60 bg-white rounded-lg p-4 cursor-pointer relative hover:border-border transition-colors">
                        <div className="flex justify-between items-start">
                             <div className="space-y-1">
                                <span className="text-[13px] font-bold text-foreground block">Realtime model</span>
                                <span className="text-[12px] text-muted-foreground">Use a real-time model for your voice Agent.</span>
                             </div>
                             <div className="w-4 h-4 rounded-full border-2 border-border/40" />
                        </div>
                    </div>
                </div>
            </div>

            <hr className="border-border/40" />

            {/* TTS Section */}
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[13px] font-bold text-foreground block">
                        Text-to-speech (TTS)
                    </label>
                    <div className="text-[13px] text-muted-foreground">
                        Converts your agent's text response into speech using the selected voice. <a href="#" className="underline decoration-muted-foreground/30 hover:decoration-primary text-muted-foreground/80">Learn more</a>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">Model</label>
                        <div className="relative">
                            <select className="flex h-10 w-full rounded-lg border border-border/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                                <option>Cartesia Sonic 3</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">Voice</label>
                        <div className="relative">
                            <select className="flex h-10 w-full rounded-lg border border-border/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                                <option>Jacqueline English</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            <hr className="border-border/40" />

            {/* LLM Section */}
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[13px] font-bold text-foreground block">
                        Large language model (LLM)
                    </label>
                    <div className="text-[13px] text-muted-foreground">
                        Your agent's brain, responsible for generating responses and using tools. <a href="#" className="underline decoration-muted-foreground/30 hover:decoration-primary text-muted-foreground/80">Learn more</a>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">Model</label>
                    <div className="relative">
                        <select className="flex h-10 w-full rounded-lg border border-border/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                            <option>GPT-4o mini</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
                    </div>
                </div>
            </div>

            <hr className="border-border/40" />

            {/* STT Section */}
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[13px] font-bold text-foreground block">
                        Speech-to-text (STT)
                    </label>
                    <div className="text-[13px] text-muted-foreground">
                        Transcribes the user's speech into text for input to the LLM. <a href="#" className="underline decoration-muted-foreground/30 hover:decoration-primary text-muted-foreground/80">Learn more</a>
                    </div>
                </div>

                <div className="grid grid-cols-5 gap-6">
                    <div className="col-span-3 space-y-2">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">Model</label>
                        <div className="relative">
                            <select className="flex h-10 w-full rounded-lg border border-border/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                                <option>AssemblyAI Universal-Streaming</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
                        </div>
                    </div>
                    <div className="col-span-2 space-y-2">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">Language</label>
                        <div className="relative">
                            <select className="flex h-10 w-full rounded-lg border border-border/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                                <option>English</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            <hr className="border-border/40" />

            {/* Background Audio Section */}
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[13px] font-bold text-foreground block">
                        Background audio
                    </label>
                    <div className="text-[13px] text-muted-foreground">
                        Select background audio to play during conversations. <a href="#" className="underline decoration-muted-foreground/30 hover:decoration-primary text-muted-foreground/80">Learn more</a>
                    </div>
                </div>

                <div className="relative">
                    <select className="flex h-10 w-full rounded-lg border border-border/60 bg-[#F2F2F2] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                        <option>None</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
                </div>
            </div>
        </div>
    );
}
