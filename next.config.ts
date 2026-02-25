import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@anthropic-ai/claude-agent-sdk',
  ],
  // Force webpack to bundle (not externalize) these packages so
  // resolve.alias can redirect onnxruntime-node → onnxruntime-web.
  transpilePackages: ['@huggingface/transformers', 'onnxruntime-node'],
  // Webpack config applies only during `next build --webpack` (Vercel).
  // Local dev uses Turbopack which ignores this.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // Redirect onnxruntime-node to onnxruntime-web (WASM).
      // Native .so doesn't load in Lambda; WASM files load from CDN.
      'onnxruntime-node': 'onnxruntime-web',
    }
    return config
  },
  // Exclude onnxruntime-node native binaries (208MB) — not used on Vercel.
  outputFileTracingExcludes: {
    '*': ['node_modules/onnxruntime-node/**/*'],
  },
  // Include onnxruntime-web WASM runtime files that the file tracer misses
  // (loaded via dynamic import() with constructed paths at runtime).
  outputFileTracingIncludes: {
    '*': ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded*'],
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
