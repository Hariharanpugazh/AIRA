"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";
import { Save, Cpu, Mic, Volume2, MessageSquare } from "lucide-react";
import { getAccessToken, getMe, getAIConfig, updateAIConfig, User, AIConfig } from "../../../../lib/api";

const STT_PROVIDERS = ["deepgram", "openai", "groq", "local"];
const TTS_PROVIDERS = ["cartesia", "elevenlabs", "openai", "local"];
const LLM_PROVIDERS = ["openai", "anthropic", "groq", "local"];
const MODES = ["api", "local", "hybrid"];
const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

export default function AISettingsPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [config, setConfig] = useState<AIConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        const loadData = async () => {
            const token = getAccessToken();
            if (!token) {
                router.push("/login");
                return;
            }

            try {
                const userData = await getMe();
                setUser(userData);

                const projectId = localStorage.getItem("projectId");
                if (projectId) {
                    const configData = await getAIConfig(projectId);
                    setConfig(configData);
                }
            } catch (error) {
                console.error("Failed to load AI config:", error);
                router.push("/login");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [router]);

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        setMessage(null);

        try {
            const projectId = localStorage.getItem("projectId");
            if (!projectId) throw new Error("No project selected");

            await updateAIConfig(projectId, {
                stt_mode: config.stt_mode,
                stt_provider: config.stt_provider,
                stt_model: config.stt_model,
                tts_mode: config.tts_mode,
                tts_provider: config.tts_provider,
                tts_model: config.tts_model,
                tts_voice: config.tts_voice,
                llm_mode: config.llm_mode,
                llm_provider: config.llm_provider,
                llm_model: config.llm_model,
            });

            setMessage({ type: "success", text: "AI configuration saved successfully!" });
        } catch (error) {
            setMessage({ type: "error", text: "Failed to save configuration" });
        } finally {
            setSaving(false);
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
            </div>
        );
    }

    const projectName = localStorage.getItem("projectName") || "RELATIM";

    return (
        <DashboardLayout user={user}>
            <Header
                projectName={projectName}
                pageName="AI Configuration"
                showTimeRange={false}
                actionButton={
                    <Button size="sm" leftIcon={<Save className="w-4 h-4" />} onClick={handleSave} isLoading={saving}>
                        Save Changes
                    </Button>
                }
            />

            <div className="p-4 md:p-8 animate-fade-in max-w-4xl">
                {message && (
                    <div className={`mb-6 p-4 rounded-lg ${message.type === "success" ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
                        {message.text}
                    </div>
                )}

                <div className="space-y-6">
                    {/* STT Configuration */}
                    <Card variant="glass" className="p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <Mic className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-foreground font-semibold">Speech-to-Text (STT)</h3>
                                <p className="text-muted-foreground text-sm">Configure voice recognition</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Mode</label>
                                <select
                                    value={config?.stt_mode || "hybrid"}
                                    onChange={(e) => setConfig(c => c ? { ...c, stt_mode: e.target.value } : c)}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground"
                                >
                                    {MODES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Provider</label>
                                <select
                                    value={config?.stt_provider || "deepgram"}
                                    onChange={(e) => setConfig(c => c ? { ...c, stt_provider: e.target.value } : c)}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground"
                                >
                                    {STT_PROVIDERS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Model</label>
                                <input
                                    type="text"
                                    value={config?.stt_model || "nova-2"}
                                    onChange={(e) => setConfig(c => c ? { ...c, stt_model: e.target.value } : c)}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground"
                                />
                            </div>
                        </div>
                    </Card>

                    {/* TTS Configuration */}
                    <Card variant="glass" className="p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-purple-500/10">
                                <Volume2 className="w-5 h-5 text-purple-500" />
                            </div>
                            <div>
                                <h3 className="text-foreground font-semibold">Text-to-Speech (TTS)</h3>
                                <p className="text-muted-foreground text-sm">Configure voice synthesis</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Mode</label>
                                <select
                                    value={config?.tts_mode || "hybrid"}
                                    onChange={(e) => setConfig(c => c ? { ...c, tts_mode: e.target.value } : c)}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground"
                                >
                                    {MODES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Provider</label>
                                <select
                                    value={config?.tts_provider || "cartesia"}
                                    onChange={(e) => setConfig(c => c ? { ...c, tts_provider: e.target.value } : c)}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground"
                                >
                                    {TTS_PROVIDERS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Model</label>
                                <input
                                    type="text"
                                    value={config?.tts_model || "sonic-2024-10-19"}
                                    onChange={(e) => setConfig(c => c ? { ...c, tts_model: e.target.value } : c)}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Voice</label>
                                <select
                                    value={config?.tts_voice || "alloy"}
                                    onChange={(e) => setConfig(c => c ? { ...c, tts_voice: e.target.value } : c)}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground"
                                >
                                    {VOICES.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                                </select>
                            </div>
                        </div>
                    </Card>

                    {/* LLM Configuration */}
                    <Card variant="glass" className="p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-green-500/10">
                                <MessageSquare className="w-5 h-5 text-green-500" />
                            </div>
                            <div>
                                <h3 className="text-foreground font-semibold">Language Model (LLM)</h3>
                                <p className="text-muted-foreground text-sm">Configure AI reasoning</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Mode</label>
                                <select
                                    value={config?.llm_mode || "hybrid"}
                                    onChange={(e) => setConfig(c => c ? { ...c, llm_mode: e.target.value } : c)}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground"
                                >
                                    {MODES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Provider</label>
                                <select
                                    value={config?.llm_provider || "openai"}
                                    onChange={(e) => setConfig(c => c ? { ...c, llm_provider: e.target.value } : c)}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground"
                                >
                                    {LLM_PROVIDERS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Model</label>
                                <input
                                    type="text"
                                    value={config?.llm_model || "gpt-4o-mini"}
                                    onChange={(e) => setConfig(c => c ? { ...c, llm_model: e.target.value } : c)}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground"
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Hybrid Mode Info */}
                    <Card variant="glass" className="p-6 bg-primary/5 border-primary/20">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <Cpu className="w-5 h-5 text-primary" />
                            </div>
                            <h3 className="text-foreground font-semibold">Hybrid Mode</h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            Hybrid mode automatically falls back to local models when API services are unavailable or rate-limited.
                            This ensures 100% uptime for government-grade deployments. Local services use:
                            <strong> Whisper</strong> for STT, <strong>Kokoro</strong> for TTS, and <strong>Ollama</strong> for LLM.
                        </p>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
