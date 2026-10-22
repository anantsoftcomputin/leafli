import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Leafli — Fresh bowls. Happy moods.",
    short_name: "Leafli",
    description: "Order chef-made salads and manage your Leafli subscription.",
    start_url: "/",
    display: "standalone",
    background_color: "#f9f6ea",
    theme_color: "#bfcd30",
    icons: [
      { src: "/icon.png", sizes: "600x600", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
