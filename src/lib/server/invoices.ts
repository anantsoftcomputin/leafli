import "server-only";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { computeBill } from "@/lib/billing";
import { round2 } from "@/lib/costing";
import { buildInvoiceRecord, type InvoiceKind } from "@/lib/invoice-record";
import type { InvoiceDetails, Order, Subscription } from "@/lib/types";
import { HttpError, type Actor } from "./http";
import { getSettings } from "./orders";

export const invoiceCollection = (kind: InvoiceKind) => adminDb.collection(kind === "order" ? "orders" : "subscriptions");
const address = z.object({ line1: z.string().max(300), line2: z.string().max(300).optional(), city: z.string().max(100), state: z.string().max(100), pincode: z.string().max(12) });
export const invoiceEditSchema = z.object({
  revision: z.number().int().nonnegative(),
  reason: z.string().trim().min(5).max(500),
  buyer: z.object({ name: z.string().trim().min(1).max(100), phone: z.string().max(30).optional(), email: z.string().email().or(z.literal("")).optional(), address: address.nullable().optional() }),
  buyerGstin: z.string().trim().toUpperCase().regex(/^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/, "Enter a valid GSTIN").default(""),
  note: z.string().max(1500).default(""),
  amounts: z.object({ rates: z.array(z.number().nonnegative().max(1000000)).min(1).max(100), discount: z.number().nonnegative().max(1000000), packagingCharge: z.number().nonnegative().max(1000000), deliveryCharge: z.number().nonnegative().max(1000000) }).optional(),
});

export async function editInvoice(kind: InvoiceKind, id: string, input: z.infer<typeof invoiceEditSchema>, actor: Actor) {
  const ref = invoiceCollection(kind).doc(id);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "Invoice not found");
    const doc = { ...snap.data(), id } as Order | Subscription;
    const settings = await getSettings(tx);
    const invoice = buildInvoiceRecord(kind, id, doc, settings);
    if (!invoice) throw new HttpError(409, "No tax invoice has been issued for this record");
    if (invoice.revision !== input.revision) throw new HttpError(409, "This invoice changed. Reload it before saving your edits.");
    const patch: Record<string, unknown> = {};
    if (input.amounts) {
      if (!invoice.canEditAmounts) throw new HttpError(409, "Amounts are locked for paid, cancelled or gateway-linked invoices. Billing details can still be corrected.");
      const order = doc as Order;
      if (input.amounts.rates.length !== order.lines.length) throw new HttpError(400, "Invoice lines changed. Reload and try again.");
      const lines = order.lines.map((l, i) => ({ ...l, unitPrice: round2(input.amounts!.rates[i]), lineTotal: round2(input.amounts!.rates[i] * l.qty) }));
      const bill = computeBill({ source: order.source, lines, discount: input.amounts.discount, delivery: true, deliveryCharge: input.amounts.deliveryCharge }, { ...settings, gstRate: invoice.gstRate, packagingChargePerOrder: input.amounts.packagingCharge });
      Object.assign(patch, bill, { lines });
    }
    const before = { buyer: invoice.buyer, buyerGstin: invoice.buyerGstin, note: invoice.note, total: invoice.total, ...(input.amounts ? { rates: invoice.rows.map((r) => r.unitPrice), discount: invoice.discount, packagingCharge: invoice.packagingCharge, deliveryCharge: invoice.deliveryCharge } : {}) };
    const after = { buyer: input.buyer, buyerGstin: input.buyerGstin, note: input.note, total: patch.total ?? invoice.total, ...(input.amounts ? { ...input.amounts } : {}) };
    const details: InvoiceDetails = {
      buyer: input.buyer, buyerGstin: input.buyerGstin, note: input.note, revision: invoice.revision + 1,
      history: [...invoice.history, { at: Date.now(), by: actor.uid, byName: actor.name, reason: input.reason, before, after }],
    };
    tx.update(ref, { ...patch, invoiceDetails: details, updatedAt: Date.now() });
    return { ok: true, revision: details.revision };
  });
}
