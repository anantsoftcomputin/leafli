import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, route, STAFF } from "@/lib/server/http";
import { recordWastage } from "@/lib/server/stockOps";

const schema = z.object({ itemId: z.string(), qty: z.number().positive(), reason: z.string().min(2).max(300) });

export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req, STAFF);
  const { itemId, qty, reason } = schema.parse(await req.json());
  return recordWastage(itemId, qty, reason, actor);
});
