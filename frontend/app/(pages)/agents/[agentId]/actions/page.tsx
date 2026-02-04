"use client";

import React, { useState } from "react";
import { Plus, Globe, Monitor, Terminal, FileText, ChevronDown, ChevronRight, Info, Search, Filter, X } from "lucide-react";
import { Button } from "../../../../../components/ui/Button";
import { Modal } from "../../../../../components/ui/Modal";
import { Input } from "../../../../../components/ui/Input";

export default function ActionsPage() {
    const [openAddHttp, setOpenAddHttp] = useState(false);
    const [openAddClient, setOpenAddClient] = useState(false);
    const [openAddMcp, setOpenAddMcp] = useState(false);

    return (
        <div className="p-10 max-w-4xl space-y-8 animate-in fade-in duration-500">
            {/* HTTP Tools */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 group cursor-pointer">
                    <ChevronDown className="w-4 h-4 text-muted-foreground/60" />
                    <label className="text-[13px] font-bold text-foreground">
                        HTTP tools
                    </label>
                </div>
                <div className="pl-6 space-y-4">
                    <div className="text-[13px] text-muted-foreground">
                        Define web requests to enable your agent to interact with web-based APIs and services. <a href="#" className="underline decoration-muted-foreground/30 hover:decoration-primary text-muted-foreground/80">Learn more</a>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setOpenAddHttp(true)}
                        className="h-8 text-[11px] font-bold border-border/60 hover:bg-muted/30 px-3 uppercase tracking-wider"
                    >
                        <Plus className="w-3.5 h-3.5 mr-2" />
                        Add HTTP tool
                    </Button>
                </div>
            </div>

            {/* Client Tools */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 group cursor-pointer">
                    <ChevronDown className="w-4 h-4 text-muted-foreground/60" />
                    <label className="text-[13px] font-bold text-foreground">
                        Client tools
                    </label>
                </div>
                <div className="pl-6 space-y-4">
                    <div className="text-[13px] text-muted-foreground">
                        Connect your agent to client-side RPC methods to retrieve data or perform actions. <a href="#" className="underline decoration-muted-foreground/30 hover:decoration-primary text-muted-foreground/80">Learn more</a>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setOpenAddClient(true)}
                        className="h-8 text-[11px] font-bold border-border/60 hover:bg-muted/30 px-3 uppercase tracking-wider"
                    >
                        <Plus className="w-3.5 h-3.5 mr-2" />
                        Add client tool
                    </Button>
                </div>
            </div>

            {/* MCP Servers */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 group cursor-pointer">
                    <ChevronDown className="w-4 h-4 text-muted-foreground/60" />
                    <label className="text-[13px] font-bold text-foreground">
                        MCP servers
                    </label>
                </div>
                <div className="pl-6 space-y-4">
                    <div className="text-[13px] text-muted-foreground">
                        Configure external MCP servers for your agent to connect and interact with. <a href="#" className="underline decoration-muted-foreground/30 hover:decoration-primary text-muted-foreground/80">Learn more</a>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setOpenAddMcp(true)}
                        className="h-8 text-[11px] font-bold border-border/60 hover:bg-muted/30 px-3 uppercase tracking-wider"
                    >
                        <Plus className="w-3.5 h-3.5 mr-2" />
                        Add MCP server
                    </Button>
                </div>
            </div>

            {/* End of call summary */}
            <div className="space-y-4 text-muted-foreground/40">
                <div className="flex items-center gap-2 group cursor-pointer">
                    <ChevronDown className="w-4 h-4" />
                    <label className="text-[13px] font-bold">
                        End-of-call summary
                    </label>
                </div>
                <div className="pl-6 space-y-4">
                    <div className="text-[13px]">
                        Optionally summarize and report outcomes at the end of each call.
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-4 bg-muted/40 rounded-full relative cursor-pointer">
                             <div className="absolute left-1 top-1 w-2 h-2 bg-white rounded-full" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest">OFF</span>
                    </div>
                </div>
            </div>

            {/* HTTP Tool Modal */}
            <Modal
                isOpen={openAddHttp}
                onClose={() => setOpenAddHttp(false)}
                title="Add HTTP tool"
                width="max-w-xl"
            >
                <div className="space-y-6 pt-2">
                    <div className="space-y-3">
                        <label className="text-[13px] font-bold text-foreground">Tool name</label>
                        <div className="text-[12px] text-muted-foreground">Unique name used by the LLM to identify and use the tool.</div>
                        <Input defaultValue="get_weather" className="border-primary h-10" />
                    </div>

                    <div className="space-y-3">
                        <label className="text-[13px] font-bold text-foreground">Description</label>
                        <div className="text-[12px] text-muted-foreground">The tool's purpose, outcomes, usage instructions, and examples.</div>
                        <textarea className="w-full h-24 rounded-lg border border-border/60 bg-surface p-3 text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-3">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">HTTP method</label>
                            <div className="relative">
                                <select className="flex h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20">
                                    <option>GET</option>
                                    <option>POST</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
                            </div>
                        </div>
                        <div className="col-span-2 space-y-3">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-1">URL <Info className="w-3 h-3" /></label>
                            <Input placeholder="https://api.example.com/some/endpoint" className="h-10" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[13px] font-bold text-foreground">Parameters</label>
                        <div className="text-[12px] text-muted-foreground">Arguments passed by the LLM when the tool is called.</div>
                        <div className="border border-dashed border-border/60 rounded-lg p-6 flex flex-col items-center justify-center text-muted-foreground text-[12px]">
                            No parameters added
                        </div>
                        <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold border-border/60 bg-muted/10">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add parameter
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[13px] font-bold text-foreground flex items-center gap-1">Silent <Info className="w-3 h-3" /></label>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-4 bg-muted/40 rounded-full relative">
                                    <div className="absolute left-1 top-1 w-2 h-2 bg-white rounded-full" />
                                </div>
                                <span className="text-[10px] font-bold text-muted-foreground">NO</span>
                            </div>
                        </div>
                        <div className="text-[12px] text-muted-foreground">Hide tool call result from the agent and do not generate a response.</div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-border/40 mt-6">
                    <Button variant="ghost" size="sm" onClick={() => setOpenAddHttp(false)} className="h-9 px-4 text-[13px] font-bold">Cancel</Button>
                    <Button size="sm" className="bg-primary hover:bg-primary/95 text-white h-9 px-4 text-[13px] font-bold rounded-lg px-6">Add tool</Button>
                </div>
            </Modal>

            {/* Client Tool Modal */}
            <Modal
                isOpen={openAddClient}
                onClose={() => setOpenAddClient(false)}
                title="Add client tool"
                width="max-w-xl"
            >
                <div className="space-y-6 pt-2">
                    <div className="space-y-3">
                        <label className="text-[13px] font-bold text-foreground">Tool name</label>
                        <div className="text-[12px] text-muted-foreground">Unique name used by the LLM to identify and use the tool.</div>
                        <Input defaultValue="get_weather" className="border-primary h-10" />
                    </div>

                    <div className="space-y-3">
                        <label className="text-[13px] font-bold text-foreground">Description</label>
                        <div className="text-[12px] text-muted-foreground">The tool's purpose, outcomes, usage instructions, and examples.</div>
                        <textarea className="w-full h-24 rounded-lg border border-border/60 bg-surface p-3 text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>

                    <div className="space-y-3">
                        <label className="text-[13px] font-bold text-foreground">Parameters</label>
                        <div className="text-[12px] text-muted-foreground">Arguments passed by the LLM when the tool is called.</div>
                        <div className="border border-dashed border-border/60 rounded-lg p-6 flex flex-col items-center justify-center text-muted-foreground text-[12px]">
                            No parameters added
                        </div>
                        <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold border-border/60 bg-muted/10">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add parameter
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[13px] font-bold text-foreground flex items-center gap-1">Preview response <Info className="w-3 h-3" /></label>
                        <div className="text-[12px] text-muted-foreground">A sample response returned by the client.</div>
                        <div className="border border-border/60 rounded-lg bg-muted/5 p-4 font-mono text-[12px]">
                            1
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[13px] font-bold text-foreground flex items-center gap-1">Silent <Info className="w-3 h-3" /></label>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-4 bg-muted/40 rounded-full relative">
                                    <div className="absolute left-1 top-1 w-2 h-2 bg-white rounded-full" />
                                </div>
                                <span className="text-[10px] font-bold text-muted-foreground">NO</span>
                            </div>
                        </div>
                        <div className="text-[12px] text-muted-foreground">Hide tool call result from the agent and do not generate a response.</div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-border/40 mt-6">
                    <Button variant="ghost" size="sm" onClick={() => setOpenAddClient(false)} className="h-9 px-4 text-[13px] font-bold">Cancel</Button>
                    <Button size="sm" className="bg-primary hover:bg-primary/95 text-white h-9 px-4 text-[13px] font-bold rounded-lg px-6">Add tool</Button>
                </div>
            </Modal>

            {/* MCP Modal */}
            <Modal
                isOpen={openAddMcp}
                onClose={() => setOpenAddMcp(false)}
                title="Add MCP server"
                width="max-w-xl"
            >
                <div className="space-y-6 pt-2">
                    <div className="space-y-3">
                        <label className="text-[13px] font-bold text-foreground">Server name</label>
                        <div className="text-[12px] text-muted-foreground">A human-readable name for this MCP server.</div>
                        <Input defaultValue="docs_server" className="border-primary h-10" />
                    </div>

                    <div className="space-y-3">
                        <label className="text-[13px] font-bold text-foreground flex items-center gap-1">URL <Info className="w-3 h-3" /></label>
                        <Input placeholder="https://api.example.com/mcp" className="h-10" />
                    </div>

                    <div className="space-y-3">
                        <label className="text-[13px] font-bold text-foreground">Headers</label>
                        <div className="text-[12px] text-muted-foreground">Optional HTTP headers for authentication or other purposes.</div>
                        <div className="border border-dashed border-border/60 rounded-lg p-6 flex flex-col items-center justify-center text-muted-foreground text-[12px]">
                            No headers added
                        </div>
                        <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold border-border/60 bg-muted/10">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add header
                        </Button>
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-border/40 mt-6">
                    <Button variant="ghost" size="sm" onClick={() => setOpenAddMcp(false)} className="h-9 px-4 text-[13px] font-bold">Cancel</Button>
                    <Button size="sm" className="bg-primary hover:bg-primary/95 text-white h-9 px-4 text-[13px] font-bold rounded-lg px-6">Add server</Button>
                </div>
            </Modal>
        </div>
    );
}

