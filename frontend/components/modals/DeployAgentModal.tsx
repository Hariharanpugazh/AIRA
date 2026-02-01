"use client";

import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Copy, Check, ChevronDown, ChevronRight, Info } from "lucide-react";

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
            title: "1. Install the CLI",
            command: "curl -sSl https://get.livekit.io/cli | bash",
            desc: "View full instructions in our documentation."
        },
        {
            title: "2. Authenticate",
            command: `lk config --url ${projectUrl} --api-key <YOUR_API_KEY> --api-secret <YOUR_API_SECRET>`,
            desc: "You can generate keys in Project Settings."
        },
        {
            title: "3. Use a starter template (optional)",
            command: "lk app create \\\n  --template agent-starter-python <my-app>; cd <my-app>",
            desc: null
        },
        {
            title: "4. Create a new deployable agent",
            command: "lk agent create",
            desc: null
        }
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Deploy an agent to Relatim Cloud" width="max-w-2xl">
            <div className="space-y-6">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3 text-sm text-blue-200">
                    <Info className="w-5 h-5 flex-shrink-0 text-blue-400" />
                    <div>
                        You must use the LiveKit CLI to deploy an agent to Relatim Cloud.
                        <br />
                        <a href="#" className="underline hover:text-white">Learn more in the docs.</a>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                            <ChevronDown className="w-4 h-4" /> Setup
                        </div>
                        <div className="space-y-6 pl-2">
                            {steps.map((step, idx) => (
                                <div key={idx} className="space-y-2">
                                    <div className="text-sm font-medium text-foreground">{step.title}</div>
                                    <div className="relative group">
                                        <pre className="bg-black/50 border border-white/10 rounded-lg p-3 text-xs font-mono text-cyan-400 overflow-x-auto">
                                            {step.command}
                                        </pre>
                                        <button
                                            onClick={() => copyToClipboard(step.command, idx)}
                                            className="absolute right-2 top-2 p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            {copiedStep === idx ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                        </button>
                                    </div>
                                    {step.desc && <div className="text-xs text-muted-foreground">{step.desc}</div>}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 cursor-pointer hover:text-foreground">
                            <ChevronRight className="w-4 h-4" /> Configuration, monitoring, and logs
                        </div>
                        <div className="mt-4 text-xs text-muted-foreground">
                            For additional instructions, see the <a href="#" className="underline hover:text-white">documentation</a>.
                        </div>
                    </div>
                </div>
            </div>
            <div className="mt-8 flex justify-end">
                <Button onClick={onClose}>Done</Button>
            </div>
        </Modal>
    );
}
