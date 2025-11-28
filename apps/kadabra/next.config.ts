import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
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
