import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { HttpError, requireUser, route } from "@/lib/server/http";

const schema = z.object({ uid: z.string(), role: z.enum(["admin", "manager", "kitchen", "cashier", "customer"]) });

export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req, ["admin"]);
  const { uid, role } = schema.parse(await req.json());
  if (uid === actor.uid && role !== "admin") throw new HttpError(400, "You cannot remove your own admin access");
  const ref = adminDb.collection("users").doc(uid);
  if (!(await ref.get()).exists) throw new HttpError(404, "User not found — they must sign in once first");
  await ref.update({ role });
  return { ok: true };
});
