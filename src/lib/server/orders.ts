import "server-only";
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { computeBill, DEFAULT_SETTINGS } from "@/lib/billing";
import { requirementsFor, round2 } from "@/lib/costing";
import type {
  Address,
  BusinessSettings,
  Channel,
  DeliveryInfo,
  MenuItem,
  Order,
  OrderLine,
  OrderStatus,
} from "@/lib/types";
import { pushZomatoStatus } from "@/lib/integrations/zomato";
import { cancelPaymentLink, refundPayment } from "@/lib/integrations/razorpay";
import { notifyNewOrder, notifyOrderStatus } from "./push";
import { onOrderLive, onOrderStatus, onStaffIssue } from "./notifications";
import { awaitingPayment } from "@/lib/types";
import { HttpError, type Actor } from "./http";
import { kitchenStatus } from "@/lib/hours";
import { col, financialYear, istDateKey, nextCounter, StockTx } from "./inventory";

export async function getSettings(tx?: Transaction): Promise<BusinessSettings> {
  const snap = tx ? await tx.get(col.settings()) : await col.settings().get();
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<BusinessSettings> | undefined) };
}

export interface CreateOrderInput {
  source: Channel;
  externalId?: string | null;
  customerUid?: string | null;
  customer: { name: string; phone?: string; email?: string; address?: Address | null };
  lines: { menuItemId: string; qty: number; notes?: string; unitPriceOverride?: number }[];
  discount?: number;
  paymentMode: Order["paymentMode"];
  paymentStatus?: Order["paymentStatus"];
  deliveryProvider: DeliveryInfo["provider"];
  deliveryCharge?: number;
  notes?: string;
  /** POS orders are accepted (and stock deducted) immediately. */
  autoAccept?: boolean;
  /** Prepaid meal generated from a subscription. */
  prepaid?: { subscriptionId: string; unitPrice: number };
  notify?: { whatsapp: boolean };
}

/** Consumption recorded on the order so a cancellation can be reversed exactly. */
interface Consumption {
  itemId: string;
  qty: number;
  unitCost: number;
  allocations: { batchId: string; qty: number }[];
}

function deduct(stx: StockTx, orderId: string, orderNo: string, req: Map<string, number>) {
  const consumption: Consumption[] = [];
  let cost = 0;
  for (const [itemId, qty] of req) {
    const { unitCost, allocations } = stx.consume(itemId, qty, "sale", {
      refType: "order",
      refId: orderId,
      note: orderNo,
    });
    consumption.push({ itemId, qty, unitCost, allocations });
    cost += unitCost * qty;
  }
  return { consumption, cost: round2(cost) };
}

