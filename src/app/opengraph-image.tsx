import { ogCard, OG_SIZE } from "@/lib/og/card";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Leafli — Fresh bowls. Happy moods.";

export default function Image() {
  return ogCard({ eyebrow: "Healthy salad delivery", title: "Fresh bowls. Happy moods.", subtitle: "leafli.in" });
}
