import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://vyra-web-rs1b.onrender.com";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/account", "/saved"] },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
