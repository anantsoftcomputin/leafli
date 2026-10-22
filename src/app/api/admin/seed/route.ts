import type { NextRequest } from "next/server";
import { requireUser, route } from "@/lib/server/http";
import { seedAll } from "@/lib/server/seed";

/** Settings → "Load SOP data". ?overwrite=1 resets menu/recipes to the SOP versions (stock is kept). */
export const POST = route(async (req: NextRequest) => {
  await requireUser(req, ["admin"]);
  return seedAll({ overwrite: req.nextUrl.searchParams.get("overwrite") === "1" });
});
