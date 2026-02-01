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



    const actionButton = (
        <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsModalOpen(true)}
        >
            Buy a number
        </Button>
    );

    return (
        <DashboardLayout>
            <Header
                projectName={projectName}
                pageName="Phone numbers"
                showTimeRange={false}
                actionButton={actionButton}
            />

            <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-display font-semibold text-foreground mb-1">Phone numbers</h1>
                        <p className="text-muted-foreground text-sm">
                            Manage your project's phone numbers. {' '}
                            <a href="#" className="text-primary hover:underline transition-colors">Learn more in the docs</a>
                        </p>
                    </div>
                </div>


                <Card variant="glass" className="min-h-[400px] flex flex-col items-center justify-center border-border relative overflow-hidden group">

                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

                    <div className="text-center p-8 relative z-10">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-surface border border-border flex items-center justify-center shadow-xl">
                            <Phone className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-display font-medium text-foreground mb-2">No phone numbers yet</h3>
                        <p className="text-muted-foreground text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                            Buy a phone number to start receiving calls and routing them to your agents.
                        </p>
                        <Button
                            variant="primary"
                            size="lg"
                            leftIcon={<Plus className="w-4 h-4" />}
                            onClick={() => setIsModalOpen(true)}
                            className="shadow-lg shadow-primary/20"
                        >
                            Buy a number
                        </Button>
                    </div>
                </Card>


                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title="Buy a number"
                    footer={
                        <>
                            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button variant="primary" onClick={() => setIsModalOpen(false)}>Buy number</Button>
                        </>
                    }
                >
                    <div className="space-y-6">
                        <p className="text-sm text-secondary">Search for a number by area code or location.</p>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Globe className="w-3 h-3" /> Country
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
                                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3" /> Area code
                                </label>
                                <Input
                                    placeholder="e.g. 415"
                                    startIcon={<Search className="w-4 h-4" />}
                                />
                            </div>
                        </div>

                        <div className="rounded-xl border border-border bg-background/50 max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-surface-hover cursor-pointer group transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full border border-border flex items-center justify-center group-hover:border-primary transition-colors">
                                            <div className="w-2 h-2 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <span className="text-foreground text-sm font-mono group-hover:text-primary transition-colors">+1 (415) 555-010{i}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors font-medium bg-surface px-2 py-1 rounded border border-border">$1.00/mo</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
                            <Info className="w-5 h-5 mt-0.5 shrink-0" />
                            <p className="leading-relaxed">Phone numbers are billed monthly. Some countries may require address verification documentation before purchase.</p>
                        </div>
                    </div>
                </Modal>

            </div>
        </DashboardLayout>
    );
}
