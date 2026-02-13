"use client";

import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Info, Plus, Search, HelpCircle } from "lucide-react";
import { Agent, SipTrunk } from "../../lib/api";

interface CreateDispatchRuleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        name: string;
        rule_type: "individual" | "direct" | "callee";
        room_prefix?: string;
        trunk_id?: string;
        agent_id?: string;
        randomize?: boolean;
    }) => Promise<void>;
    agents: Agent[];
    trunks: SipTrunk[];
}

export function CreateDispatchRuleModal({ isOpen, onClose, onSubmit, agents, trunks }: CreateDispatchRuleModalProps) {
    const [activeTab, setActiveTab] = useState<"details" | "json">("details");
    const [formData, setFormData] = useState({
        name: "",
        type: "Individual",
        roomPrefix: "prm-",
        agentId: "",
        inboundTrunkId: "",
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        const normalizedRuleType = formData.type.toLowerCase() as "individual" | "direct" | "callee";
        const shouldSendRoomPrefix = normalizedRuleType === "individual" || normalizedRuleType === "callee";
        setLoading(true);
        try {
            await onSubmit({
                name: formData.name,
                rule_type: normalizedRuleType,
                room_prefix: shouldSendRoomPrefix ? formData.roomPrefix : undefined,
                trunk_id: formData.inboundTrunkId || undefined,
                agent_id: formData.agentId || undefined,
                randomize: normalizedRuleType === "callee" ? true : undefined,
            });
            onClose();
        } catch (err) {
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create a new dispatch rule" width="max-w-3xl">
            <div className="flex flex-col h-full">
                
                <div className="flex items-center gap-6 border-b border-white/5 px-1 mb-6">
                    <button
                        onClick={() => setActiveTab("details")}
                        className={`text-xs font-semibold uppercase tracking-wider py-3 border-b-2 transition-colors ${activeTab === "details" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Dispatch Rule Details
                    </button>
                    <button
                        onClick={() => setActiveTab("json")}
                        className={`text-xs font-semibold uppercase tracking-wider py-3 border-b-2 transition-colors ${activeTab === "json" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        JSON Editor
                    </button>
                </div>

                {activeTab === "details" ? (
                    <div className="space-y-6">
                        
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rule name</label>
                            <input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50"
                                placeholder="Rule name"
                            />
                        </div>

                        
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                Rule type <Info className="w-3 h-3 cursor-help" />
                            </label>
                            <div className="relative">
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary/50 appearance-none cursor-pointer"
                                >
                                    <option value="Individual">Individual</option>
                                    <option value="Direct">Direct</option>
                                    <option value="Callee">Callee</option>
                                </select>
                                <div className="absolute right-3 top-2.5 pointer-events-none text-muted-foreground">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground bg-white/5 p-3 rounded-lg border border-white/5">
                                Creates a new room for each caller.
                            </div>
                        </div>

                        
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Room prefix</label>
                            <input
                                value={formData.roomPrefix}
                                onChange={(e) => setFormData({ ...formData, roomPrefix: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary/50"
                                placeholder="Room prefix"
                            />
                        </div>

                        
                        <div className="space-y-3 pt-2">
                            <label className="text-sm font-semibold text-foreground">Agent dispatch</label>
                            <p className="text-xs text-muted-foreground">Configure an agent to dispatch to LiveKit rooms and enable inbound calling for your agent.</p>

                            {!formData.agentId ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    leftIcon={<Plus className="w-4 h-4" />}
                                    onClick={() => {
                                        if (agents.length > 0) setFormData({ ...formData, agentId: agents[0].id });
                                    }}
                                >
                                    Add agent
                                </Button>
                            ) : (
                                <div className="relative">
                                    <select
                                        value={formData.agentId}
                                        onChange={(e) => setFormData({ ...formData, agentId: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary/50 appearance-none cursor-pointer"
                                    >
                                        <option value="">Select Agent</option>
                                        {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                    <div className="absolute right-3 top-2.5 pointer-events-none text-muted-foreground">
                                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    </div>
                                </div>
                            )}
                        </div>

                        
                        <div className="space-y-3 pt-2">
                            <label className="text-sm font-semibold text-foreground">Inbound routing</label>
                            <p className="text-xs text-muted-foreground">Configure origination by setting up how inbound calls will be dispatched to LiveKit rooms.</p>

                            <div className="bg-black/40 border border-white/10 rounded-lg overflow-hidden">
                                <div className="flex border-b border-white/10">
                                    <button className="flex-1 py-2 text-xs font-medium text-muted-foreground hover:bg-white/5 border-r border-white/10">Phone numbers</button>
                                    <button className="flex-1 py-2 text-xs font-medium text-primary bg-primary/10 border-b-2 border-primary">Trunks</button>
                                </div>
                                <div className="p-3">
                                    <div className="relative mb-2">
                                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                                        <input
                                            className="w-full bg-black/20 border border-white/10 rounded px-9 py-1.5 text-sm focus:outline-none focus:border-white/20"
                                            placeholder="Search by trunk name"
                                        />
                                    </div>
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                        {trunks.length === 0 && <div className="text-xs text-muted-foreground text-center py-2">No trunks found</div>}
                                        {trunks.map(t => (
                                            <label key={t.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded cursor-pointer group">
                                                <input
                                                    type="radio"
                                                    name="trunk"
                                                    checked={formData.inboundTrunkId === t.id}
                                                    onChange={() => setFormData({ ...formData, inboundTrunkId: t.id })}
                                                    className="w-4 h-4 rounded border-white/20 bg-transparent text-primary focus:ring-primary focus:ring-offset-0"
                                                />
                                                <div className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{t.name || t.id}</div>
                                                <div className="ml-auto text-xs text-muted-foreground font-mono">{t.sip_uri || "Unknown URI"}</div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded border border-white/5">Learn more in the docs</span>
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="h-full bg-black/40 border border-white/10 rounded-lg p-4">
                        <pre className="text-xs font-mono text-muted-foreground">
                            {JSON.stringify({
                                name: formData.name,
                                rule_type: formData.type.toLowerCase(),
                                room_prefix: ["individual", "callee"].includes(formData.type.toLowerCase()) ? formData.roomPrefix : null,
                                randomize: formData.type.toLowerCase() === "callee" ? true : null,
                                trunk_id: formData.inboundTrunkId || null,
                                agent_id: formData.agentId || null
                            }, null, 2)}
                        </pre>
                    </div>
                )}
            </div>

            <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-white/5">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSubmit} isLoading={loading}>Create</Button>
            </div>
        </Modal>
    );
}
