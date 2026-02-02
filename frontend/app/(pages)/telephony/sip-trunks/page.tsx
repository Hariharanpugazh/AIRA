"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { Search, Plus, Phone, Server, Shield, Trash2, X, PlusCircle, Settings2, Filter, Info, Copy, PhoneIncoming, PhoneOutgoing, ChevronDown, MoreHorizontal } from "lucide-react";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import { Input } from "../../../../components/ui/Input";
import { cn } from "../../../../lib/utils";
import { getAccessToken, getSipTrunks, createSipTrunk, deleteSipTrunk, SipTrunk } from "../../../../lib/api";

export default function SipTrunksPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [trunks, setTrunks] = useState<any[]>([]);
  const [formData, setFormData] = useState({ name: "", numbers: "", sip_server: "", username: "", password: "" });

  useEffect(() => {
    const loadData = async () => {
      const token = getAccessToken();
      if (!token) { router.push("/login"); return; }
      try {
        const [trunksData] = await Promise.all([getSipTrunks()]);
        setTrunks(trunksData);
        setProjectName(localStorage.getItem("projectName") || "My Project");
      } catch (e) {
        console.error("Failed to load trunks", e);
      }
    };
    loadData();
  }, [router]);

  const handleCreate = async () => {
    if (!formData.name) return;
    try {
      const newTrunk = await createSipTrunk({
        name: formData.name,
        numbers: formData.numbers.split(",").map(s => s.trim()),
        sip_server: formData.sip_server,
        username: formData.username,
        password: formData.password
      });
      setTrunks([newTrunk, ...trunks]);
      setIsModalOpen(false);
      setFormData({ name: "", numbers: "", sip_server: "", username: "", password: "" });
    } catch (e) {
      console.error("Failed to create trunk", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this trunk?")) return;
    try {
      await deleteSipTrunk(id);
      setTrunks(trunks.filter(t => t.id !== id));
    } catch (e) {
      console.error("Failed to delete trunk", e);
    }
  };

  const actionButton = null;

  return (
    <DashboardLayout>
      <Header
        projectName={projectName}
        sectionName="Telephony"
        pageName="SIP trunks"
        showTimeRange={false}
        actionButton={
          <Button 
            size="sm" 
            className="bg-primary hover:bg-primary/90 text-white font-bold text-[11px] uppercase tracking-widest px-6 h-9"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-2 stroke-3" />
            Create new trunk
          </Button>
        }
      />

      <div className="p-6 md:p-8 space-y-12 max-w-[1600px] mx-auto animate-fade-in">
        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm relative">
            <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Total Inbound Trunks
              <Info className="w-3.5 h-3.5 opacity-40" />
            </div>
            <div className="text-[32px] font-light text-foreground">{trunks.filter(t => t.direction !== 'outbound').length}</div>
          </Card>

          <Card className="p-6 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm relative">
            <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Total Outbound Trunks
              <Info className="w-3.5 h-3.5 opacity-40" />
            </div>
            <div className="text-[32px] font-light text-foreground">{trunks.filter(t => t.direction === 'outbound').length}</div>
          </Card>

          <Card className="p-6 border-border/60 shadow-sm bg-background/50 backdrop-blur-sm relative">
            <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              SIP URI
              <Info className="w-3.5 h-3.5 opacity-40" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-[14px] font-mono text-foreground truncate bg-muted/30 px-3 py-1.5 rounded-lg border border-border/40">
                sip:d7erc92zoce.sip.livekit.cloud
              </div>
              <button 
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all"
                onClick={() => navigator.clipboard.writeText("sip:d7erc92zoce.sip.livekit.cloud")}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </Card>
        </div>

        {/* Inbound Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <PhoneIncoming className="w-4 h-4" />
            Inbound
          </div>
          <div className="bg-background border border-border/60 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Trunks</h3>
              <Search className="w-3.5 h-3.5 text-muted-foreground/50" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="bg-muted/30 text-muted-foreground font-bold uppercase tracking-widest border-b border-border/50">
                  <tr>
                    <th className="px-6 py-3">Trunk ID</th>
                    <th className="px-6 py-3">Trunk Name</th>
                    <th className="px-6 py-3">Numbers</th>
                    <th className="px-6 py-3 flex items-center gap-1">
                      Created At
                      <ChevronDown className="w-3 h-3" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trunks.filter(t => t.direction !== 'outbound').length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No results.</td>
                    </tr>
                  ) : (
                    trunks.filter(t => t.direction !== 'outbound').map(t => (
                      <tr key={t.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4 font-mono text-muted-foreground">{t.id.substring(0, 12)}...</td>
                        <td className="px-6 py-4 font-medium">{t.name}</td>
                        <td className="px-6 py-4">{t.numbers?.join(', ') || '-'}</td>
                        <td className="px-6 py-4 text-muted-foreground">{new Date().toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Outbound Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <PhoneOutgoing className="w-4 h-4" />
            Outbound
          </div>
          <div className="bg-background border border-border/60 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Trunks</h3>
              <Search className="w-3.5 h-3.5 text-muted-foreground/50" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="bg-muted/30 text-muted-foreground font-bold uppercase tracking-widest border-b border-border/50">
                  <tr>
                    <th className="px-6 py-3">Trunk ID</th>
                    <th className="px-6 py-3">Trunk Name</th>
                    <th className="px-6 py-3">Numbers</th>
                    <th className="px-6 py-3">SIP URI</th>
                    <th className="px-6 py-3 flex items-center gap-1">
                      Created At
                      <ChevronDown className="w-3 h-3" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trunks.filter(t => t.direction === 'outbound').length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">No results.</td>
                    </tr>
                  ) : (
                    trunks.filter(t => t.direction === 'outbound').map(t => (
                      <tr key={t.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4 font-mono text-muted-foreground">{t.id.substring(0, 12)}...</td>
                        <td className="px-6 py-4 font-medium">{t.name}</td>
                        <td className="px-6 py-4">{t.numbers?.join(', ') || '-'}</td>
                        <td className="px-6 py-4 font-mono text-[10px]">{t.sip_server || '-'}</td>
                        <td className="px-6 py-4 text-muted-foreground">{new Date().toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Configure SIP Trunk"
          width="max-w-3xl"
        >
          <div className="space-y-8 py-2">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Identity</label>
              <Input 
                label="Friendly Name"
                placeholder="e.g. Twilio Trunk"
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex items-center gap-2 px-1">
                  <PlusCircle className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Inbound (Termination)</h3>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5 px-1">Assigned Numbers</label>
                  <textarea 
                    placeholder="+1234567890, +1987654321"
                    value={formData.numbers} 
                    onChange={e => setFormData({ ...formData, numbers: e.target.value })} 
                    className="w-full bg-muted/20 border border-border/60 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all min-h-[100px] resize-none"
                  />
                  <p className="mt-2 text-[11px] text-muted-foreground px-1">Comma-separated internal numbers to route.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-2 px-1">
                  <Shield className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Outbound (Origination)</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5 px-1">Gateway Address</label>
                    <Input 
                      placeholder="sip.example.com"
                      value={formData.sip_server} 
                      onChange={e => setFormData({ ...formData, sip_server: e.target.value })} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5 px-1">Username</label>
                      <Input 
                        placeholder="User"
                        value={formData.username} 
                        onChange={e => setFormData({ ...formData, username: e.target.value })} 
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5 px-1">Password</label>
                      <Input 
                        type="password"
                        placeholder="••••••••"
                        value={formData.password} 
                        onChange={e => setFormData({ ...formData, password: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-border/60">
              <Button variant="outline" className="text-xs h-10 border-border/60 hover:bg-muted/50" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button className="bg-primary hover:bg-primary/90 text-white font-bold text-[11px] uppercase tracking-widest px-8 h-10" onClick={handleCreate}>Save Trunk</Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
