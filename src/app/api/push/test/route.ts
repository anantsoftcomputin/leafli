import type { NextRequest } from "next/server";
import { HttpError, requireUser, route } from "@/lib/server/http";
import { notifyUser, pushConfigured } from "@/lib/server/push";

/** Sends a test notification to every device of the signed-in user. */
export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req);
  if (!pushConfigured()) throw new HttpError(503, "Push isn't configured on the server (VAPID keys)");
  const r = await notifyUser(actor.uid, { title: "Notifications are on 🎉", body: "This is how Leafli updates will look on this device.", url: "/account", tag: "test" });
  if (!r.sent) throw new HttpError(404, "No devices found — turn notifications on first");
  return r;
});
