import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Branded 1200×630 share card (logo colours), optionally with a dish photo. */
export function ogCard({ eyebrow, title, subtitle, image }: { eyebrow: string; title: string; subtitle?: string; image?: string | null }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#bfcd30", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 56px", width: image ? 700 : 1200 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#255f30", letterSpacing: 2, textTransform: "uppercase" }}>{eyebrow}</div>
          <div style={{ fontSize: title.length > 60 ? 54 : 66, fontWeight: 800, color: "#12331a", lineHeight: 1.05 }}>{title}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: "#255f30" }}>leafli</div>
            {subtitle ? <div style={{ fontSize: 26, color: "#255f30" }}>{subtitle}</div> : null}
          </div>
        </div>
        {image ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 500 }}>
            <img src={image} width={460} height={460} style={{ borderRadius: 999 }} alt="" />
          </div>
        ) : null}
      </div>
    ),
    OG_SIZE,
  );
}
