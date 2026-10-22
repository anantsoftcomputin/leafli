import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, MANAGERS, requireUser, route } from "@/lib/server/http";
import { col } from "@/lib/server/inventory";
import { round2 } from "@/lib/costing";

const schema = z.object({
  status: z.enum(["draft", "sent", "cancelled"]).optional(),
  lines: z.array(z.object({ itemId: z.string(), itemName: z.string(), qty: z.number().positive(), unitCost: z.number().nonnegative() })).optional(),
  expectedAt: z.number().nullable().optional(),
  notes: z.string().max(500).optional(),
});

/** Edit a draft PO, mark it sent, or cancel it. */
export const PATCH = route(async (req: NextRequest, ctx) => {
  await requireUser(req, MANAGERS);
  const { id } = await ctx.params;
  const body = schema.parse(await req.json());
  const ref = col.pos().doc(id!);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Purchase order not found");
  const status = snap.get("status") as string;
  if (status === "received" || status === "cancelled") throw new HttpError(409, `PO is already ${status}`);
  if (body.lines && status !== "draft") throw new HttpError(409, "Only draft POs can be edited");
  await ref.update({
    ...body,
    ...(body.lines ? { total: round2(body.lines.reduce((s, l) => s + l.qty * l.unitCost, 0)) } : {}),
    updatedAt: Date.now(),
  });
  return { ok: true };
});
