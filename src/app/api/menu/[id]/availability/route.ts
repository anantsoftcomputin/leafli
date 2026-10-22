import type { NextRequest } from "next/server";
import { z } from "zod";
import { pushZomatoItemStock } from "@/lib/integrations/zomato";
import { HttpError, requireUser, route, STAFF } from "@/lib/server/http";
import { col } from "@/lib/server/inventory";
import { refreshPublic } from "@/lib/server/revalidate";

/** Toggle a dish in/out of stock everywhere, including Zomato when integrated. */
export const POST = route(async (req: NextRequest, ctx) => {
  await requireUser(req, STAFF);
  const { id } = await ctx.params;
  const { available } = z.object({ available: z.boolean() }).parse(await req.json());
  const ref = col.menu().doc(id!);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Menu item not found");
  await ref.update({ available });
  refreshPublic("menu", ["/menu"]);
  const zid = snap.get("zomatoItemId") as string | undefined;
  let zomato: unknown = { skipped: true };
  if (zid) {
    try {
      zomato = await pushZomatoItemStock([zid], available);
    } catch (e) {
      zomato = { error: String(e) };
    }
  }
  return { ok: true, zomato };
});
