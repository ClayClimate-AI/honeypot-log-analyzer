import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      // The sample fixture is bundled into the client as a string, so the
      // "Load sample logs" button never asks the server for it (D3).
      "*.jsonl": { type: "text" },
    },
  },
};

export default nextConfig;
