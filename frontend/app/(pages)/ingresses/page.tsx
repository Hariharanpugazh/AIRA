"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "../../../components/layouts/DashboardLayout";
import Header from "../../components/Header";
import { Card } from "../../../components/ui/Card";
import { Upload, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { getAccessToken, getMe, getIngresses, createIngress, deleteIngress, User, Ingress } from "../../../lib/api";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { Plus, Trash2, Upload as UploadIcon } from "lucide-react";

export default function IngressesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ingresses, setIngresses] = useState<Ingress[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", type: "rtmp" });

  useEffect(() => {
    const loadData = async () => {
      if (!getAccessToken()) { router.push("/login"); return; }
      try {
        const [u, i] = await Promise.all([getMe(), getIngresses()]);
        setUser(u);
        setIngresses(i);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  const handleCreate = async () => {
    if (!formData.name) return;
    try {
      const newIngress = await createIngress(formData.name, formData.type as "rtmp" | "whip");
      setIngresses([newIngress, ...ingresses]);
      setIsModalOpen(false);
      setFormData({ name: "", type: "rtmp" });
    } catch (e) {
      console.error(e);
      alert("Failed to create ingress. Ensure LiveKit is configured.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete ingress?")) return;
    try {
      await deleteIngress(id);
      setIngresses(ingresses.filter(i => i.ingress_id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading || !user) return null;

  return (
    <DashboardLayout user={user}>
      <Header projectName="RELATIM" pageName="Ingress" showTimeRange={false}
        actionButton={
          <Button size="sm" onClick={() => setIsModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
            New Ingress
          </Button>
        }
      />

      <div className="p-4 md:p-8">
        {ingresses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-surface/30 rounded-lg border border-white/5">
            <UploadIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <h2 className="text-foreground text-xl font-bold mb-2">No active ingresses</h2>
            <p className="text-muted-foreground text-sm mb-6">Create an ingress to stream into a room.</p>
            <Button onClick={() => setIsModalOpen(true)}>Create Ingress</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ingresses.map((ingress) => (
              <Card key={ingress.ingress_id} variant="glass" className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 rounded bg-primary/10">
                    <UploadIcon className="w-5 h-5 text-primary" />
                  </div>
                  <button onClick={() => handleDelete(ingress.ingress_id)} className="text-red-500 hover:bg-red-500/10 p-1 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-medium text-foreground mb-1">{ingress.name}</h3>
                <div className="text-xs text-secondary font-mono bg-black/20 p-2 rounded mb-2 break-all">
                  URL: {ingress.url}<br />
                  Key: {ingress.stream_key}
                </div>
                <span className="text-[10px] uppercase font-bold text-secondary bg-white/5 px-2 py-1 rounded">{ingress.ingress_type}</span>
              </Card>
            ))}
          </div>
        )}

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Ingress"
          footer={<><Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button><Button onClick={handleCreate}>Create</Button></>}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-surface border border-white/10 rounded p-2" placeholder="My Stream" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full bg-surface border border-white/10 rounded p-2">
                <option value="rtmp">RTMP</option>
                <option value="whip">WHIP</option>
              </select>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
