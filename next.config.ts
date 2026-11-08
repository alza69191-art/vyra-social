import type { NextConfig } from "next";

const apiHost = process.env.API_INTERNAL_HOSTPORT || "localhost:8000";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://${apiHost}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
