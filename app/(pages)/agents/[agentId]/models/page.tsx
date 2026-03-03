"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, Brain, Mic, Volume2 } from "lucide-react";
import { getAgentById, updateAgent, Agent, getCurrentProjectId } from "../../../../../lib/api";
import { DelayedLoader } from "../../../../../components/ui/DelayedLoader";
import { Button } from "../../../../../components/ui/Button";

export default function ModelsPage() {
    const params = useParams();
    const agentId = Array.isArray(params.agentId) ? params.agentId[0] : params.agentId;
    const [agent, setAgent] = useState<Agent | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [pipelineMode, setPipelineMode] = useState<"stt-llm-tts" | "realtime">("stt-llm-tts");
    const [voice, setVoice] = useState("Jacqueline English");
    const [llmModel, setLlmModel] = useState("gpt-4o-mini");
    const [sttModel, setSttModel] = useState("AssemblyAI Universal-Streaming");

    useEffect(() => {
        const loadAgent = async () => {
            if (!agentId) return;
            try {
                const data = await getAgentById(agentId);
                setAgent(data);
                // In a real app, these would come from data.config or similar fields
                // For now we map existing fields or use defaults
                setLlmModel(data.model || "gpt-4o-mini");
                setVoice(data.voice || "Jacqueline English");
            } catch (error) {
                console.error("Failed to load agent models:", error);
            } finally {
                setLoading(false);
            }
        };
        loadAgent();
    }, [agentId]);

    const handleSave = async () => {
        const projectId = getCurrentProjectId();
        if (!projectId || !agentId) return;
        
        setSaving(true);
        try {
            await updateAgent(projectId, agentId, {
                model: llmModel,
                voice: voice,
                // We'll store other fields in metadata or dedicated columns if they existed
            });
        } catch (error) {
            console.error("Failed to save models config:", error);
            alert("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><DelayedLoader /></div>;

    return (
        <div className="p-10 max-w-4xl space-y-10 animate-in fade-in duration-500">
            {saving && <DelayedLoader />}

            <div className="flex justify-end sticky top-0 z-10 py-2 bg-surface/80 backdrop-blur-sm -mt-2">
                <Button onClick={handleSave} isLoading={saving} size="sm" className="px-6 font-bold uppercase tracking-wider">
                    Save Changes
                </Button>
            </div>

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
                    <div 
                        onClick={() => setPipelineMode("stt-llm-tts")}
                        className={cn(
                            "border rounded-lg p-4 cursor-pointer relative transition-all",
                            pipelineMode === "stt-llm-tts" ? "border-primary bg-primary/5 shadow-sm" : "border-border/60 bg-surface hover:border-border"
                        )}
                    >
                        <div className="flex justify-between items-start">
                             <div className="space-y-1">
                                <span className={cn("text-[13px] font-bold block", pipelineMode === "stt-llm-tts" ? "text-primary" : "text-foreground")}>STT-LLM-TTS pipeline</span>
                                <span className="text-[12px] text-muted-foreground">Standard modular pipeline for maximum control.</span>
                             </div>
                             <div className={cn(
                                 "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                                 pipelineMode === "stt-llm-tts" ? "border-primary" : "border-border/40"
                             )}>
                                 {pipelineMode === "stt-llm-tts" && <div className="w-2 h-2 rounded-full bg-primary" />}
                             </div>
                        </div>
                    </div>

                    <div 
                        onClick={() => setPipelineMode("realtime")}
                        className={cn(
                            "border rounded-lg p-4 cursor-pointer relative transition-all",
                            pipelineMode === "realtime" ? "border-primary bg-primary/5 shadow-sm" : "border-border/60 bg-surface hover:border-border"
                        )}
                    >
                        <div className="flex justify-between items-start">
                             <div className="space-y-1">
                                <span className={cn("text-[13px] font-bold block", pipelineMode === "realtime" ? "text-primary" : "text-foreground")}>Realtime model</span>
                                <span className="text-[12px] text-muted-foreground">Low-latency multimodal models (e.g. GPT-4o Realtime).</span>
                             </div>
                             <div className={cn(
                                 "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                                 pipelineMode === "realtime" ? "border-primary" : "border-border/40"
                             )}>
                                 {pipelineMode === "realtime" && <div className="w-2 h-2 rounded-full bg-primary" />}
                             </div>
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
                        Converts response into high-quality speech.
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">Model Provider</label>
                        <div className="relative">
                            <select 
                                value={sttModel}
                                onChange={(e) => setSttModel(e.target.value)}
                                className="flex h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none font-medium"
                            >
                                <option value="Cartesia Sonic 3">Cartesia Sonic 3</option>
                                <option value="ElevenLabs">ElevenLabs Turbo v2.5</option>
                                <option value="Azure">Azure Neural TTS</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">Voice Selection</label>
                        <div className="relative">
                            <select 
                                value={voice}
                                onChange={(e) => setVoice(e.target.value)}
                                className="flex h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none font-medium"
                            >
                                <option value="Jacqueline English">Jacqueline (English)</option>
                                <option value="Marcus English">Marcus (English)</option>
                                <option value="Sarah English">Sarah (English)</option>
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
                        The agent's brain for reasoning and tool use.
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">Active Model</label>
                    <div className="relative">
                        <select 
                            value={llmModel}
                            onChange={(e) => setLlmModel(e.target.value)}
                            className="flex h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none font-medium"
                        >
                            <option value="gpt-4o-mini">GPT-4o mini (Fast & Cost-efficient)</option>
                            <option value="gpt-4o">GPT-4o (Most capable)</option>
                            <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}
