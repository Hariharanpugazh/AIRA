"use client";

import { Plus, Database, Lock, Phone, ChevronDown, Trash2, Info } from "lucide-react";
import { Button } from "../../../../../components/ui/Button";
import { Input } from "../../../../../components/ui/Input";

export default function AdvancedPage() {
    return (
        <div className="p-10 max-w-4xl space-y-10 animate-in fade-in duration-500">
            {/* Custom Metadata */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 group cursor-pointer">
                    <ChevronDown className="w-4 h-4 text-muted-foreground/60" />
                    <label className="text-[13px] font-bold text-foreground">
                        Custom metadata
                    </label>
                </div>
                <div className="pl-6 space-y-4">
                    <div className="text-[13px] text-muted-foreground">
                        Define custom metadata that is passed to your agent. <a href="#" className="underline decoration-muted-foreground/30 hover:decoration-primary text-muted-foreground/80">Learn more</a>
                    </div>
                    
                    <div className="grid grid-cols-12 gap-4 items-end bg-surface border border-border/60 rounded-xl p-4 shadow-sm">
                        <div className="col-span-2 space-y-2">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">Type</label>
                            <div className="relative">
                                <select className="flex h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[13px] appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20">
                                    <option>String</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
                            </div>
                        </div>
                        <div className="col-span-4 space-y-2">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">Name</label>
                            <Input placeholder="variable_name" className="h-10 text-[13px]" />
                        </div>
                        <div className="col-span-5 space-y-2">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-1">
                                Preview value <Info className="w-3 h-3 text-muted-foreground/40" />
                            </label>
                            <Input placeholder="preview value" className="h-10 text-[13px]" />
                        </div>
                        <div className="col-span-1 pb-1">
                            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 hover:bg-error/10 hover:text-error text-muted-foreground/40">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-[11px] font-bold border-border/60 hover:bg-muted/30 px-3 uppercase tracking-wider"
                    >
                        <Plus className="w-3.5 h-3.5 mr-2" />
                        Add variable
                    </Button>
                </div>
            </div>

            {/* Secrets */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 group cursor-pointer">
                    <ChevronDown className="w-4 h-4 text-muted-foreground/60" />
                    <label className="text-[13px] font-bold text-foreground">
                        Secrets
                    </label>
                </div>
                <div className="pl-6 space-y-4">
                    <div className="text-[13px] text-muted-foreground">
                        Define secrets to be set as environment variables for your agent, and for use in HTTP tool calls. <a href="#" className="underline decoration-muted-foreground/30 hover:decoration-primary text-muted-foreground/80">Learn more</a>
                    </div>

                    <div className="grid grid-cols-12 gap-4 items-end bg-surface border border-border/60 rounded-xl p-4 shadow-sm">
                        <div className="col-span-5 space-y-2">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">Key</label>
                            <Input placeholder="SECRET_KEY_NAME" className="h-10 text-[13px]" />
                        </div>
                        <div className="col-span-6 space-y-2">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">Value</label>
                            <Input type="password" placeholder="secret value" className="h-10 text-[13px]" />
                        </div>
                        <div className="col-span-1 pb-1">
                            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 hover:bg-error/10 hover:text-error text-muted-foreground/40">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-[11px] font-bold border-border/60 hover:bg-muted/30 px-3 uppercase tracking-wider"
                    >
                        <Plus className="w-3.5 h-3.5 mr-2" />
                        Add secret
                    </Button>
                </div>
            </div>

            {/* Telephony */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 group cursor-pointer">
                    <ChevronDown className="w-4 h-4 text-muted-foreground/60" />
                    <label className="text-[13px] font-bold text-foreground">
                        Telephony
                    </label>
                </div>
                <div className="pl-6 space-y-4">
                    <div className="text-[13px] text-muted-foreground">
                        Connect your agent to phone numbers. To assign already-owned numbers to this agent, see <a href="#" className="text-primary hover:underline">dispatch rules</a> to create or edit an existing rule, setting explicit dispatch for this agent. <a href="#" className="underline decoration-muted-foreground/30 hover:decoration-primary text-muted-foreground/80">Learn more</a>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-[11px] font-bold border-border/60 hover:bg-muted/30 px-3 uppercase tracking-wider"
                    >
                        <Plus className="w-3.5 h-3.5 mr-2" />
                        Buy a number
                    </Button>
                </div>
            </div>
        </div>
    );
}

