import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  experimental: {
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
