import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, route, STAFF } from "@/lib/server/http";
import { produceBatch } from "@/lib/server/stockOps";

const schema = z.object({
  itemId: z.string(),
  batches: z.number().positive().max(100),
  actualYield: z.number().positive().optional(),
  adoptYield: z.boolean().optional(),
  note: z.string().max(300).optional(),
});

export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req, STAFF);
  return produceBatch(schema.parse(await req.json()), actor);
});
