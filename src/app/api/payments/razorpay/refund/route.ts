import type { NextRequest } from "next/server";
import { z } from "zod";
import { MANAGERS, requireUser, route } from "@/lib/server/http";
import { refund } from "@/lib/server/payments";

const schema = z.object({
  kind: z.enum(["order", "subscription"]),
  id: z.string().min(1),
  /** Rupees; omit for "everything not yet refunded". */
  amount: z.number().positive().optional(),
  reason: z.string().trim().min(3, "Add a reason").max(200),
});

/** Manager refunds all or part of an online payment. */
export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req, MANAGERS);
  const b = schema.parse(await req.json());
  return refund({ kind: b.kind, id: b.id }, b.amount ?? null, b.reason, actor);
});
