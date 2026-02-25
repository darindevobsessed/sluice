import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@anthropic-ai/claude-agent-sdk',
  ],
  // Webpack config applies only during `next build --webpack` (Vercel).
  // Local dev uses Turbopack which ignores this.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // Disable onnxruntime-node so @huggingface/transformers falls through
      // to onnxruntime-web (WASM). The native .so doesn't load in Lambda.
      'onnxruntime-node$': false,
    }
    return config
  },
  // Exclude onnxruntime-node binaries from Vercel Lambda (208MB of native
  // binaries we don't use — onnxruntime-web WASM is used instead).
  outputFileTracingExcludes: {
    '*': ['node_modules/onnxruntime-node/**/*'],
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
