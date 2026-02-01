"use client";

import React from "react";
import { ChevronDownIcon } from "../../../../../app/components/icons";

export default function ModelsPage() {
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h2 className="text-lg font-medium text-foreground mb-1">Models & Voice</h2>
                <p className="text-secondary text-sm">Configure the AI models and voice settings for your agent.</p>
            </div>


            <div className="mb-8">
                <h3 className="text-sm font-medium text-foreground mb-4">Pipeline mode</h3>
                <p className="text-xs text-secondary mb-4">Choose how your agent processes conversations.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-surface border border-primary relative ring-1 ring-primary/50 cursor-pointer">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium text-primary">STT LLM TTS pipeline</span>
                            <div className="w-4 h-4 rounded-full border border-primary bg-primary flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                            </div>
                        </div>
                        <p className="text-xs text-secondary">Configure your STT, LLM, and TTS options.</p>
                    </div>

                    <div className="p-4 rounded-lg bg-surface border border-border opacity-60 cursor-not-allowed hover:bg-surface-hover transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium text-foreground">Realtime model</span>
                            <div className="w-4 h-4 rounded-full border border-border"></div>
                        </div>
                        <p className="text-xs text-secondary">Use a real-time model for your voice Agent.</p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">

                <div className="p-5 bg-surface border border-border rounded-lg">
                    <h3 className="text-sm font-medium text-foreground mb-1">Text-to-speech (TTS)</h3>
                    <p className="text-xs text-secondary mb-4">Converts your agent's text response into speech using the selected voice.</p>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-secondary mb-1.5">Model</label>
                            <div className="flex items-center justify-between bg-background/50 border border-border rounded-md px-3 py-2 cursor-pointer hover:border-border/80">
                                <span className="text-sm text-foreground">Cartesia Sonic 3</span>
                                <ChevronDownIcon className="w-4 h-4 text-secondary" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-secondary mb-1.5">Voice</label>
                            <div className="flex items-center justify-between bg-background/50 border border-border rounded-md px-3 py-2 cursor-pointer hover:border-border/80">
                                <span className="text-sm text-foreground">Jacqueline - English</span>
                                <ChevronDownIcon className="w-4 h-4 text-secondary" />
                            </div>
                        </div>
                    </div>
                </div>


                <div className="p-5 bg-surface border border-border rounded-lg">
                    <h3 className="text-sm font-medium text-foreground mb-1">Large language model (LLM)</h3>
                    <p className="text-xs text-secondary mb-4">Your agent's brain, responsible for generating responses and using tools.</p>

                    <div>
                        <div className="flex items-center justify-between bg-background/50 border border-border rounded-md px-3 py-2 cursor-pointer hover:border-border/80">
                            <span className="text-sm text-foreground">GPT-4.1 mini</span>
                            <ChevronDownIcon className="w-4 h-4 text-secondary" />
                        </div>
                    </div>
                </div>


                <div className="p-5 bg-surface border border-border rounded-lg">
                    <h3 className="text-sm font-medium text-foreground mb-1">Speech-to-text (STT)</h3>
                    <p className="text-xs text-secondary mb-4">Transcribes the user's speech into text for input to the LLM.</p>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-secondary mb-1.5">Model</label>
                            <div className="flex items-center justify-between bg-background/50 border border-border rounded-md px-3 py-2 cursor-pointer hover:border-border/80">
                                <span className="text-sm text-foreground">AssemblyAI Universal-Streaming</span>
                                <ChevronDownIcon className="w-4 h-4 text-secondary" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-secondary mb-1.5">Language</label>
                            <div className="flex items-center justify-between bg-background/50 border border-border rounded-md px-3 py-2 cursor-pointer hover:border-border/80">
                                <span className="text-sm text-foreground">English</span>
                                <ChevronDownIcon className="w-4 h-4 text-secondary" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
