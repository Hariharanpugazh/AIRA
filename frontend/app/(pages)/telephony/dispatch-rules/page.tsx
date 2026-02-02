"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";
import { Search, MoreVertical, Plus, Copy, Info, Trash2 } from "lucide-react";
import { CreateDispatchRuleModal } from "../../../../components/modals/CreateDispatchRuleModal";
import { getAccessToken, getDispatchRules, createDispatchRule, deleteDispatchRule, getSipTrunks, getAgents, DispatchRule, Agent, SipTrunk } from "../../../../lib/api";

export default function DispatchRulesPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState<string>("");
  const [rules, setRules] = useState<DispatchRule[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [trunks, setTrunks] = useState<SipTrunk[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const sipUri = trunks.length > 0 && trunks[0].sip_uri ? trunks[0].sip_uri : null;

  useEffect(() => {
    const loadData = async () => {
      if (!getAccessToken()) { router.push("/login"); return; }
      try {
        setProjectName(localStorage.getItem("projectName") || "RELATIM");

        const [r, a, t] = await Promise.all([getDispatchRules(), getAgents("default"), getSipTrunks()]);
        setRules(r);
        setAgents(a);
        setTrunks(t);
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  const handleCreate = async (data: any) => {
    try {
      const newRule = await createDispatchRule({
        name: data.name,
        rule_type: data.rule_type,
        trunk_id: data.trunk_id,
        agent_id: data.agent_id
      });
      setRules([newRule, ...rules]);
    } catch (e) {
      throw e;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete rule?")) return;
    try {
      await deleteDispatchRule(id);
      setRules(rules.filter(r => r.id !== id));
    } catch (e) {
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <Header
        projectName={projectName}
        sectionName="Telephony"
        pageName="Dispatch rules"
        showTimeRange={false}
        actionButton={
          <Button 
            size="sm" 
            className="bg-primary hover:bg-primary/90 text-white font-bold text-[11px] uppercase tracking-widest px-6 h-9"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-2 stroke-3" />
            Create new dispatch rule
          </Button>
        }
      />
      <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto animate-fade-in">
        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm relative">
            <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Total Dispatch Rules
              <Info className="w-3.5 h-3.5 opacity-40" />
            </div>
            <div className="text-[32px] font-light text-foreground">{rules.length}</div>
          </Card>

          <Card className="p-6 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm relative">
            <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              SIP URI
              <Info className="w-3.5 h-3.5 opacity-40" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-[14px] font-mono text-foreground truncate bg-muted/30 px-3 py-1.5 rounded-lg border border-border/40">
                {sipUri || "sip:d7erc92zoce.sip.livekit.cloud"}
              </div>
              <button 
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all"
                onClick={() => navigator.clipboard.writeText(sipUri || "sip:d7erc92zoce.sip.livekit.cloud")}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </Card>
        </div>

        {/* Table Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Dispatch rules</h2>
            <div className="flex items-center gap-2 group">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="Search"
                  className="h-9 w-64 pl-9 pr-4 bg-background border border-border/60 rounded-lg text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/50"
                />
              </div>
            </div>
          </div>

          <div className="bg-background border border-border/60 rounded-xl shadow-sm overflow-hidden min-h-[400px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead className="bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-widest border-b border-border/50">
                  <tr>
                    <th className="px-6 py-3 font-bold">Dispatch Rule ID</th>
                    <th className="px-6 py-3 font-bold">Rule Name</th>
                    <th className="px-6 py-3 font-bold">Inbound Routing</th>
                    <th className="px-6 py-3 font-bold">Destination Room</th>
                    <th className="px-6 py-3 font-bold">Agents</th>
                    <th className="px-6 py-3 font-bold text-right">Rule Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rules.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-32 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-sm text-muted-foreground font-medium">No results.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rules.map((rule) => (
                      <tr key={rule.id} className="group hover:bg-muted/30 transition-colors cursor-pointer">
                        <td className="px-6 py-4 font-mono text-[11px] text-muted-foreground opacity-70">
                          {rule.id.substring(0, 12)}...
                        </td>
                        <td className="px-6 py-4 text-foreground font-medium">{rule.name}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded-full bg-primary/5 text-primary text-[10px] font-bold uppercase border border-primary/10">
                            {rule.trunk_name || "Any"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground text-[11px] font-mono italic">
                          Inbound-&lt;caller-number&gt;
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary font-bold">
                              {rule.agent_name?.[0] || "A"}
                            </div>
                            <span className="text-foreground">{rule.agent_name || "Default Agent"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-tight">
                            {rule.rule_type}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <CreateDispatchRuleModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreate}
          agents={agents}
          trunks={trunks}
        />
      </div>
    </DashboardLayout>
  );
}

