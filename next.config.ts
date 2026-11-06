import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.AUTH_SMOKE_TEST === "1" ? ".next-auth-smoke" : ".next",
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
