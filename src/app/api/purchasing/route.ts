import type { NextRequest } from "next/server";
import { z } from "zod";
import { MANAGERS, requireUser, route } from "@/lib/server/http";
import { createPurchaseOrder } from "@/lib/server/stockOps";

const schema = z.object({
  supplierId: z.string(),
  lines: z.array(z.object({ itemId: z.string(), qty: z.number().positive(), unitCost: z.number().nonnegative() })).min(1),
  expectedAt: z.number().optional().nullable(),
  notes: z.string().max(500).optional(),
  status: z.enum(["draft", "sent"]).optional(),
});

export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req, MANAGERS);
  return createPurchaseOrder(schema.parse(await req.json()), actor);
});
