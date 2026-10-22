import type { NextRequest } from "next/server";
import { z } from "zod";
import { MANAGERS, requireUser, route } from "@/lib/server/http";
import { stockCount } from "@/lib/server/stockOps";

const schema = z.object({
  counts: z.array(z.object({ itemId: z.string(), counted: z.number().nonnegative() })).min(1),
  note: z.string().max(300).optional(),
});

/** Record a physical stock count for one or more items. */
export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req, MANAGERS);
  const { counts, note } = schema.parse(await req.json());
  const results = [];
  for (const c of counts) results.push({ itemId: c.itemId, ...(await stockCount(c.itemId, c.counted, note ?? "Stock count", actor)) });
  return { results };
});
