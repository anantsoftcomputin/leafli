import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser, route, STAFF } from "@/lib/server/http";
import { refreshPublic } from "@/lib/server/revalidate";

/** Called after menu/settings edits made directly from the admin, so the public site updates now. */
export const POST = route(async (req: NextRequest) => {
  await requireUser(req, STAFF);
  const { kind } = z.object({ kind: z.enum(["menu", "settings", "plans", "posts", "testimonials"]) }).parse(await req.json());
  refreshPublic(kind, kind === "menu" ? ["/menu"] : []);
  return { ok: true };
});
