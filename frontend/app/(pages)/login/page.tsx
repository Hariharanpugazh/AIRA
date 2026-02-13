"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { login, getAccessToken, getMe } from "../../../lib/api";

function Logo() {
  return (
    <svg viewBox="0 0 48 48" className="w-14 h-14 drop-shadow-lg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" rx="14" fill="url(#grad)" />
      <path d="M14 24l8 8 12-16" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Verify token by calling /api/auth/me instead of only checking presence of token
    let mounted = true;
    (async () => {
      try {
        const token = getAccessToken();
        if (!token) return;
        await getMe();
        if (mounted) router.push("/dashboard");
      } catch (e) {
        // token invalid or expired — stay on login
      }
    })();
    return () => { mounted = false; };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-background z-0" />
      <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-primary/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-purple-500/20 rounded-full blur-[100px]" />

      <Card variant="glass" className="w-full max-w-sm p-6 relative z-10 border-border bg-card/50">
        <div className="flex flex-col items-center text-center mb-6">
          <Logo />
          <h1 className="text-2xl font-bold mt-4 text-foreground">Sign in</h1>
          <p className="text-muted-foreground text-sm mt-1">Admin Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-all text-sm"
              placeholder="email@domain.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-all text-sm"
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" className="w-full h-10 mt-2" isLoading={loading}>
            Sign In
          </Button>
        </form>
      </Card>
    </div>
  );
}
