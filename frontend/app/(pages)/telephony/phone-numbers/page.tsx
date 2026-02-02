"use client";

import { getAccessToken } from "../../../../lib/api";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { Select } from "../../../../components/ui/Select";
import { Card } from "../../../../components/ui/Card";
import { Input } from "../../../../components/ui/Input";
import { Info, Search, Phone, Plus, MapPin, Globe } from "lucide-react";

export default function PhoneNumbersPage() {
    const router = useRouter();
    const [projectName, setProjectName] = useState<string>("");
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const storedProject = localStorage.getItem("projectName");
        if (!getAccessToken()) {
            router.push("/login");
            return;
        }
        setProjectName(storedProject || "My Project");
    }, [router]);



    const actionButton = null;

    return (
        <DashboardLayout>
            <Header
                projectName={projectName}
                sectionName="Telephony"
                pageName="Phone numbers"
                showTimeRange={false}
                actionButton={
                    <Button 
                        size="sm" 
                        className="bg-primary hover:bg-primary/90 text-white font-bold text-[11px] uppercase tracking-widest px-6 h-9"
                        onClick={() => setIsModalOpen(true)}
                    >
                        <Plus className="w-3.5 h-3.5 mr-2 stroke-3" />
                        Buy a number
                    </Button>
                }
            />

            <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto animate-fade-in h-[calc(100vh-160px)] flex flex-col items-center justify-center">
                <Card className="w-full max-w-[800px] py-16 px-8 border-border/40 shadow-none bg-background flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-2xl bg-muted/20 flex items-center justify-center mb-8 relative">
                        <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl animate-pulse" />
                        <Phone className="w-8 h-8 text-muted-foreground/40 stroke-[1.2]" />
                    </div>
                    
                    <h3 className="text-[17px] font-semibold text-foreground mb-3">Phone numbers</h3>
                    <p className="text-[13px] text-muted-foreground max-w-[420px] leading-relaxed mb-8">
                        Purchase phone numbers directly from LiveKit for your voice agents to answer inbound calls, no external SIP trunk configuration required.
                    </p>
                    
                    <Button 
                        size="sm" 
                        className="bg-primary hover:bg-primary/90 text-white font-bold text-[11px] uppercase tracking-widest px-6 h-9"
                        onClick={() => setIsModalOpen(true)}
                    >
                        <Plus className="w-3.5 h-3.5 mr-1 stroke-3" />
                        Buy a number
                    </Button>
                </Card>

                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title="Provision Phone Number"
                    width="max-w-3xl"
                >
                    <div className="space-y-8 py-2">
                        <p className="text-[13px] text-muted-foreground leading-relaxed">
                            Search for available numbers by country and area code. Numbers are billed monthly.
                        </p>

                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <label className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">
                                    <Globe className="w-3 h-3 opacity-60" /> Country
                                </label>
                                <Select
                                    options={[
                                        { label: "United States (+1)", value: "US" },
                                        { label: "United Kingdom (+44)", value: "UK" },
                                        { label: "Canada (+1)", value: "CA" }
                                    ]}
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">
                                    <MapPin className="w-3 h-3 opacity-60" /> Area code
                                </label>
                                <Input
                                    placeholder="e.g. 415"
                                    startIcon={<Search className="w-4 h-4 opacity-40" />}
                                />
                            </div>
                        </div>

                        <div className="rounded-2xl border border-border/60 bg-muted/20 overflow-hidden">
                            <div className="max-h-[280px] overflow-y-auto">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="flex items-center justify-between px-6 py-4 border-b border-border/40 last:border-0 hover:bg-white/50 cursor-pointer group transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-5 h-5 rounded-full border border-border/60 flex items-center justify-center group-hover:border-primary/60 group-hover:bg-primary/5 transition-all">
                                                <div className="w-2.5 h-2.5 rounded-full bg-primary scale-0 group-hover:scale-100 transition-transform duration-300" />
                                            </div>
                                            <span className="text-foreground text-sm font-mono tracking-tight font-medium group-hover:text-primary transition-colors">+1 (415) 555-010{i}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-bold text-muted-foreground transition-colors bg-white px-2.5 py-1 rounded-lg border border-border/60">$1.00 / mo</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20 text-primary">
                            <Info className="w-5 h-5 mt-0.5 shrink-0 opacity-70" />
                            <p className="text-[12px] leading-relaxed font-medium">
                                Some regional numbers may require identity documentation before purchase. Documentation can be uploaded in the Settings panel.
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-border/60">
                            <Button variant="outline" className="text-xs h-10 border-border/60 hover:bg-muted/50" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button className="bg-primary hover:bg-primary/90 text-white font-bold text-[11px] uppercase tracking-widest px-8 h-10" onClick={() => setIsModalOpen(false)}>Buy Number</Button>
                        </div>
                    </div>
                </Modal>
            </div>
        </DashboardLayout>
    );
}
