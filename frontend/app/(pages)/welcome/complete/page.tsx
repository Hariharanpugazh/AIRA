"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "../../../../components/layouts/AuthLayout";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { ArrowRight, Check, Sparkles, CheckCircle2 } from "lucide-react";

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

export default function CompletePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedProject = localStorage.getItem("projectName");
    if (!storedUser) {
      router.push("/login");
      return;
    }
    setUser(JSON.parse(storedUser));
    setProjectName(storedProject || "Your Project");

    // Trigger animation
    setTimeout(() => setAnimate(true), 100);
  }, [router]);

  const handleGoToDashboard = () => {
    router.push("/dashboard");
  };

  if (!user) return null;

  return (
    <AuthLayout>
      <div className="flex flex-col items-center mb-8">
        <div className={`transition-all duration-700 ${animate ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}>
          <RelatimLogo />
        </div>

        
        <div className="flex items-center gap-3 mt-8">
          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
          <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_10px_theme(colors.primary.DEFAULT)]" />
        </div>
      </div>

      <div className="text-center mb-10">
        <h1
          className={`text-3xl font-sans font-bold text-foreground mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 transition-all duration-700 delay-200 ${animate ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
        >
          You&apos;re all set!
        </h1>
        <p
          className={`text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed transition-all duration-700 delay-300 ${animate ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
        >
          Welcome to Relatim Cloud. Your project{" "}
          <span className="text-primary font-medium">{projectName}</span> is
          ready to go.
        </p>
      </div>

      <div
        className={`transition-all duration-700 delay-500 w-full max-w-sm mx-auto ${animate ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
      >
        <Card variant="glass" className="p-8 border-white/5 mb-8">
          <h3 className="text-foreground font-semibold mb-6 flex items-center gap-2 text-sm uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-primary" />
            What&apos;s next?
          </h3>
          <ul className="space-y-4 text-muted-foreground text-sm">
            <li className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span>Explore your project dashboard</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span>Invite team members to collaborate</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span>Configure your project settings</span>
            </li>
          </ul>
        </Card>

        <Button
          onClick={handleGoToDashboard}
          className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20"
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Go to Dashboard
        </Button>
      </div>
    </AuthLayout>
  );
}
