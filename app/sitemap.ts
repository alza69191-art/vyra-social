import type { MetadataRoute } from "next";

const siteUrl = "https://vyra-web-rs1b.onrender.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/help", "/help/glossary"];
  return paths.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
