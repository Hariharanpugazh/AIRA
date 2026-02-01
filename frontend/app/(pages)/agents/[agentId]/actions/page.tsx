"use client";

import React from "react";
import { Button } from "../../../../../components/ui/Button";
import { PlusIcon } from "../../../../../app/components/icons";

export default function ActionsPage() {
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h2 className="text-lg font-medium text-foreground mb-1">Actions</h2>
                <p className="text-secondary text-sm">Define tools and capabilities your agent can use.</p>
            </div>

            <div className="space-y-6">
                
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-foreground">HTTP tools</h3>
                    </div>
                    <p className="text-xs text-secondary mb-4">Define web requests to enable your agent to interact with web-based APIs and services.</p>
                    <Button variant="outline" size="sm" leftIcon={<PlusIcon className="w-3.5 h-3.5" />}>
                        Add HTTP tool
                    </Button>
                </div>

                <div className="w-full h-px bg-white/5 my-6"></div>

                
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-foreground">Client tools</h3>
                    </div>
                    <p className="text-xs text-secondary mb-4">Connect your agent to client-side RPC methods to retrieve data or perform actions.</p>
                    <Button variant="outline" size="sm" leftIcon={<PlusIcon className="w-3.5 h-3.5" />}>
                        Add client tool
                    </Button>
                </div>

                <div className="w-full h-px bg-white/5 my-6"></div>

                
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-foreground">MCP servers</h3>
                    </div>
                    <p className="text-xs text-secondary mb-4">Configure external MCP servers for your agent to connect and interact with.</p>
                    <Button variant="outline" size="sm" leftIcon={<PlusIcon className="w-3.5 h-3.5" />}>
                        Add MCP server
                    </Button>
                </div>

                <div className="w-full h-px bg-white/5 my-6"></div>

                
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-foreground">End-of-call summary</h3>
                    </div>
                    <p className="text-xs text-secondary mb-4">Optionally summarize and report outcomes at the end of each call.</p>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-secondary">OFF</span>
                        <div className="w-10 h-5 bg-white/10 rounded-full relative cursor-pointer">
                            <div className="absolute left-1 top-1 w-3 h-3 bg-secondary rounded-full shadow-sm"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
