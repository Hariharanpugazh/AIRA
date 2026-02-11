"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";

export default function Loader({ message }: { message?: string }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="w-full flex items-center justify-center min-h-[160px]">
      <div className="flex flex-col items-center gap-3">
        <div
          className={`p-3 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
            isDark ? "bg-surface/60" : "bg-white"
          }`}
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <div className="text-sm font-medium text-muted-foreground">
          {message ?? "Loading..."}
        </div>
      </div>
    </div>
  );
}
