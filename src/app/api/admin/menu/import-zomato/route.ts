import type { NextRequest } from "next/server";
import { z } from "zod";
import { MANAGERS, requireUser, route } from "@/lib/server/http";
import { importZomatoCatalog } from "@/lib/server/zomato-catalog";
import { refreshPublic } from "@/lib/server/revalidate";
export const POST = route(async (req: NextRequest) => {
  await requireUser(req, MANAGERS);
  const { apply } = z.object({ apply: z.boolean().default(false) }).parse(await req.json());
  const result = await importZomatoCatalog(apply);
  if (apply) refreshPublic("menu", ["/", "/menu"]);
  return result;
});
