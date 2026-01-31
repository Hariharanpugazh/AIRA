"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { SearchSmIcon } from "../../../components/icons";
import { Modal } from "../../../../components/ui/Modal";
import { Select } from "../../../../components/ui/Select";
import { getAccessToken, getMe, getDispatchRules, createDispatchRule, deleteDispatchRule, getSipTrunks, getAgents, DispatchRule } from "../../../../lib/api";

export default function DispatchRulesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [rules, setRules] = useState<DispatchRule[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [trunks, setTrunks] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", rule_type: "individual", trunk_id: "", agent_id: "" });

  useEffect(() => {
    const loadData = async () => {
      if (!getAccessToken()) { router.push("/login"); return; }
      try {
        const u = await getMe();
        setUser(u);

        try {
          const [r, a, t] = await Promise.all([getDispatchRules(), getAgents("default"), getSipTrunks()]);
          setRules(r);
          setAgents(a);
          setTrunks(t);
        } catch (err) {
          console.error("Failed to load resources", err);
        }

        setProjectName(localStorage.getItem("projectName") || "My Project");
      } catch (e) {
        console.error(e);
      }
    };
    loadData();
  }, [router]);

  const handleCreate = async () => {
    if (!formData.name) return;
    try {
      const newRule = await createDispatchRule({
        name: formData.name,
        rule_type: formData.rule_type,
        agent_id: formData.agent_id || undefined,
        trunk_id: formData.trunk_id || undefined
      });
      setRules([newRule, ...rules]);
      setIsModalOpen(false);
      setFormData({ name: "", rule_type: "individual", trunk_id: "", agent_id: "" });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete rule?")) return;
    try {
      await deleteDispatchRule(id);
      setRules(rules.filter(r => r.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (!user) return null;

  return (
    <DashboardLayout user={user}>
      <Header projectName={projectName} pageName="Dispatch rules" showTimeRange={false}
        actionButton={
          <Button size="sm" className="bg-[#00d4aa] text-black hover:bg-[#00e5c0]" onClick={() => setIsModalOpen(true)}>
            Create new dispatch rule
          </Button>
        }
      />
      <div className="p-8 max-w-6xl mx-auto">
        <h1 className="text-xl font-semibold mb-6">Dispatch Rules</h1>

        {rules.length === 0 ? (
          <div className="text-center p-12 bg-surface/50 rounded-lg border border-white/5">
            <p className="text-muted-foreground">No dispatch rules configured.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rules.map(r => (
              <div key={r.id} className="bg-surface border border-white/10 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-foreground">{r.name}</h3>
                  <p className="text-sm text-secondary">{r.rule_type} · Agent: {r.agent_name || "None"} · Trunk: {r.trunk_name || "None"}</p>
                </div>
                <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded">Delete</button>
              </div>
            ))}
          </div>
        )}

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Dispatch Rule"
          footer={<><Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button><Button onClick={handleCreate} className="bg-[#00d4aa] text-black">Create</Button></>}
        >
          <div className="space-y-4">
            <input placeholder="Rule Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-surface border border-white/10 rounded p-2" />

            <select value={formData.agent_id} onChange={e => setFormData({ ...formData, agent_id: e.target.value })} className="w-full bg-surface border border-white/10 rounded p-2">
              <option value="">Select Agent</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>

            <select value={formData.trunk_id} onChange={e => setFormData({ ...formData, trunk_id: e.target.value })} className="w-full bg-surface border border-white/10 rounded p-2">
              <option value="">Select Trunk</option>
              {trunks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
