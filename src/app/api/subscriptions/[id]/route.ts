import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, route, STAFF } from "@/lib/server/http";
import { getMenuItemsServer } from "@/lib/server/content";
import { updateSubscription } from "@/lib/server/subscriptions";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pause") }),
  z.object({ type: z.literal("resume") }),
  z.object({ type: z.literal("skip"), date }),
  z.object({ type: z.literal("unskip"), date }),
  z.object({ type: z.literal("choose"), date, menuItemId: z.string().nullable() }),
  z.object({ type: z.literal("cancel") }),
]);

/** Pause / resume / skip a day / pick a bowl / cancel an unpaid plan. */
export const POST = route(async (req: NextRequest, ctx) => {
  const actor = await requireUser(req);
  const { id } = await ctx.params;
  const action = schema.parse(await req.json());
  return updateSubscription(id!, action, actor, STAFF.includes(actor.role), await getMenuItemsServer());
});
