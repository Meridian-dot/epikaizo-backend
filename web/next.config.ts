import type { NextConfig } from "next";

// Where the Express API runs (api/). The browser calls /api/... on this site and
// Next.js forwards it there, so the login cookie stays on the dashboard's own address.
const apiUrl = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
