import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use standalone for Docker, but Vercel works with this too
  output: "standalone",

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
  },

  // Image optimization
  images: {
    unoptimized: true,
  },

  // For Vercel deployment
  trailingSlash: false,
};

export default nextConfig;
