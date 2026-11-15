import type { NextConfig } from "next";

const apiHost = process.env.API_INTERNAL_HOSTPORT || "localhost:8000";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      ...["admin", "account", "settings", "messages", "notifications", "support", "saved", "call", "login", "market/orders", "market/cart", "market/seller-orders"].map((path) => ({
        source: `/${path}/:path*`,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
      {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
      },
    ];
  },
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
