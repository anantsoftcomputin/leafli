import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, route, STAFF } from "@/lib/server/http";
import { getMenuItemsServer } from "@/lib/server/content";
import { generateSubscriptionOrders } from "@/lib/server/subscriptions";
import { istDate } from "@/lib/site";

/** Create kitchen orders for a day's subscription deliveries (idempotent). */
export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req, STAFF);
  const { date } = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(await req.json().catch(() => ({})));
  return generateSubscriptionOrders(date ?? istDate(), actor, await getMenuItemsServer());
});
