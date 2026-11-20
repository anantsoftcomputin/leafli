import type { NextRequest } from "next/server";
import { z } from "zod";
import { buildInvoiceRecord } from "@/lib/invoice-record";
import type { Order, Subscription } from "@/lib/types";
import { HttpError, MANAGERS, requireUser, route, STAFF } from "@/lib/server/http";
import { editInvoice, invoiceCollection, invoiceEditSchema } from "@/lib/server/invoices";
import { getSettings } from "@/lib/server/orders";

export const GET = route(async (req: NextRequest, ctx) => {
  const actor = await requireUser(req);
  const { kind, id } = await ctx.params;
  const k = z.enum(["order", "subscription"]).parse(kind);
  const snap = await invoiceCollection(k).doc(id!).get();
  if (!snap.exists) throw new HttpError(404, "Invoice not found");
  if (!STAFF.includes(actor.role) && snap.get("customerUid") !== actor.uid) throw new HttpError(403, "Not your invoice");
  const invoice = buildInvoiceRecord(k, snap.id, { ...snap.data(), id: snap.id } as Order | Subscription, await getSettings());
  if (!invoice) throw new HttpError(409, "A tax invoice has not been issued for this record");
  if (!MANAGERS.includes(actor.role)) { invoice.history = []; invoice.canEditAmounts = false; }
  return invoice;
});

export const PATCH = route(async (req: NextRequest, ctx) => {
  const actor = await requireUser(req, MANAGERS);
  const { kind, id } = await ctx.params;
  return editInvoice(z.enum(["order", "subscription"]).parse(kind), id!, invoiceEditSchema.parse(await req.json()), actor);
});
