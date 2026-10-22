import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, route, STAFF } from "@/lib/server/http";
import { closeBatch } from "@/lib/server/stockOps";

const schema = z.object({ status: z.enum(["expired", "discarded"]), reason: z.string().min(2).max(300) });

export const POST = route(async (req: NextRequest, ctx) => {
  const actor = await requireUser(req, STAFF);
  const { id } = await ctx.params;
  const { status, reason } = schema.parse(await req.json());
  return closeBatch(id!, status, reason, actor);
});