export async function createOrder(input: CreateOrderInput, actor: Actor) {
  if (!input.lines.length) throw new HttpError(400, "Order has no items");
  const db = col.orders().firestore;

  return db.runTransaction(async (tx) => {
    // ---------- reads
    const settings = await getSettings(tx);
    const orderRef = input.externalId
      ? col.orders().doc(`${input.source}_${input.externalId}`.replace(/[^\w-]/g, "_"))
      : col.orders().doc();
    if (input.externalId) {
      const existing = await tx.get(orderRef);
      if (existing.exists) return { id: orderRef.id, duplicate: true, ...(existing.data() as Omit<Order, "id">) };
    }
    if (!settings.acceptingOrders && input.source !== "pos" && !input.prepaid)
      throw new HttpError(409, kitchenStatus(settings).message);
    // Website orders only inside ordering hours (Zomato enforces its own hours; staff can always bill).
    if (input.source === "website" && !input.prepaid) {
      const k = kitchenStatus(settings);
      if (!k.open) throw new HttpError(409, k.message);
    }

    const menuIds = [...new Set(input.lines.map((l) => l.menuItemId))];
    const menuSnaps = await tx.getAll(...menuIds.map((id) => col.menu().doc(id)));
    const menu = new Map<string, MenuItem>();
    for (const s of menuSnaps) {
      if (!s.exists) throw new HttpError(400, `Menu item ${s.id} not found`);
      menu.set(s.id, { id: s.id, ...(s.data() as Omit<MenuItem, "id">) });
    }
    for (const l of input.lines) {
      const m = menu.get(l.menuItemId)!;
      if (input.source !== "zomato" && (!m.available || !m.channels?.[input.source]))
        throw new HttpError(409, `${m.name} is not available right now`);
      if (!(l.qty > 0 && Number.isInteger(l.qty))) throw new HttpError(400, "Quantities must be whole numbers");
    }

    const isAggregator = input.source === "zomato";
    const dateKey = istDateKey();
    const orderCounter = await nextCounter(tx, `order-${dateKey}`);
    // Subscription meals were invoiced when the plan was bought — no second tax invoice.
    const invoiceCounter = isAggregator || input.prepaid ? null : await nextCounter(tx, `invoice-${financialYear()}`);

    const req = requirementsFor(input.lines, menu);
    const stx = new StockTx(tx, actor);
    await stx.load(req.keys());

    // ---------- compute
    const lines: OrderLine[] = input.lines.map((l) => {
      const m = menu.get(l.menuItemId)!;
      // Server-side price. Aggregator orders carry the price the customer paid on Zomato.
      const unitPrice = input.prepaid
        ? input.prepaid.unitPrice
        : isAggregator && l.unitPriceOverride != null
          ? l.unitPriceOverride
          : (m.channelPrice?.[input.source] ?? m.price);
      const unitCost = round2(
        m.recipe.reduce((s, r) => s + r.qty * stx.costOf(r.itemId), 0) + (m.packagingCost || 0),
      );
      return {
        menuItemId: m.id,
        name: m.name,
        qty: l.qty,
        unitPrice,
        lineTotal: round2(unitPrice * l.qty),
        unitCost,
        ...(l.notes ? { notes: l.notes } : {}),
      };
    });

    const bill = computeBill(
      {
        source: input.source,
        lines,
        discount: input.discount,
        delivery: input.deliveryProvider === "porter" || input.deliveryProvider === "self",
        deliveryCharge: input.deliveryCharge,
        prepaid: !!input.prepaid,
      },
      settings,
    );

    const now = Date.now();
    const orderNo = `LF-${dateKey}-${String(orderCounter.value).padStart(3, "0")}`;
    const invoiceNo = invoiceCounter
      ? `LF/${financialYear()}/${String(invoiceCounter.value).padStart(5, "0")}`
      : undefined;
    const status: OrderStatus = input.autoAccept ? "accepted" : "new";

    let consumption: Consumption[] = [];
    let foodCost = round2(lines.reduce((s, l) => s + l.unitCost * l.qty, 0));
    if (input.autoAccept) {
      const d = deduct(stx, orderRef.id, orderNo, req);
      consumption = d.consumption;
      foodCost = round2(d.cost + lines.reduce((s, l) => s + (menu.get(l.menuItemId)!.packagingCost || 0) * l.qty, 0));
    }

    const order: Omit<Order, "id"> & { consumption: Consumption[]; dateKey: string } = {
      orderNo,
      ...(invoiceNo ? { invoiceNo } : {}),
      source: input.source,
      externalId: input.externalId ?? null,
      customerUid: input.customerUid ?? null,
      customer: input.customer,
      lines,
      ...bill,
      foodCost,
      paymentMode: input.paymentMode,
      // Online orders are only "paid" once Razorpay confirms (markOrderPaid); never trust the client.
      paymentStatus:
        input.paymentMode === "online" || input.paymentMode === "pay_later" ? "pending" : (input.paymentStatus ?? "paid"),
      status,
      statusHistory: [
        { status: "new", at: now, by: actor.uid },
        ...(status === "accepted" ? [{ status: "accepted" as const, at: now, by: actor.uid }] : []),
      ],
      stockDeducted: Boolean(input.autoAccept),
      ...(input.prepaid ? { subscriptionId: input.prepaid.subscriptionId } : {}),
      consumption,
      delivery: { provider: input.deliveryProvider },
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.notify ? { notify: input.notify } : {}),
      dateKey,
      createdAt: now,
      updatedAt: now,
    };

    // ---------- writes
    tx.set(orderCounter.ref, { value: orderCounter.value }, { merge: true });
    if (invoiceCounter) tx.set(invoiceCounter.ref, { value: invoiceCounter.value }, { merge: true });
    tx.set(orderRef, order);
    stx.commit();
    return { id: orderRef.id, duplicate: false, ...order };
  });
}

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  new: ["accepted", "cancelled"],
  accepted: ["preparing", "ready", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["dispatched", "delivered", "cancelled"],
  dispatched: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export async function setOrderStatus(orderId: string, to: OrderStatus, actor: Actor, reason?: string) {
  const db = col.orders().firestore;
  const result = await db.runTransaction(async (tx) => {
    const ref = col.orders().doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "Order not found");
    const order = { id: snap.id, ...(snap.data() as Omit<Order, "id"> & { consumption?: Consumption[] }) };
    if (order.status === to) return order;
    if (!NEXT[order.status].includes(to))
      throw new HttpError(409, `Cannot move an order from ${order.status} to ${to}`);
    if (to !== "cancelled" && awaitingPayment(order))
      throw new HttpError(409, "This order hasn't been paid yet — wait for the online payment to complete");

    const stx = new StockTx(tx, actor);
    const update: Record<string, unknown> = {};

    if (!order.stockDeducted && to !== "cancelled") {
      // First move past "new": deduct stock now.
      const menuIds = [...new Set(order.lines.map((l) => l.menuItemId))];
      const menuSnaps = await tx.getAll(...menuIds.map((id) => col.menu().doc(id)));
      const menu = new Map(menuSnaps.map((s) => [s.id, { id: s.id, ...(s.data() as Omit<MenuItem, "id">) }]));
      const req = requirementsFor(order.lines, menu);
      await stx.load(req.keys());
      const d = deduct(stx, order.id, order.orderNo, req);
      const packaging = order.lines.reduce((s, l) => s + (menu.get(l.menuItemId)?.packagingCost || 0) * l.qty, 0);
      Object.assign(update, { stockDeducted: true, consumption: d.consumption, foodCost: round2(d.cost + packaging) });
    } else if (order.stockDeducted && to === "cancelled" && order.status === "accepted") {
      // Cancelled before the kitchen started: put ingredients back.
      const cons = order.consumption ?? [];
      await stx.load(cons.map((c) => c.itemId));
      await stx.loadBatchesForRestore(cons.flatMap((c) => c.allocations.map((a) => a.batchId)));
      for (const c of cons)
        stx.restore(c.itemId, c.qty, c.unitCost, c.allocations, { refType: "order", refId: order.id, note: `${order.orderNo} cancelled` });
      Object.assign(update, { stockDeducted: false, consumption: [] });
    }

    const now = Date.now();
    tx.update(ref, {
      ...update,
      status: to,
      updatedAt: now,
      statusHistory: [...order.statusHistory, { status: to, at: now, by: actor.uid }],
      ...(to === "cancelled" && reason ? { cancelReason: reason } : {}),
      ...(to === "cancelled" && order.paymentStatus === "paid" && order.source !== "zomato"
        ? { paymentStatus: "refunded" }
        : {}),
    });
    stx.commit();
    return { ...order, ...update, status: to };
  });

  // Paid online and now cancelled: refund whatever hasn't been refunded yet through Razorpay.
  const o = result as Order;
  const pay = o.payment;
  const due = round2(o.total - (pay?.refundedAmount ?? 0));
  if (to === "cancelled" && pay?.paymentId && due > 0 && pay.refundStatus !== "pending") {
    try {
      const refund = await refundPayment(pay.paymentId, due, { leafliOrder: o.orderNo, reason: reason || "Order cancelled" });
      await col.orders().doc(orderId).update({
        "payment.refundId": refund.id,
        "payment.refundStatus": refund.status === "processed" ? "processed" : "pending",
        "payment.refundedAmount": round2((pay.refundedAmount ?? 0) + refund.amount / 100),
        "payment.refundError": FieldValue.delete(),
        paymentStatus: "refunded",
      });
    } catch (e) {
      await col.orders().doc(orderId).update({ "payment.refundError": String((e as Error).message) });
      await col.logs().add({ provider: "razorpay", direction: "out", orderId, error: String(e), at: Date.now() });
      await onStaffIssue({ key: `refund-${orderId}`, title: `Refund failed for ${o.orderNo}`, detail: `Cancelled order ${o.orderNo} (${o.customer.name}) could not be refunded automatically: ${(e as Error).message}. Retry from the order page or refund from the Razorpay dashboard.`, url: `/admin/orders/${orderId}` });
    }
  }
  // An unpaid payment link must not stay payable once the order is gone.
  if (to === "cancelled" && o.paymentLink && o.paymentStatus === "pending")
    await cancelPaymentLink(o.paymentLink.id).catch(() => {});

  // Tell the customer (if they ordered online) — failures never break the status change.
  if (result.status === to) {
    await notifyOrderStatus(result as Order, to);
    await onOrderStatus(orderId, to);
  }

  if (result.source === "zomato" && result.externalId) {
    try {
      await pushZomatoStatus(result.externalId, to, reason);
    } catch (e) {
      await col.logs().add({ provider: "zomato", direction: "out", orderId, error: String(e), at: Date.now() });
    }
  }
  return result;
}

