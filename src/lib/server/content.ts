import "server-only";
import { unstable_cache } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { razorpayConfigured, razorpayKeyId } from "@/lib/integrations/razorpay";
import type { BusinessSettings, MenuItem, Plan, Post, Testimonial } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/billing";

// Cache tags let admin edits refresh public pages immediately (revalidateTag).
export const TAGS = { menu: "menu", plans: "plans", posts: "posts", testimonials: "testimonials", settings: "settings" } as const;
const REVALIDATE = 300; // seconds — safety net if a tag isn't revalidated

export interface PublicDish {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  price: number;
  imageUrl: string | null;
  photoUrl: string | null;
  ogImageUrl: string | null;
  available: boolean;
  diet: MenuItem["diet"];
  allergens: string[];
  nutrition: MenuItem["nutrition"] | null;
  ingredients: string[];
}

export interface PublicMenu {
  acceptingOrders: boolean;
  razorpayKeyId: string | null;
  gstRate: number;
  packagingChargePerOrder: number;
  deliveryCharge: number;
  items: PublicDish[];
}

export type PublicSettings = Pick<BusinessSettings, "name" | "legalName" | "gstin" | "fssai" | "phone" | "email" | "address" | "acceptingOrders" | "googleReviewUrl" | "zomatoUrl">;

export const getSettingsCached = unstable_cache(
  async (): Promise<BusinessSettings> => {
    const s = await adminDb.collection("settings").doc("business").get();
    return { ...DEFAULT_SETTINGS, ...(s.data() as Partial<BusinessSettings> | undefined) };
  },
  ["settings"],
  { tags: [TAGS.settings], revalidate: REVALIDATE },
);

export async function getPublicSettings(): Promise<PublicSettings> {
  const s = await getSettingsCached();
  return { name: s.name, legalName: s.legalName, gstin: s.gstin, fssai: s.fssai, phone: s.phone, email: s.email, address: s.address, acceptingOrders: s.acceptingOrders, googleReviewUrl: s.googleReviewUrl, zomatoUrl: s.zomatoUrl };
}

const toDish = (id: string, m: Omit<MenuItem, "id">): PublicDish => ({
  id,
  slug: m.slug || id,
  name: m.name,
  description: m.description,
  category: m.category,
  price: m.channelPrice?.website ?? m.price,
  imageUrl: m.imageUrl ?? null,
  photoUrl: m.photoUrl ?? null,
  ogImageUrl: m.ogImageUrl ?? null,
  available: m.available,
  diet: m.diet,
  allergens: m.allergens ?? [],
  nutrition: m.nutrition ?? null,
  ingredients: m.ingredients ?? [],
});

const getMenuRaw = unstable_cache(
  async () => {
    const snap = await adminDb.collection("menuItems").where("channels.website", "==", true).get();
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<MenuItem, "id">) }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
  ["menu-raw"],
  { tags: [TAGS.menu], revalidate: REVALIDATE },
);

/** Full menu docs (server-only; includes recipes) — for subscription rotation. */
export const getMenuItemsServer = getMenuRaw;

export async function getPublicMenu(): Promise<PublicMenu> {
  const [items, s] = await Promise.all([getMenuRaw(), getSettingsCached()]);
  return {
    acceptingOrders: s.acceptingOrders,
    razorpayKeyId: razorpayConfigured() ? razorpayKeyId() : null,
    gstRate: s.gstRate,
    packagingChargePerOrder: s.packagingChargePerOrder,
    deliveryCharge: s.defaultDeliveryCharge,
    items: items.map((m) => toDish(m.id, m)),
  };
}

export async function getDishBySlug(slug: string) {
  const menu = await getPublicMenu();
  return menu.items.find((d) => d.slug === slug) ?? null;
}

export const getPlans = unstable_cache(
  async (): Promise<Plan[]> => {
    const snap = await adminDb.collection("plans").where("active", "==", true).get();
    return snap.docs.map((d) => ({ ...(d.data() as Plan), id: d.id })).sort((a, b) => a.sortOrder - b.sortOrder);
  },
  ["plans"],
  { tags: [TAGS.plans], revalidate: REVALIDATE },
);

export async function getPlanBySlug(slug: string) {
  return (await getPlans()).find((p) => p.slug === slug) ?? null;
}

/** Published posts (scheduled posts appear once their publish time passes). */
export const getPublishedPosts = unstable_cache(
  async (): Promise<Post[]> => {
    const snap = await adminDb.collection("posts").where("status", "in", ["published", "scheduled"]).get();
    const now = Date.now();
    return snap.docs
      .map((d) => ({ ...(d.data() as Post), id: d.id }))
      .filter((p) => (p.publishedAt ?? 0) <= now)
      .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  },
  ["posts"],
  { tags: [TAGS.posts], revalidate: 60 },
);

export async function getPostBySlug(slug: string) {
  return (await getPublishedPosts()).find((p) => p.slug === slug) ?? null;
}

export const getTestimonials = unstable_cache(
  async (): Promise<Testimonial[]> => {
    const snap = await adminDb.collection("testimonials").where("published", "==", true).get();
    return snap.docs.map((d) => ({ ...(d.data() as Testimonial), id: d.id })).sort((a, b) => a.sortOrder - b.sortOrder);
  },
  ["testimonials"],
  { tags: [TAGS.testimonials], revalidate: REVALIDATE },
);

export const categorySlug = (c: string) => c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
