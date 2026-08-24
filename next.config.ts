import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/invitations/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
