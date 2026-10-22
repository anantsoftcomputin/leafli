import type { NextRequest } from "next/server";
import { MANAGERS, requireUser, route } from "@/lib/server/http";
import { recostPreps } from "@/lib/server/stockOps";

export const POST = route(async (req: NextRequest) => {
  await requireUser(req, MANAGERS);
  return recostPreps();
});
