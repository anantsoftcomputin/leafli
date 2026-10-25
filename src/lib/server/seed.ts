import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SETTINGS } from "@/lib/billing";
import { adminBucket } from "@/lib/firebase/admin";
import { MENU_ITEMS, PLANS, PREP_ITEMS, RAW_ITEMS, SUPPLIERS } from "@/lib/seed/sopData";
import { SEED_POSTS } from "@/lib/seed/posts";
import { VADODARA_POSTS_A } from "@/lib/seed/postsVadodara";
import { VADODARA_POSTS_B } from "@/lib/seed/postsVadodara2";
import { renderMarkdown } from "@/lib/markdown";
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
  const out: { photo?: string; cutout?: string; og?: string; uploaded: number } = { uploaded: 0 };
  for (const [key, file] of [["photo", `${id}.webp`], ["cutout", `${id}-cutout.webp`], ["og", `${id}-og.jpg`]] as const) {
    const local = path.join(ASSET_DIR, file);
    if (!fs.existsSync(local)) continue;
    const dest = `menu/${file}`;
    const [exists] = await adminBucket().file(dest).exists();
    if (!exists || force) {
      await adminBucket().upload(local, {
        destination: dest,
        metadata: { contentType: file.endsWith(".jpg") ? "image/jpeg" : "image/webp", cacheControl: "public, max-age=31536000, immutable" },
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
  plans: number;
  posts: number;
  recosted: number;
}

/**
 * Load the SOP master data into Firestore and dish photos into Storage.
 * Existing documents are left alone unless `overwrite`; stock levels are never touched.
 */
export async function seedAll({ overwrite = false } = {}): Promise<SeedResult> {
  const counts: SeedResult = { suppliers: 0, items: 0, menu: 0, photosUploaded: 0, plans: 0, posts: 0, recosted: 0 };

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
    const images = { imageUrl: photos.cutout ?? null, photoUrl: photos.photo ?? null, ogImageUrl: photos.og ?? null };
    if (snap.exists && !overwrite) {
      // Keep the manager's edits, but fill in fields added since the dish was first seeded.
      const missing: Record<string, unknown> = {};
      if (!snap.get("imageUrl") && images.imageUrl) Object.assign(missing, images);
      if (!snap.get("ogImageUrl") && images.ogImageUrl) missing.ogImageUrl = images.ogImageUrl;
      if (!snap.get("slug") && m.slug) missing.slug = m.slug;
      if (!snap.get("ingredients") && m.ingredients) missing.ingredients = m.ingredients;
      if (!snap.get("nutrition") && m.nutrition) missing.nutrition = m.nutrition;
      if (Object.keys(missing).length) await ref.update(missing);
      continue;
    }
    await ref.set({ ...rest, ...images }, { merge: true });
    counts.menu++;
  }

  const db = col.items().firestore;
  for (const p of PLANS) {
    const ref = db.collection("plans").doc(p.id);
    if ((await ref.get()).exists && !overwrite) continue;
    const { id: _id, ...rest } = p;
    await ref.set({ ...rest, updatedAt: Date.now() });
    counts.plans++;
  }

  counts.posts = await seedPosts();

  const settings = col.settings();
  if (!(await settings.get()).exists) await settings.set(DEFAULT_SETTINGS);
  await col.items().firestore.collection("meta").doc("seed").set({ at: Date.now(), overwrite }, { merge: true });
  counts.recosted = (await recostPreps()).updated;
  return counts;
}

/** Starter blog posts — only created once (never overwritten, so edits are safe). */
export async function seedPosts() {
  const db = col.items().firestore;
  let created = 0;
  for (const sp of [...SEED_POSTS, ...VADODARA_POSTS_A, ...VADODARA_POSTS_B]) {
    const ref = db.collection("posts").doc(sp.slug);
    if ((await ref.get()).exists) continue;
    const { coverDish, daysAgo = 0, publishAt, ...rest } = sp;
    const cover = storageUrl(`menu/${coverDish}.webp`);
    const { wordCount, readingMinutes } = renderMarkdown(rest.content);
    const ts = publishAt ? Date.parse(publishAt) : Date.now() - daysAgo * 86400000;
    if (ts > Date.now()) rest.status = "scheduled";
    await ref.set({ ...rest, coverImage: cover, ogImage: storageUrl(`menu/${coverDish}-og.jpg`), twitterCard: "summary_large_image", schemaType: "BlogPosting", wordCount, readingMinutes, publishedAt: ts, createdAt: ts, updatedAt: ts });
    created++;
  }
  return created;
}
