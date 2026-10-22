import type { NextRequest } from "next/server";
import { MANAGERS, requireUser, route } from "@/lib/server/http";
import { generateReorderPOs } from "@/lib/server/stockOps";

export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req, MANAGERS);
  return generateReorderPOs(actor);
});
