import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, route } from "@/lib/server/http";
import { getMenuItemsServer } from "@/lib/server/content";
import { ORDER_NOW_MAX, orderNowFromSubscription } from "@/lib/server/subscriptions";

const schema = z.object({
  requestId: z.string().regex(/^[\w-]{8,64}$/),
  lines: z.array(z.object({ menuItemId: z.string().min(1), qty: z.number().int().min(0).max(ORDER_NOW_MAX) })).min(1).max(10),
});

/** Subscriber orders bowls for delivery now, paid from their plan's bowl balance. */
export const POST = route(async (req: NextRequest, ctx) => {
  const actor = await requireUser(req);
  const { id } = await ctx.params;
  const { requestId, lines } = schema.parse(await req.json());
  return orderNowFromSubscription(id!, lines, requestId, actor, await getMenuItemsServer());
});
