import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, route, STAFF } from "@/lib/server/http";
import { setOrderStatus } from "@/lib/server/orders";

const schema = z.object({
  status: z.enum(["accepted", "preparing", "ready", "dispatched", "delivered", "cancelled"]),
  reason: z.string().max(300).optional(),
});

export const POST = route(async (req: NextRequest, ctx) => {
  const actor = await requireUser(req, STAFF);
  const { id } = await ctx.params;
  const { status, reason } = schema.parse(await req.json());
  const order = await setOrderStatus(id!, status, actor, reason);
  return { id: order.id, status: order.status };
});
