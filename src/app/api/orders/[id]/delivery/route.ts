import type { NextRequest } from "next/server";
import { z } from "zod";
import { cancelDelivery, createDelivery, getDelivery, getQuote, orderStatusFromPorter } from "@/lib/integrations/porter";
import { HttpError, requireUser, route, STAFF } from "@/lib/server/http";
import { col } from "@/lib/server/inventory";
import { getSettings, setOrderStatus } from "@/lib/server/orders";
import type { Order } from "@/lib/types";

const schema = z.object({ action: z.enum(["quote", "book", "refresh", "cancel"]) });

/** Porter delivery actions for an order: quote → book → refresh/track → cancel. */
export const POST = route(async (req: NextRequest, ctx) => {
  const actor = await requireUser(req, STAFF);
  const { id } = await ctx.params;
  const { action } = schema.parse(await req.json());
  const ref = col.orders().doc(id!);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Order not found");
  const order = { id: snap.id, ...(snap.data() as Omit<Order, "id">) };
  const settings = await getSettings();
  const drop = order.customer.address;

  if (action === "quote") {
    if (!drop) throw new HttpError(400, "Order has no delivery address");
    return { quotes: await getQuote(settings, drop, order.customer) };
  }

  if (action === "book") {
    if (!drop) throw new HttpError(400, "Order has no delivery address");
    if (order.delivery?.porterOrderId && order.delivery.status !== "cancelled")
      throw new HttpError(409, "A Porter delivery is already booked for this order");
    if (order.status === "cancelled" || order.status === "delivered") throw new HttpError(409, `Order is ${order.status}`);
    const booking = await createDelivery({
      requestId: `${order.orderNo}-${Date.now().toString(36)}`,
      kitchen: settings,
      drop,
      customer: order.customer,
      instructions: order.notes,
    });
    const delivery = { ...order.delivery, provider: "porter" as const, ...booking, status: "open", updatedAt: Date.now() };
    await ref.update({ delivery, updatedAt: Date.now() });
    await col.logs().add({ provider: "porter", direction: "out", orderId: order.id, action, response: booking, at: Date.now() });
    return { delivery };
  }

  if (!order.delivery?.porterOrderId) throw new HttpError(400, "No Porter delivery on this order");

  if (action === "cancel") {
    await cancelDelivery(order.delivery.porterOrderId);
    await ref.update({ "delivery.status": "cancelled", "delivery.updatedAt": Date.now() });
    return { ok: true };
  }

  const s = await getDelivery(order.delivery.porterOrderId);
  await ref.update({
    "delivery.status": s.status,
    ...(s.partnerName ? { "delivery.partnerName": s.partnerName } : {}),
    ...(s.partnerPhone ? { "delivery.partnerPhone": s.partnerPhone } : {}),
    ...(s.vehicle ? { "delivery.vehicle": s.vehicle } : {}),
    ...(s.fare != null ? { "delivery.fare": s.fare } : {}),
    ...(s.trackingUrl ? { "delivery.trackingUrl": s.trackingUrl } : {}),
    "delivery.updatedAt": Date.now(),
  });
  const next = orderStatusFromPorter(s.status);
  if (next && order.status !== next && order.status !== "delivered" && order.status !== "cancelled") {
    await setOrderStatus(order.id, next, actor).catch(() => undefined);
  }
  return { status: s };
});
