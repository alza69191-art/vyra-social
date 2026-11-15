import type { MetadataRoute } from "next";

const siteUrl = "https://vyra-web-rs1b.onrender.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/help", "/help/glossary", "/market", "/pages", "/reels"],
        disallow: [
          "/admin",
          "/login",
          "/account",
          "/settings",
          "/messages",
          "/notifications",
          "/support",
          "/saved",
          "/call",
          "/api/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
