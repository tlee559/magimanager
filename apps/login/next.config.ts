import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    NEXT_PUBLIC_ABRA_URL: process.env.NEXT_PUBLIC_ABRA_URL || "https://abra.magimanager.com",
    NEXT_PUBLIC_KADABRA_URL: process.env.NEXT_PUBLIC_KADABRA_URL || "https://magimanager.com",
    NEXT_PUBLIC_LOGIN_URL: process.env.NEXT_PUBLIC_LOGIN_URL || "https://login.magimanager.com",
  },
  transpilePackages: [
    "@magimanager/database",
    "@magimanager/auth",
  ],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },
};

export default nextConfig;
