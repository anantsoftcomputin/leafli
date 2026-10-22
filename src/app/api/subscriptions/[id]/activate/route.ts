import type { NextRequest } from "next/server";
import { MANAGERS, requireUser, route } from "@/lib/server/http";
import { activateSubscription } from "@/lib/server/subscriptions";

/** Manager confirms an offline (cash/UPI) payment and activates the plan. */
export const POST = route(async (req: NextRequest, ctx) => {
  await requireUser(req, MANAGERS);
  const { id } = await ctx.params;
  return activateSubscription(id!, null);
});
