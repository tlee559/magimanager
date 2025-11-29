import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Expose Vercel system env vars to the browser
  env: {
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    NEXT_PUBLIC_ABRA_URL: process.env.NEXT_PUBLIC_ABRA_URL || "https://abra.magimanager.com",
    NEXT_PUBLIC_KADABRA_URL: process.env.NEXT_PUBLIC_KADABRA_URL || "https://magimanager.com",
    NEXT_PUBLIC_APP_VERSION: "0.1.0",
  },
  // Transpile workspace packages
  transpilePackages: [
    "@magimanager/database",
    "@magimanager/auth",
    "@magimanager/realtime",
  ],
  // Set workspace root for proper file tracing
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Security headers
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
  // Exclude gologin from webpack bundling
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('gologin');
    }
    return config;
  },
};

export default nextConfig;