/**
 * Mark an order as paid (idempotent; called by the verify route, the webhook and reconciliation).
 * `viaLink` payments come from a staff-sent payment link, so the Razorpay order is new to us.
 * Returns `stray` when the money can't be kept (order already paid by another payment, or
 * cancelled) — the caller refunds it.
 */
export async function markOrderPaid(
  orderId: string,
  rzpOrderId: string,
  paymentId: string,
  opts: { method?: string; viaLink?: boolean } = {},
) {
  const ref = col.orders().doc(orderId);
  return ref.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "Order not found");
    const o = snap.data() as Order;
    if (!opts.viaLink && o.payment?.rzpOrderId !== rzpOrderId) throw new HttpError(400, "Payment does not belong to this order");
    if (o.payment?.paymentId === paymentId) return { alreadyPaid: true, stray: false };
    if (o.paymentStatus !== "pending" || o.status === "cancelled") return { alreadyPaid: true, stray: true };
    const now = Date.now();
    tx.update(ref, {
      paymentStatus: "paid",
      ...(opts.viaLink
        ? { paymentMode: "online", payment: { provider: "razorpay", rzpOrderId, paymentId, paidAt: now, ...(opts.method ? { method: opts.method } : {}) } }
        : { "payment.paymentId": paymentId, "payment.paidAt": now, ...(opts.method ? { "payment.method": opts.method } : {}) }),
      updatedAt: now,
    });
    return { alreadyPaid: false, stray: false, order: { ...o, id: orderId } };
  }).then(async (r) => {
    // A paid online order is the moment it becomes real for the kitchen (link payments were already live).
    if (!r.alreadyPaid && "order" in r && r.order && !opts.viaLink) {
      await notifyNewOrder(r.order);
      await onOrderLive(orderId);
    }
    return { alreadyPaid: r.alreadyPaid, stray: r.stray };
  });
}
