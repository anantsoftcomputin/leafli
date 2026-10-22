import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { orderStatusFromPorter, parseStatus } from "@/lib/integrations/porter";
import { HttpError, route, type Actor } from "@/lib/server/http";
import { col } from "@/lib/server/inventory";
import { setOrderStatus } from "@/lib/server/orders";

const SYSTEM: Actor = { uid: "system:porter", role: "admin", name: "Porter" };

/**
 * Porter delivery status callbacks. Register this URL with Porter as
 *   https://<your-domain>/api/integrations/porter/webhook?token=<PORTER_WEBHOOK_SECRET>
 */
export const POST = route(async (req: NextRequest) => {
  const secret = process.env.PORTER_WEBHOOK_SECRET;
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!secret || token.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret)))
    throw new HttpError(401, "Bad token");

  const body = (await req.json()) as Record<string, unknown>;
  await col.logs().add({ provider: "porter", direction: "in", payload: body, at: Date.now() });
  const porterOrderId = String(body.order_id ?? (body.data as Record<string, unknown> | undefined)?.order_id ?? "");
  if (!porterOrderId) throw new HttpError(400, "No order_id");

  const q = await col.orders().where("delivery.porterOrderId", "==", porterOrderId).limit(1).get();
  if (q.empty) return { ok: true, ignored: "unknown order" };
  const doc = q.docs[0]!;
  const s = parseStatus(body);
  await doc.ref.update({
    "delivery.status": s.status,
    ...(s.partnerName ? { "delivery.partnerName": s.partnerName } : {}),
    ...(s.partnerPhone ? { "delivery.partnerPhone": s.partnerPhone } : {}),
    ...(s.fare != null ? { "delivery.fare": s.fare } : {}),
    ...(s.trackingUrl ? { "delivery.trackingUrl": s.trackingUrl } : {}),
    "delivery.updatedAt": Date.now(),
  });
  const next = orderStatusFromPorter(s.status);
  const cur = doc.get("status") as string;
  if (next && cur !== next && cur !== "delivered" && cur !== "cancelled") {
    // Walk through intermediate states (e.g. ready → dispatched → delivered).
    if (next === "delivered" && cur === "ready") await setOrderStatus(doc.id, "dispatched", SYSTEM).catch(() => undefined);
    await setOrderStatus(doc.id, next, SYSTEM).catch(() => undefined);
  }
  return { ok: true };
});
