import type { NextRequest } from "next/server";
import { requireUser, route, STAFF } from "@/lib/server/http";
import { invoiceCollection } from "@/lib/server/invoices";
import type { InvoiceKind } from "@/lib/invoice-record";

/** Independent cursors keep both order and subscription invoices reachable, including old years. */
export const GET = route(async (req: NextRequest) => {
  await requireUser(req, STAFF);
  const params = req.nextUrl.searchParams;
  const exact = params.get("invoiceNo")?.trim();
  const pages = await Promise.all((["order", "subscription"] as const).map(async (kind: InvoiceKind) => {
    if (params.get(`${kind}Done`) === "1") return { kind, rows: [], cursor: null, hasMore: false };
    let query = invoiceCollection(kind).where("invoiceNo", exact ? "==" : ">", exact || "").orderBy("invoiceNo", "desc").limit(51);
    const cursor = params.get(`${kind}Cursor`);
    if (cursor && !exact) query = query.startAfter(cursor);
    const snap = await query.get();
    const docs = snap.docs.slice(0, 50);
    const rows = docs.filter((d) => !d.get("subscriptionId")).map((d) => ({
      id: d.id, kind, invoiceNo: d.get("invoiceNo"), issuedAt: d.get("invoicedAt") ?? d.get("createdAt"),
      name: d.get("invoiceDetails.buyer.name") ?? d.get("customer.name"), phone: d.get("invoiceDetails.buyer.phone") ?? d.get("customer.phone") ?? "",
      reference: d.get(kind === "order" ? "orderNo" : "planName"), total: d.get("total"), paymentStatus: d.get("paymentStatus"), status: d.get("status"),
    }));
    return { kind, rows, cursor: docs.at(-1)?.get("invoiceNo") ?? null, hasMore: snap.size > 50 };
  }));
  return { rows: pages.flatMap((p) => p.rows).sort((a, b) => b.issuedAt - a.issuedAt), pages: pages.map(({ kind, cursor, hasMore }) => ({ kind, cursor, hasMore })) };
});
