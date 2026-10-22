import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SETTINGS } from "@/lib/billing";
import { adminBucket } from "@/lib/firebase/admin";
import { MENU_ITEMS, PREP_ITEMS, RAW_ITEMS, SUPPLIERS } from "@/lib/seed/sopData";
import { col } from "./inventory";
import { recostPreps } from "./stockOps";

const ASSET_DIR = path.join(process.cwd(), "seed-assets", "menu");

/** Public URL for an object under a public-read path (see storage.rules → /menu). */
export function storageUrl(objectPath: string) {
  const bucket = adminBucket().name;
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media`;
}

/** Upload one dish's photos to Storage (skips files already there unless `force`). */
async function uploadDishPhotos(id: string, force: boolean) {
  const out: { photo?: string; cutout?: string; uploaded: number } = { uploaded: 0 };
  for (const [key, file] of [["photo", `${id}.webp`], ["cutout", `${id}-cutout.webp`]] as const) {
    const local = path.join(ASSET_DIR, file);
    if (!fs.existsSync(local)) continue;
    const dest = `menu/${file}`;
    const [exists] = await adminBucket().file(dest).exists();
    if (!exists || force) {
      await adminBucket().upload(local, {
        destination: dest,
        metadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" },
      });
      out.uploaded++;
    }
    out[key] = storageUrl(dest);
  }
  return out;
}

export interface SeedResult {
  suppliers: number;
  items: number;
  menu: number;
  photosUploaded: number;
  recosted: number;
}

/**
 * Load the SOP master data into Firestore and dish photos into Storage.
 * Existing documents are left alone unless `overwrite`; stock levels are never touched.
 */
export async function seedAll({ overwrite = false } = {}): Promise<SeedResult> {
  const counts: SeedResult = { suppliers: 0, items: 0, menu: 0, photosUploaded: 0, recosted: 0 };

  for (const s of SUPPLIERS) {
    const ref = col.suppliers().doc(s.id);
    if ((await ref.get()).exists && !overwrite) continue;
    const { id: _id, ...rest } = s;
    await ref.set(rest, { merge: true });
    counts.suppliers++;
  }

  for (const i of [...RAW_ITEMS, ...PREP_ITEMS]) {
    const ref = col.items().doc(i.id);
    const snap = await ref.get();
    if (snap.exists && !overwrite) continue;
    const { id: _id, currentStock, ...rest } = i;
    await ref.set({ ...rest, ...(snap.exists ? {} : { currentStock: currentStock ?? 0 }), updatedAt: Date.now() }, { merge: true });
    counts.items++;
  }

  for (const m of MENU_ITEMS) {
    const ref = col.menu().doc(m.id);
    const snap = await ref.get();
    const photos = await uploadDishPhotos(m.id, overwrite);
    counts.photosUploaded += photos.uploaded;
    const { id: _id, imageUrl: _ignored, ...rest } = m;
    const images = { imageUrl: photos.cutout ?? null, photoUrl: photos.photo ?? null };
    if (snap.exists && !overwrite) {
      // Keep the manager's edits, but make sure the dish has its Storage photo.
      if (!snap.get("imageUrl") && images.imageUrl) await ref.update(images);
      continue;
    }
    await ref.set({ ...rest, ...images }, { merge: true });
    counts.menu++;
  }

  const settings = col.settings();
  if (!(await settings.get()).exists) await settings.set(DEFAULT_SETTINGS);
  await col.items().firestore.collection("meta").doc("seed").set({ at: Date.now(), overwrite }, { merge: true });
  counts.recosted = (await recostPreps()).updated;
  return counts;
}
