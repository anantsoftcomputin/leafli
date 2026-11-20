"use client";

import { inr } from "@/lib/costing";
import { rupeesInWords } from "@/lib/invoice";
import type { InvoiceRecord } from "@/lib/invoice-record";

const address = (a: InvoiceRecord["buyer"]["address"]) => a ? [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ") : "";
export function InvoiceView({ invoice: i }: { invoice: InvoiceRecord }) {
  return <article className="mx-auto max-w-4xl rounded-2xl border border-stone-200 bg-white p-5 text-sm sm:p-8 print:border-0 print:p-0">
    <header className="border-b pb-5 text-center">
      <h1 className="text-2xl font-bold text-leaf-700">{i.seller.legalName || i.seller.name}</h1>
      <p>{address(i.seller.address)}</p><p>{i.seller.phone} {i.seller.email}</p>
      <p>{i.seller.gstin && `GSTIN: ${i.seller.gstin}`} {i.seller.fssai && ` · FSSAI: ${i.seller.fssai}`}</p>
      <h2 className="mt-3 font-semibold">TAX INVOICE</h2>
    </header>
    <div className="my-5 grid gap-4 sm:grid-cols-2">
      <div><p><b>Invoice:</b> {i.invoiceNo}</p><p><b>Date:</b> {new Date(i.issuedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p><p><b>Reference:</b> {i.reference}</p><p><b>Status:</b> {i.status} · {i.paymentStatus}</p>{i.revision > 0 && <p>Revision {i.revision}</p>}</div>
      <div className="sm:text-right"><b>{i.buyer.name}</b><p>{i.buyer.phone}</p><p>{i.buyer.email}</p><p>{address(i.buyer.address)}</p>{i.buyerGstin && <p>Buyer GSTIN: {i.buyerGstin}</p>}</div>
    </div>
    <div className="overflow-x-auto"><table className="w-full text-left">
      <thead className="border-y"><tr><th className="py-2">Description</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
      <tbody>{i.rows.map((r, n) => <tr key={n} className="border-b border-stone-100"><td className="py-3 pr-3">{r.name}{r.detail && <p className="mt-1 text-xs text-stone-600">{r.detail}</p>}</td><td className="text-right">{r.qty}</td><td className="text-right">{inr(r.unitPrice)}</td><td className="text-right">{inr(r.amount)}</td></tr>)}</tbody>
    </table></div>
    <dl className="mt-5 ml-auto max-w-sm space-y-2">
      <Row label="Subtotal" value={i.subtotal} />{i.discount > 0 && <Row label="Discount" value={-i.discount} />}
      {i.packagingCharge > 0 && <Row label="Packaging" value={i.packagingCharge} />}{i.deliveryCharge > 0 && <Row label="Delivery" value={i.deliveryCharge} />}
      <Row label="Taxable value" value={i.taxableValue} /><Row label={`CGST @ ${i.gstRate / 2}%`} value={i.cgst} /><Row label={`SGST @ ${i.gstRate / 2}%`} value={i.sgst} />
      {!!i.roundOff && <Row label="Round off" value={i.roundOff} />}<div className="flex justify-between border-t pt-3 text-lg font-bold"><dt>Total</dt><dd>{inr(i.total)}</dd></div>
    </dl>
    <p className="mt-3 text-right">{rupeesInWords(i.total)}</p>
    <p className="mt-5">Payment: {i.paymentMode.replaceAll("_", " ")} · {i.paymentStatus}</p>
    {i.note && <p className="mt-4 whitespace-pre-wrap"><b>Invoice note:</b> {i.note}</p>}
    <p className="mt-5 text-xs text-stone-500">SAC 996331 · Restaurant services. {i.kind === "subscription" ? "Tax is charged on the plan; individual subscription meals are not invoiced again." : ""}</p>
    <p className="mt-5 text-center text-stone-500">{i.seller.invoiceFooter}</p>
  </article>;
}
function Row({ label, value }: { label: string; value: number }) { return <div className="flex justify-between gap-5"><dt>{label}</dt><dd>{inr(value)}</dd></div>; }
