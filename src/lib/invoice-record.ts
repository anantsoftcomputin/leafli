import type { Address, BusinessSettings, InvoiceDetails, InvoiceSeller, Order, Subscription } from "./types";

export type InvoiceKind = "order" | "subscription";
export interface InvoiceRecord {
  id: string;
  kind: InvoiceKind;
  invoiceNo: string;
  issuedAt: number;
  seller: InvoiceSeller;
  buyer: { name: string; phone?: string; email?: string | null; address?: Address | null };
  buyerGstin: string;
  rows: { name: string; detail: string; qty: number; unitPrice: number; amount: number }[];
  subtotal: number;
  discount: number;
  packagingCharge: number;
  deliveryCharge: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  roundOff: number;
  total: number;
  paymentStatus: string;
  paymentMode: string;
  status: string;
  reference: string;
  note: string;
  revision: number;
  history: NonNullable<InvoiceDetails["history"]>;
  canEditAmounts: boolean;
  gstRate: number;
}

export function invoiceSeller(s: BusinessSettings): InvoiceSeller {
  const { name, legalName, gstin, fssai, phone, email, address, invoiceFooter, gstRate } = s;
  return { name, legalName, gstin, fssai, phone, email, address, invoiceFooter, gstRate };
}

export function buildInvoiceRecord(kind: InvoiceKind, id: string, doc: Order | Subscription, seller: BusinessSettings): InvoiceRecord | null {
  if (!doc.invoiceNo || (kind === "order" && (doc as Order).subscriptionId)) return null;
  const frozenSeller = doc.invoiceSeller ?? invoiceSeller(seller);
  const details = doc.invoiceDetails;
  const order = doc as Order;
  const sub = doc as Subscription;
  const isOrder = kind === "order";
  return {
    id, kind, invoiceNo: doc.invoiceNo, issuedAt: doc.invoicedAt ?? doc.payment?.paidAt ?? doc.createdAt,
    seller: frozenSeller, buyer: details?.buyer ?? (isOrder ? order.customer : { ...sub.customer, address: sub.address }), buyerGstin: details?.buyerGstin ?? "",
    rows: isOrder ? order.lines.map((l) => ({ name: l.name, detail: [l.variantName, ...(l.addons ?? []).map((a) => `${a.name} (+₹${a.price})`)].filter(Boolean).join(" · "), qty: l.qty, unitPrice: l.unitPrice, amount: l.lineTotal })) : [{ name: sub.planName, detail: `${sub.mealsTotal} prepaid bowls · ${sub.startDate} to ${sub.endDate}`, qty: 1, unitPrice: sub.price, amount: sub.price }],
    subtotal: isOrder ? order.subtotal : sub.price, discount: isOrder ? order.discount : 0,
    packagingCharge: isOrder ? order.packagingCharge : 0, deliveryCharge: isOrder ? order.deliveryCharge : 0,
    taxableValue: doc.taxableValue, cgst: doc.cgst, sgst: doc.sgst, roundOff: doc.roundOff ?? 0, total: doc.total,
    paymentStatus: doc.paymentStatus, paymentMode: doc.paymentMode, status: doc.status,
    reference: isOrder ? order.orderNo : sub.planName, note: details?.note ?? "", revision: details?.revision ?? 0, history: details?.history ?? [],
    canEditAmounts: isOrder && order.paymentStatus === "pending" && order.status !== "cancelled" && !order.payment && !order.paymentLink,
    gstRate: isOrder ? order.invoiceGstRate ?? frozenSeller.gstRate : frozenSeller.gstRate,
  };
}
