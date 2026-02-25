import type { NextConfig } from "next";

const isVercel = process.env.VERCEL === '1'

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@anthropic-ai/claude-agent-sdk',
    // Keep onnxruntime-node external locally so native binary loads correctly
    ...(!isVercel ? ['onnxruntime-node', '@huggingface/transformers'] : []),
  ],
  turbopack: {
    resolveAlias: {
      // On Vercel: force WASM backend (native .so doesn't load in Lambda)
      // Locally: no alias, onnxruntime-node uses fast native binary
      ...(isVercel ? { 'onnxruntime-node': 'onnxruntime-web' } : {}),
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
    ],
  },
};

export default nextConfig;
