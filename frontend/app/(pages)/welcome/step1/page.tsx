"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "../../../../components/layouts/AuthLayout";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { ArrowRight } from "lucide-react";

function RelatimLogo() {
  return (
    <svg viewBox="0 0 48 48" className="w-12 h-12 drop-shadow-lg">
      <defs>
        <linearGradient id="rGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" rx="16" fill="url(#rGrad)" className="animate-pulse-slow" />
      <text
        x="24"
        y="34"
        textAnchor="middle"
        fill="white"
        fontSize="32"
        fontWeight="bold"
        fontFamily="Outfit, sans-serif"
      >
        R
      </text>
    </svg>
  );
}

export default function Step1Page() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      router.push("/login");
      return;
    }
    setUser(JSON.parse(stored));
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setLoading(true);
    localStorage.setItem("projectName", projectName);
    setTimeout(() => {
      router.push("/welcome/step2");
    }, 500);
  };

  if (!user) return null;

  return (
    <AuthLayout>
      <div className="flex flex-col items-center mb-8">
        <RelatimLogo />

        
        <div className="flex items-center gap-3 mt-8">
          <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_10px_theme(colors.primary.DEFAULT)]" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        </div>
      </div>

      <div className="text-center mb-10">
        <h1 className="text-3xl font-sans font-bold text-foreground mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
          Create your first project
        </h1>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
          Projects help you organize your work and collaborate with your team.
        </p>
      </div>

      <Card variant="glass" className="p-8 border-white/5 animate-slide-up">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Project name"
            placeholder="e.g. My Amazing App"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            autoFocus
            className="bg-black/20 focus:bg-black/30"
          />

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20"
            disabled={!projectName.trim()}
            isLoading={loading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Continue
          </Button>
        </form>
      </Card>

      <div className="mt-8 text-center animate-fade-in delay-200">
        <p className="text-xs text-muted-foreground">
          Logged in as <span className="text-foreground font-medium">{user.email}</span>
        </p>
      </div>
    </AuthLayout>
  );
}
