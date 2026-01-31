"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../../components/layouts/DashboardLayout";
import Header from "../../../components/Header";
import { Button } from "../../../../components/ui/Button";
import { SearchSmIcon } from "../../../components/icons";
import { Modal } from "../../../../components/ui/Modal";
import { getAccessToken, getMe, getSipTrunks, createSipTrunk, deleteSipTrunk } from "../../../../lib/api";

export default function SipTrunksPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [trunks, setTrunks] = useState<any[]>([]);
  const [formData, setFormData] = useState({ name: "", numbers: "", sip_server: "", username: "", password: "" });

  useEffect(() => {
    const loadData = async () => {
      const token = getAccessToken();
      if (!token) { router.push("/login"); return; }
      try {
        const [userData, trunksData] = await Promise.all([getMe(), getSipTrunks()]);
        setUser(userData);
        setTrunks(trunksData);
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
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this trunk?")) return;
    try {
      await deleteSipTrunk(id);
      setTrunks(trunks.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (!user) return null;

  const actionButton = (
    <Button
      size="sm"
      className="bg-[#00d4aa] text-black hover:bg-[#00e5c0]"
      onClick={() => setIsModalOpen(true)}
    >
      Create new trunk
    </Button>
  );

  return (
    <DashboardLayout user={user}>
      <Header
        projectName={projectName}
        pageName="SIP Trunks"
        showTimeRange={false}
        actionButton={actionButton}
      />

      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-2">SIP Trunks</h1>
          <p className="text-secondary text-sm">
            Connect your existing telephony infrastructure.
          </p>
        </div>

        {trunks.length === 0 ? (
          <div className="rounded-lg bg-surface border border-white/10 overflow-hidden min-h-[400px] flex flex-col items-center justify-center">
            <div className="text-center p-8">
              {/* Same empty state icon */}
              <h3 className="text-lg font-medium text-foreground mb-2">No SIP trunks configured</h3>
              <p className="text-secondary text-sm mb-6 max-w-sm mx-auto">Configure inbound and outbound SIP trunks.</p>
              <Button className="bg-[#00d4aa] text-black hover:bg-[#00e5c0]" onClick={() => setIsModalOpen(true)}>Create new trunk</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {trunks.map(t => (
              <div key={t.id} className="bg-surface border border-white/10 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-foreground">{t.name}</h3>
                  <p className="text-sm text-secondary">{t.sip_server || "No server configured"} · {t.numbers?.length || 0} numbers</p>
                </div>
                <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded">Delete</button>
              </div>
            ))}
          </div>
        )}

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Create a new SIP trunk"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button className="bg-[#00d4aa] text-black hover:bg-[#00e5c0]" onClick={handleCreate}>Create trunk</Button>
            </>
          }
        >
          <div className="space-y-6">
            <div>
              <label className="block text-[13px] font-medium text-foreground mb-2">Trunk name</label>
              <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} type="text" className="w-full px-3 py-2 bg-surface border border-white/10 rounded-lg text-sm text-foreground focus:outline-none focus:border-[#00d4aa]/50" />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-foreground mb-4">Inbound settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-medium text-foreground mb-2">Inbound numbers (comma sep)</label>
                    <input value={formData.numbers} onChange={e => setFormData({ ...formData, numbers: e.target.value })} type="text" className="w-full px-3 py-2 bg-surface border border-white/10 rounded-lg text-sm text-foreground focus:outline-none focus:border-[#00d4aa]/50" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-foreground mb-4">Outbound settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-medium text-foreground mb-2">Address</label>
                    <input value={formData.sip_server} onChange={e => setFormData({ ...formData, sip_server: e.target.value })} type="text" className="w-full px-3 py-2 bg-surface border border-white/10 rounded-lg text-sm text-foreground focus:outline-none focus:border-[#00d4aa]/50" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-foreground mb-2">Username</label>
                    <input value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} type="text" className="w-full px-3 py-2 bg-surface border border-white/10 rounded-lg text-sm text-foreground focus:outline-none focus:border-[#00d4aa]/50" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-foreground mb-2">Password</label>
                    <input value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} type="password" className="w-full px-3 py-2 bg-surface border border-white/10 rounded-lg text-sm text-foreground focus:outline-none focus:border-[#00d4aa]/50" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>

      </div>
    </DashboardLayout>
  );
}
