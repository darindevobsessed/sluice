import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  serverExternalPackages: ['sharp', 'onnxruntime-node'],
  outputFileTracingExcludes: {
    '/': [
      'node_modules/@huggingface/transformers/node_modules/onnxruntime-node/bin/napi-v3/linux/x64/!(libonnxruntime.so.1|onnxruntime_binding.node)',
    ],
  },
};

export default nextConfig;
