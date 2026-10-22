import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a verification build run without clobbering a running `next dev` (`npm run verify`).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Pin the workspace root (a lockfile higher up the tree confuses Next's inference).
  outputFileTracingRoot: path.join(__dirname),
  // Run the Admin SDK from node_modules instead of bundling it (avoids broken source maps).
  serverExternalPackages: ["firebase-admin", "@google-cloud/firestore"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
