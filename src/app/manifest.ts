import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/** Web app manifest: what the phone uses for the installed icon, name, splash and shortcuts. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Leafli — Fresh bowls. Happy moods.",
    short_name: "Leafli",
    description: "Order chef-made salads, track deliveries live and manage your Leafli subscription.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#f9f6ea",
    theme_color: "#255f30",
    lang: "en-IN",
    dir: "ltr",
    categories: ["food", "health", "lifestyle"],
    prefer_related_applications: false,
    // Lets Chrome's getInstalledRelatedApps() tell the website the app is already installed.
    related_applications: [{ platform: "webapp", url: absoluteUrl("/manifest.webmanifest") }],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Order a bowl", short_name: "Menu", url: "/menu?source=shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My orders", short_name: "Orders", url: "/account?source=shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My subscriptions", short_name: "Plans", url: "/account/subscriptions?source=shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
