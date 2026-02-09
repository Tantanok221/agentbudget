import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow importing code from the parent workspace (agentbudget) for now.
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
