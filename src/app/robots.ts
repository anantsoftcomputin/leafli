import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Keep non-production deployments (preview URLs) out of the index entirely.
  if (process.env.NEXT_PUBLIC_SITE_URL && !SITE_URL.includes("leafli.in")) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/login", "/api/"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
