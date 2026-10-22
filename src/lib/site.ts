// Public site constants shared by pages, metadata and structured data.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://leafli.in").replace(/\/$/, "");
export const SITE_NAME = "Leafli";
export const SITE_TAGLINE = "Fresh bowls. Happy moods.";
export const SITE_DESCRIPTION =
  "Chef-made salads and healthy bowls, delivered fresh with dressings on the side. Order online or subscribe and save up to 22% with Leafli salad plans.";

export const absoluteUrl = (path = "/") => (path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`);

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/** "2026-10-23" in India time. */
export function istDate(d = new Date()) {
  return new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
