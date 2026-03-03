"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "../../../../../components/ui/Button";
import { Plus } from "lucide-react";
import { getAgentById, updateAgent, Agent, getCurrentProjectId } from "../../../../../lib/api";
import { DelayedLoader } from "../../../../../components/ui/DelayedLoader";

export default function InstructionsPage() {
    const params = useParams();
    const agentId = Array.isArray(params.agentId) ? params.agentId[0] : params.agentId;
    const [agent, setAgent] = useState<Agent | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [name, setName] = useState("");
    const [instructions, setInstructions] = useState("");
    const [welcomeMessage, setWelcomeMessage] = useState("");
    const [welcomeEnabled, setWelcomeEnabled] = useState(true);

    useEffect(() => {
        const loadAgent = async () => {
            if (!agentId) return;
            try {
                const data = await getAgentById(agentId);
                setAgent(data);
                setName(data.name || "");
                setInstructions(data.instructions || "");
                setWelcomeMessage(data.welcome_message || "");
                setWelcomeEnabled(!!data.welcome_message);
            } catch (error) {
                console.error("Failed to load agent:", error);
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
                name,
                instructions,
                welcome_message: welcomeEnabled ? welcomeMessage : undefined,
            });
            // Update local state if needed or show success toast
        } catch (error) {
            console.error("Failed to save agent:", error);
            alert("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><DelayedLoader /></div>;

    return (
        <div className="p-10 max-w-4xl space-y-10 animate-in fade-in duration-500">
            {saving && <DelayedLoader />}
            
            {/* Header with Save Button for immediate feedback */}
            <div className="flex justify-end sticky top-0 z-10 py-2 bg-surface/80 backdrop-blur-sm -mt-2">
                <Button onClick={handleSave} isLoading={saving} size="sm" className="px-6 font-bold uppercase tracking-wider">
                    Save Changes
                </Button>
            </div>

            {/* Name Section */}
            <div className="space-y-3">
                <label className="text-[13px] font-bold text-foreground">
                    Name
                </label>
                <div className="text-[13px] text-muted-foreground">
                    Reference name for dispatches.
                </div>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-surface border border-border/60 rounded-lg px-4 py-2.5 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all font-medium"
                />
            </div>

            {/* Instructions Section */}
            <div className="space-y-3">
                <label className="text-[13px] font-bold text-foreground">
                    Instructions
                </label>
                <div className="text-[13px] text-muted-foreground">
                    Define your agent's personality, tone, and behavior guidelines.
                </div>
                
                <div className="border border-border/60 rounded-lg overflow-hidden flex flex-col bg-surface">
                    <div className="px-4 py-2 border-b border-border/40 bg-muted/5 flex items-center justify-end">
                        <Button variant="ghost" size="sm" className="h-7 text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-transparent">
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Insert variable
                        </Button>
                    </div>
                    <textarea
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        className="w-full h-[450px] bg-transparent p-4 text-[13px] font-mono text-foreground leading-relaxed resize-none focus:outline-none scrollbar-hide"
                        spellCheck={false}
                        placeholder="Enter system instructions..."
                    />
                </div>
            </div>

            {/* Welcome Message Section */}
            <div className="space-y-4 pb-10">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <label className="text-[13px] font-bold text-foreground">
                            Welcome message
                        </label>
                        <div className="text-[13px] text-muted-foreground">
                            The first message your agent says when a call begins.
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                         <div className={`flex items-center gap-1.5 px-2 py-1 rounded bg-muted/10 border ${welcomeEnabled ? 'border-primary/20 bg-primary/5' : 'border-border/60'}`}>
                             <input 
                                type="checkbox" 
                                checked={welcomeEnabled}
                                onChange={(e) => setWelcomeEnabled(e.target.checked)}
                                className="w-3.5 h-3.5 accent-primary" 
                             />
                             <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">{welcomeEnabled ? 'ON' : 'OFF'}</span>
                         </div>
                    </div>
                </div>

                {welcomeEnabled && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                            Allow users to interrupt the greeting.
                        </div>
                        <div className="border border-border/60 rounded-lg overflow-hidden bg-surface">
                            <textarea
                                value={welcomeMessage}
                                onChange={(e) => setWelcomeMessage(e.target.value)}
                                className="w-full h-32 bg-transparent p-4 text-[13px] text-foreground leading-relaxed resize-none focus:outline-none"
                                placeholder="Greet the user and offer your assistance."
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
