import { DishArt } from "./DishArt";

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

/** Public URL of a dish photo in Firebase Storage (uploaded by `npm run seed`). */
export function storagePhoto(id: string, variant: "cutout" | "photo" = "cutout") {
  if (!BUCKET) return undefined;
  const file = `menu/${id}${variant === "cutout" ? "-cutout" : ""}.webp`;
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(file)}?alt=media`;
}

const SEEDED = new Set(["chicken-caesar", "asian-rice-noodle", "chana-moong", "caprese", "potato-apple", "chocolate-fruit-bowl"]);

/**
 * Picture of a dish: the image URL saved on the menu item (Firebase Storage),
 * then the seeded Storage photo, then an SVG illustration for dishes with no photo yet.
 */
export function DishImage({
  id,
  src,
  alt,
  className,
  priority,
}: {
  id: string;
  src?: string | null;
  alt?: string;
  className?: string;
  priority?: boolean;
}) {
  const photo = src || (SEEDED.has(id) ? storagePhoto(id) : undefined);
  if (!photo) return <DishArt id={id} className={className} title={alt} />;
  const round = photo.includes("-cutout");
  return (
    <img
      src={photo}
      alt={alt ?? ""}
      width={900}
      height={900}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      draggable={false}
      className={`${round ? "rounded-full" : "rounded-full object-cover"} aspect-square ${className ?? ""}`}
    />
  );
}
