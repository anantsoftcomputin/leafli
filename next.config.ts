import path from "node:path";
import type { NextConfig } from "next";

// A new version on every deploy (Netlify sets COMMIT_REF) — the service worker uses it
// to detect updates and to version its caches.
const APP_VERSION = (process.env.COMMIT_REF || process.env.NEXT_PUBLIC_APP_VERSION || Date.now().toString(36)).slice(0, 12);

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: APP_VERSION },
  // Lets a verification build run without clobbering a running `next dev` (`npm run verify`).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Pin the workspace root (a lockfile higher up the tree confuses Next's inference).
  outputFileTracingRoot: path.join(__dirname),
  // Run the Admin SDK from node_modules instead of bundling it (avoids broken source maps).
  serverExternalPackages: ["firebase-admin", "@google-cloud/firestore"],
  // Old leafli.in URLs → new pages (301) so existing Google rankings carry over.
  async redirects() {
    return [
      { source: "/products/:slug", destination: "/menu/:slug", permanent: true },
      { source: "/products", destination: "/menu", permanent: true },
      { source: "/shop", destination: "/menu", permanent: true },
      { source: "/cart", destination: "/menu", permanent: true },
      { source: "/checkout", destination: "/menu", permanent: true },
      { source: "/orders", destination: "/account", permanent: true },
      { source: "/orders/:id", destination: "/account", permanent: true },
      { source: "/profile", destination: "/account", permanent: true },
      { source: "/profile/:path*", destination: "/account", permanent: true },
      { source: "/subscriptions", destination: "/account/subscriptions", permanent: true },
      { source: "/subscriptions/:path*", destination: "/account/subscriptions", permanent: true },
      { source: "/register", destination: "/login", permanent: true },
      { source: "/forgot-password", destination: "/login", permanent: true },
      { source: "/reset-password", destination: "/login", permanent: true },
      { source: "/dashboard", destination: "/admin", permanent: false },
      // Blog page 1 lives at the bare URL (one canonical address per listing).
      { source: "/blog/page/1", destination: "/blog", permanent: true },
      { source: "/blog/category/:category/page/1", destination: "/blog/category/:category", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
