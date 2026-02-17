"use client";


import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "../../../../components/layouts/AuthLayout";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { ArrowRight, Search, Share2, User, FileText, Github, MessageSquare, Sparkles } from "lucide-react";

const sources = [
  { id: "search", label: "Google Search", icon: <Search className="w-6 h-6" /> },
  { id: "social", label: "Social Media", icon: <Share2 className="w-6 h-6" /> },
  { id: "friend", label: "Friend or Colleague", icon: <User className="w-6 h-6" /> },
  { id: "blog", label: "Blog or Article", icon: <FileText className="w-6 h-6" /> },
  { id: "github", label: "GitHub", icon: <Github className="w-6 h-6" /> },
  { id: "discord", label: "Discord", icon: <MessageSquare className="w-6 h-6" /> },
  { id: "other", label: "Other", icon: <Sparkles className="w-6 h-6" /> },
];

function AIRALogo() {
  return (
    <div className="h-10 w-auto flex items-center justify-center">
      <img
        src="/aira-logo.svg"
        alt="AIRA"
        className="h-full w-auto object-contain dark:filter dark:invert dark:brightness-150"
      />
    </div>
  );
}

export default function Step2Page() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedProject = localStorage.getItem("projectName");
    if (!storedUser) {
      router.push("/login");
      return;
    }
    if (!storedProject) {
      router.push("/welcome/step1");
      return;
    }
    setUser(JSON.parse(storedUser));
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSource) return;

    setLoading(true);
    localStorage.setItem("source", selectedSource);
    setTimeout(() => {
      router.push("/welcome/complete");
    }, 500);
  };

  const handleSkip = () => {
    localStorage.setItem("source", "skipped");
    router.push("/welcome/complete");
  };

  if (!user) return null;

  return (
    <AuthLayout>
      <div className="flex flex-col items-center mb-8">
        <AIRALogo />


        <div className="flex items-center gap-3 mt-8">
          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
          <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_10px_theme(colors.primary.DEFAULT)]" />
          <div className="w-2.5 h-2.5 rounded-full bg-muted/5" />
        </div>
      </div>

      <div className="text-center mb-10">
        <h1 className="text-3xl font-sans font-bold text-foreground mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
          Where did you hear about us?
        </h1>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
          Help us understand how you discovered AIRA Cloud.
        </p>
      </div>

      <Card variant="glass" className="p-8 border-border/40 animate-slide-up">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
            {sources.map((source) => (
              <button
                key={source.id}
                type="button"
                onClick={() => setSelectedSource(source.id)}
                className={`p-4 rounded-xl border text-left transition-all duration-300 group ${selectedSource === source.id
                  ? "border-primary bg-primary/20 text-primary shadow-lg shadow-primary/10"
                  : "border-border/40 bg-muted/5 text-muted-foreground hover:border-border/40 hover:bg-muted/10 hover:text-foreground"
                  } flex flex-col items-start gap-3`}
              >
                <span className={`transition-colors duration-300 ${selectedSource === source.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>{source.icon}</span>
                <span className="text-xs font-semibold">{source.label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-4 pt-2">
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20"
              disabled={!selectedSource}
              isLoading={loading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Continue
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={handleSkip}
            >
              Skip this step
            </Button>
          </div>
        </form>
      </Card>
    </AuthLayout>
  );
}
