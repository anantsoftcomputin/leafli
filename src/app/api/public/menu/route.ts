import type { NextRequest } from "next/server";
import { col } from "@/lib/server/inventory";
import { getSettings } from "@/lib/server/orders";
import { razorpayConfigured, razorpayKeyId } from "@/lib/integrations/razorpay";
import { preflight, withCors } from "@/lib/server/cors";
import { route } from "@/lib/server/http";
import type { MenuItem } from "@/lib/types";

export const OPTIONS = preflight;

/** Public, cache-friendly menu for the leafli.in storefront (no costs or recipes). */
export const GET = route(async (req: NextRequest) => {
  const [snap, settings] = await Promise.all([col.menu().where("channels.website", "==", true).get(), getSettings()]);
  const items = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<MenuItem, "id">) }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      category: m.category,
      price: m.channelPrice?.website ?? m.price,
      imageUrl: m.imageUrl ?? null,
      photoUrl: m.photoUrl ?? null,
      available: m.available,
      diet: m.diet,
      allergens: m.allergens,
      nutrition: m.nutrition ?? null,
    }));
  const res = Response.json({
    acceptingOrders: settings.acceptingOrders,
    // Razorpay key id is public by design (it's embedded in Checkout); the secret never leaves the server.
    razorpayKeyId: razorpayConfigured() ? razorpayKeyId() : null,
    gstRate: settings.gstRate,
    packagingChargePerOrder: settings.packagingChargePerOrder,
    deliveryCharge: settings.defaultDeliveryCharge,
    items,
  }, { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=120" } });
  return withCors(req, res);
});
