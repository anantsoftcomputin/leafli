import type { NextRequest } from "next/server";
import { z } from "zod";
import { MANAGERS, requireUser, route } from "@/lib/server/http";
import { receivePurchaseOrder } from "@/lib/server/stockOps";

const schema = z.object({
  lines: z.array(z.object({ itemId: z.string(), qty: z.number().nonnegative(), unitCost: z.number().nonnegative() })).min(1),
});

export const POST = route(async (req: NextRequest, ctx) => {
  const actor = await requireUser(req, MANAGERS);
  const { id } = await ctx.params;
  const { lines } = schema.parse(await req.json());
  return receivePurchaseOrder(id!, lines, actor);
});
