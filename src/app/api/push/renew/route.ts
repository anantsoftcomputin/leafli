import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { route } from "@/lib/server/http";
import { saveSubscription, subId } from "@/lib/server/push";

/**
 * Called by the service worker when the browser rotates a push subscription.
 * Carries over the owner of the old subscription (no session is available there).
 */
export const POST = route(async (req: NextRequest) => {
  const b = z
    .object({ oldEndpoint: z.string().url().optional(), subscription: z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }) })
    .parse(await req.json());
  if (!b.oldEndpoint) return { ok: false };
  const old = await adminDb.collection("pushSubscriptions").doc(subId(b.oldEndpoint)).get();
  if (!old.exists) return { ok: false };
  await saveSubscription(b.subscription, old.get("uid"), old.get("role"));
  await old.ref.delete();
  return { ok: true };
});
