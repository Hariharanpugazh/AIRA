"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";
import {
  Search, Plus, Copy, Check, Trash2, Edit2, X, Globe, AlertTriangle,
  PhoneIncoming, PhoneOutgoing, ChevronDown, ChevronUp, Filter, Zap,
  ArrowRight, Shuffle, Hash, Shield
} from "lucide-react";
import { CreateDispatchRuleModal } from "../../../../components/modals/CreateDispatchRuleModal";
import {
  getAccessToken, getDispatchRules, createDispatchRule, deleteDispatchRule,
  getSipTrunks, getAgents, getProjects, DispatchRule, Agent, SipTrunk, Project,
} from "../../../../lib/api";
import { DelayedLoader } from "../../../../components/ui/DelayedLoader";
import { Modal } from "../../../../components/ui/Modal";
import { cn } from "../../../../lib/utils";

interface DispatchRulesPageProps {
  projectId?: string;
}

export default function DispatchRulesPage({ projectId }: DispatchRulesPageProps) {
  const router = useRouter();
  const [projectName, setProjectName] = useState<string>("");
  const [resolvedProjectId, setResolvedProjectId] = useState<string | undefined>(undefined);
  const [rules, setRules] = useState<DispatchRule[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [trunks, setTrunks] = useState<SipTrunk[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";
  const sipDomain = livekitUrl.replace(/^wss?:\/\//, "").replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  const sipUri = sipDomain ? `sip:${sipDomain}` : (trunks.length > 0 && trunks[0].sip_uri ? trunks[0].sip_uri : null);

  const loadData = useCallback(async (showLoader = true) => {
    if (!getAccessToken()) { router.push("/login"); return; }
    if (showLoader) setRefreshing(true);
    try {
      const projects = await getProjects();
      const localProjectId = localStorage.getItem("projectId");
      const currentProject =
        projects.find((p: Project) => p.id === projectId || p.short_id === projectId) ||
        projects.find((p: Project) => p.id === localProjectId || p.short_id === localProjectId) ||
        projects[0];

      if (!currentProject) {
        setRules([]); setAgents([]); setTrunks([]);
        return;
      }

      setResolvedProjectId(currentProject.id);
      setProjectName(currentProject.name || "Project");
      localStorage.setItem("projectId", currentProject.id);
      localStorage.setItem("projectName", currentProject.name);

      const [r, a, t] = await Promise.all([
        getDispatchRules(currentProject.id),
        getAgents(currentProject.id),
        getSipTrunks(currentProject.id),
      ]);
      setRules(r);
      setAgents(a);
      setTrunks(t);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, projectId]);

  useEffect(() => { loadData(true); }, [loadData]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefreshRef.current) { clearInterval(autoRefreshRef.current); autoRefreshRef.current = null; }
    if (autoRefreshInterval > 0) {
      autoRefreshRef.current = setInterval(() => loadData(false), autoRefreshInterval);
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [autoRefreshInterval, loadData]);

  const handleRefresh = async () => { await loadData(true); };

  const handleCreate = async (data: {
    name: string;
    rule_type: "individual" | "direct" | "callee";
    room_prefix?: string;
    trunk_id?: string;
    agent_id?: string;
    randomize?: boolean;
  }) => {
    if (!resolvedProjectId) throw new Error("No project selected");
    const newRule = await createDispatchRule({
      name: data.name,
      rule_type: data.rule_type,
      room_prefix: data.room_prefix,
      trunk_id: data.trunk_id,
      agent_id: data.agent_id,
      randomize: data.randomize,
    }, resolvedProjectId);
    setRules(prev => [newRule, ...prev]);
  };

  const handleDelete = async (id: string) => {
    if (!resolvedProjectId) return;
    try {
      await deleteDispatchRule(id, resolvedProjectId);
      setRules(prev => prev.filter(r => r.id !== id));
      setDeleteConfirmId(null);
    } catch {
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter rules
  const filteredRules = searchQuery.trim()
    ? rules.filter(r => {
      const q = searchQuery.toLowerCase();
      return (
        r.id?.toLowerCase().includes(q) ||
        r.name?.toLowerCase().includes(q) ||
        r.rule_type?.toLowerCase().includes(q) ||
        r.agent_name?.toLowerCase().includes(q) ||
        r.trunk_name?.toLowerCase().includes(q) ||
        r.room_prefix?.toLowerCase().includes(q)
      );
    })
    : rules;

  // Stats
  const directRules = rules.filter(r => r.rule_type === "direct").length;
  const individualRules = rules.filter(r => r.rule_type === "individual").length;
  const calleeRules = rules.filter(r => r.rule_type === "callee").length;

  // Get trunk name from id for display
  const getTrunkName = (trunkId?: string | null) => {
    if (!trunkId) return null;
    const t = trunks.find(tr => tr.id === trunkId);
    return t ? t.name : trunkId.substring(0, 12) + "…";
  };

  const getAgentName = (agentId?: string | null) => {
    if (!agentId) return null;
    const a = agents.find(ag => ag.id === agentId || ag.agent_id === agentId);
    return a ? a.name : agentId.substring(0, 12) + "…";
  };

  const getRuleTypeStyles = (type: string) => {
    switch (type) {
      case "direct":
        return { bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", icon: ArrowRight };
      case "individual":
        return { bg: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20", icon: Hash };
      case "callee":
        return { bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", icon: Shuffle };
      default:
        return { bg: "bg-muted text-muted-foreground border-border/50", icon: ArrowRight };
    }
  };

  return (
    <>
      {loading && <DelayedLoader />}
      <Header
        projectName={projectName}
        sectionName="Telephony"
        pageName="Dispatch Rules"
        showTimeRange={false}
        onRefresh={handleRefresh}
        onAutoRefreshChange={setAutoRefreshInterval}
        actionButton={
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-white font-bold text-[11px] uppercase tracking-widest px-6 h-9"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-2 stroke-3" />
            Create Rule
          </Button>
        }
      />

      <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto animate-fade-in" style={{ fontFamily: "'Outfit', sans-serif" }}>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Rules */}
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Rules</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{rules.length}</div>
            </div>
          </Card>

          {/* Direct */}
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
                  <ArrowRight className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Direct</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{directRules}</div>
            </div>
          </Card>

          {/* Individual */}
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10">
                  <Hash className="w-4 h-4 text-violet-500" />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Individual</span>
              </div>
              <div className="text-3xl font-semibold text-foreground tracking-tight">{individualRules}</div>
            </div>
          </Card>

          {/* SIP URI */}
          <Card className="group relative overflow-hidden p-5 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
                  <Globe className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">SIP Domain</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-foreground truncate bg-muted/30 px-2.5 py-1 rounded-lg border border-border/40 flex-1 min-w-0">
                  {sipUri || "Not configured"}
                </code>
                {sipUri && (
                  <button onClick={() => handleCopy(sipUri)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all shrink-0">
                    {copiedId === sipUri ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Table Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>Dispatch Rules</h2>
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full font-medium">
                {filteredRules.length} result{filteredRules.length !== 1 ? "s" : ""}
              </span>
              {refreshing && (
                <div className="flex items-center gap-1.5 text-xs text-primary animate-pulse">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  Refreshing…
                </div>
              )}
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Search rules…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-9 w-64 pl-9 pr-4 bg-background border border-border/60 rounded-lg text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/50"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="bg-background border border-border/60 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse" style={{ fontFamily: "'Outfit', sans-serif" }}>
                <thead className="bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-widest border-b border-border/50">
                  <tr>
                    <th className="px-5 py-3 font-bold">Rule ID</th>
                    <th className="px-5 py-3 font-bold">Name</th>
                    <th className="px-5 py-3 font-bold">Type</th>
                    <th className="px-5 py-3 font-bold">Inbound Routing</th>
                    <th className="px-5 py-3 font-bold">Room</th>
                    <th className="px-5 py-3 font-bold">Agent</th>
                    <th className="px-5 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3 max-w-[280px] mx-auto">
                          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-muted-foreground/50" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">No dispatch rules</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                              {searchQuery ? "Try adjusting your search" : "Create a dispatch rule to route SIP calls"}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRules.map(rule => {
                      const ruleStyle = getRuleTypeStyles(rule.rule_type);
                      const RuleIcon = ruleStyle.icon;
                      const trunkName = getTrunkName(rule.trunk_id) || rule.trunk_name;
                      const agentName = getAgentName(rule.agent_id) || rule.agent_name;

                      return (
                        <tr key={rule.id} className="group hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <code className="text-[11px] text-muted-foreground/80 font-mono truncate max-w-[100px]">
                                {rule.id.substring(0, 12)}…
                              </code>
                              <button
                                onClick={() => handleCopy(rule.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                              >
                                {copiedId === rule.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-foreground font-medium">{rule.name}</td>
                          <td className="px-5 py-3.5">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border",
                              ruleStyle.bg
                            )}>
                              <RuleIcon className="w-3 h-3" />
                              {rule.rule_type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {trunkName ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/5 text-primary text-[10px] font-bold uppercase border border-primary/10">
                                <PhoneIncoming className="w-3 h-3" />
                                {trunkName}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">Any trunk</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {rule.room_prefix ? (
                              <code className="text-[11px] text-violet-500 font-mono">{rule.room_prefix}*</code>
                            ) : (
                              <span className="text-muted-foreground text-[11px] italic">Auto</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {agentName ? (
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary font-bold">
                                  {agentName[0]?.toUpperCase() || "A"}
                                </div>
                                <span className="text-foreground text-[12.5px]">{agentName}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setDeleteConfirmId(rule.id); setDeleteConfirmName(rule.name); }}
                                className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                                title="Delete rule"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
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

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Dispatch Rule">
        <div className="space-y-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-500">This action cannot be undone</p>
              <p className="text-xs text-muted-foreground mt-1">Calls matching this rule will no longer be routed.</p>
            </div>
          </div>
          <p className="text-sm text-foreground">
            Are you sure you want to delete <strong>{deleteConfirmName}</strong>?
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-border/60">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="text-xs h-9">Cancel</Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white font-bold text-[11px] uppercase tracking-widest px-6 h-9"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Rule
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
