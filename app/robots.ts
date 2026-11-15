import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/settings", "/messages", "/notifications", "/support", "/saved", "/call", "/api/"],
    },
    sitemap: "https://vyra-web-rs1b.onrender.com/sitemap.xml",
    host: "https://vyra-web-rs1b.onrender.com",
  };
}
