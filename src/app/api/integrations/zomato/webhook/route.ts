import type { NextRequest } from "next/server";
import { onOrderLive } from "@/lib/server/notifications";
import { normalizeZomatoOrder, verifyZomatoSignature } from "@/lib/integrations/zomato";
import { HttpError, route, type Actor } from "@/lib/server/http";
import { col } from "@/lib/server/inventory";
import { createOrder } from "@/lib/server/orders";
import { notifyNewOrder } from "@/lib/server/push";
import type { MenuItem } from "@/lib/types";

const SYSTEM: Actor = { uid: "system:zomato", role: "admin", name: "Zomato" };

/**
 * Inbound Zomato orders (direct partner integration or relay middleware).
 * Idempotent on the Zomato order id, so retries never create duplicates.
 */
export const POST = route(async (req: NextRequest) => {
  if (!process.env.ZOMATO_WEBHOOK_SECRET) throw new HttpError(503, "Zomato integration not configured");
  const raw = await req.text();
  if (!verifyZomatoSignature(raw, req.headers)) throw new HttpError(401, "Bad signature");
  const body = JSON.parse(raw) as Record<string, unknown>;
  await col.logs().add({ provider: "zomato", direction: "in", payload: body, at: Date.now() });

  const ext = normalizeZomatoOrder(body);
  const menuSnap = await col.menu().get();
  const menu = menuSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MenuItem, "id">) }));
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const unmapped: string[] = [];
  const lines = ext.lines.flatMap((l) => {
    const m =
      menu.find((x) => l.menuItemId && x.id === l.menuItemId) ??
      menu.find((x) => l.externalItemId && x.zomatoItemId === String(l.externalItemId)) ??
      menu.find((x) => norm(x.name) === norm(l.name));
    if (!m) {
      unmapped.push(l.name);
      return [];
    }
    return [{ menuItemId: m.id, qty: l.qty, unitPriceOverride: l.unitPrice || undefined }];
  });
  if (unmapped.length) {
    await col.logs().add({ provider: "zomato", direction: "in", error: `Unmapped items: ${unmapped.join(", ")}`, externalId: ext.externalId, at: Date.now() });
    throw new HttpError(422, `Unmapped Zomato items: ${unmapped.join(", ")} — set the Zomato item ID on the menu item`);
  }

  const order = await createOrder(
    {
      source: "zomato",
      externalId: ext.externalId,
      customer: ext.customer,
      lines,
      discount: ext.discount,
      paymentMode: "zomato",
      paymentStatus: "paid",
      deliveryProvider: ext.deliveryByAggregator ? "zomato" : "porter",
      notes: ext.notes,
      autoAccept: process.env.ZOMATO_AUTO_ACCEPT === "true",
    },
    SYSTEM,
  );
  if (!order.duplicate) {
    await notifyNewOrder(order);
    await onOrderLive(order.id);
  }
  return { ok: true, orderId: order.id, orderNo: order.orderNo, duplicate: order.duplicate };
});
