import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, route } from "@/lib/server/http";
import { removeSubscription, saveSubscription } from "@/lib/server/push";

const sub = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) });

/** Save this device's push subscription, linked to the signed-in user and their role. */
export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req);
  const { subscription } = z.object({ subscription: sub }).parse(await req.json());
  await saveSubscription(subscription, actor.uid, actor.role, req.headers.get("user-agent") ?? undefined);
  return { ok: true };
});

export const DELETE = route(async (req: NextRequest) => {
  await requireUser(req);
  const { endpoint } = z.object({ endpoint: z.string().url() }).parse(await req.json());
  await removeSubscription(endpoint);
  return { ok: true };
});
