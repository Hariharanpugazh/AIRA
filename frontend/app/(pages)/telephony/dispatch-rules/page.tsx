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
        pageName="Dispatch rules"
        showTimeRange={false}
        actionButton={
          <Button size="sm" onClick={() => setIsModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
            Create new dispatch rule
          </Button>
        }
      />
      <div className="p-4 md:p-8 animate-fade-in space-y-6">


        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card variant="glass" className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Total Dispatch Rules</h3>
              <Info className="w-3 h-3 text-muted-foreground" />
            </div>
            <div className="text-3xl font-bold font-display">{rules.length}</div>
          </Card>
          <Card variant="glass" className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">SIP URI</h3>
              <Info className="w-3 h-3 text-muted-foreground" />
            </div>
            {sipUri ? (
              <div className="flex items-center gap-3">
                <div className="font-mono text-lg text-foreground truncate">{sipUri}</div>
                <button className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => navigator.clipboard.writeText(sipUri)}>
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic">
                No SIP trunk configured. Create a trunk to get your SIP URI.
              </div>
            )}
          </Card>
        </div>


        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Dispatch rules</h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                placeholder="Search"
                className="pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50 w-64"
              />
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border bg-background/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-2">Dispatch Rule ID</div>
              <div className="col-span-2">Rule Name</div>
              <div className="col-span-2">Inbound Routing</div>
              <div className="col-span-2">Destination Room</div>
              <div className="col-span-2">Agents</div>
              <div className="col-span-2 flex justify-between">
                <span>Rule Type</span>
                <span className="sr-only">Actions</span>
              </div>
            </div>

            {rules.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                No dispatch rules found.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {rules.map(rule => (
                  <div key={rule.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-surface-hover transition-colors group">
                    <div className="col-span-2 font-mono text-xs text-muted-foreground truncate" title={rule.id}>{rule.id.substring(0, 12)}...</div>
                    <div className="col-span-2 font-medium text-foreground truncate">{rule.name}</div>
                    <div className="col-span-2 flex items-center gap-2">
                      {rule.trunk_name ? (
                        <span className="bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded text-xs border border-cyan-500/20 truncate max-w-full">
                          {rule.trunk_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">Any</span>
                      )}
                    </div>
                    <div className="col-span-2 text-xs font-mono text-muted-foreground truncate">
                      Inbound-&lt;caller-number&gt;
                    </div>
                    <div className="col-span-2 text-sm text-foreground truncate">
                      {rule.agent_name || "None"}
                    </div>
                    <div className="col-span-2 flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{rule.rule_type}</span>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 hover:bg-surface-hover rounded text-muted-foreground hover:text-foreground transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(rule.id)} className="p-1.5 hover:bg-red-500/10 rounded text-red-500/50 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

