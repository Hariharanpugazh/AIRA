import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "",
    NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880",
  },

  // No rewrites needed - nginx handles API proxying in production
  // In development, set NEXT_PUBLIC_API_URL=http://localhost:8000
};

export default nextConfig;
