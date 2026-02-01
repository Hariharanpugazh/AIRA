"use client";

import React from "react";
import { Button } from "../../../../../components/ui/Button";
import { PlusIcon } from "../../../../../app/components/icons";

export default function AdvancedPage() {
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h2 className="text-lg font-medium text-foreground mb-1">Advanced</h2>
                <p className="text-secondary text-sm">Configure advanced settings for your agent.</p>
            </div>

            <div className="space-y-8">
                
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-medium text-foreground">Custom metadata</h3>
                    </div>
                    <p className="text-xs text-secondary mb-4">Define custom metadata that is passed to your agent.</p>
                    <Button variant="outline" size="sm" leftIcon={<PlusIcon className="w-3.5 h-3.5" />}>
                        Add variable
                    </Button>
                </div>

                
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-medium text-foreground">Secrets</h3>
                    </div>
                    <p className="text-xs text-secondary mb-4">Define secrets to be set as environment variables for your agent, and for use in HTTP tool calls.</p>
                    <Button variant="outline" size="sm" leftIcon={<PlusIcon className="w-3.5 h-3.5" />}>
                        Add secret
                    </Button>
                </div>

                
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-medium text-foreground">Telephony</h3>
                    </div>
                    <p className="text-xs text-secondary mb-4">
                        Connect your agent to phone numbers. To assign already-owned numbers to this agent, see dispatch rules to create or edit an existing rule, setting explicit dispatch for this agent.
                    </p>
                    <Button variant="outline" size="sm" leftIcon={<PlusIcon className="w-3.5 h-3.5" />}>
                        Buy a number
                    </Button>
                </div>
            </div>
        </div>
    );
}
