"use client";

import { inr } from "@/lib/costing";
import { rupeesInWords, type SubscriptionInvoice } from "@/lib/invoice";
import { InvoicePage } from "@/components/InvoicePage";

const date = (ts: number) => new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const addr = (a: { line1?: string; line2?: string; city?: string; state?: string; pincode?: string }) => [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ");

/** Loads and shows a plan's tax invoice, with a Print / Save as PDF button. */
export function SubscriptionInvoicePage({ id }: { id: string }) {
  return <InvoicePage kind="subscription" id={id} />;
}

export function SubscriptionInvoiceView({ inv }: { inv: SubscriptionInvoice }) {
  const { seller: s } = inv;
  const half = s.gstRate / 2;
  const perBowl = inv.taxableValue / Math.max(inv.plan.meals, 1);
  return (
    <article className="print-area mx-auto max-w-2xl rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-800 sm:p-8 print:max-w-none print:border-0 print:p-0">
      <header className="mb-5 text-center">
        <div className="text-xl font-bold tracking-tight text-leaf-700">{s.name.toUpperCase()}</div>
        {s.legalName && s.legalName !== s.name && <div className="text-xs text-stone-600">{s.legalName}</div>}
        <div className="text-xs text-stone-500">{addr(s.address)}</div>
        <div className="text-xs text-stone-500">
          {[s.gstin && `GSTIN: ${s.gstin}`, s.fssai && `FSSAI: ${s.fssai}`, s.phone, s.email].filter(Boolean).join(" · ")}
        </div>
        <div className="mt-3 font-semibold tracking-wide">TAX INVOICE</div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-0.5">
          <div><b>Invoice no:</b> {inv.invoiceNo}</div>
          <div><b>Invoice date:</b> {date(inv.invoiceDate)}</div>
          <div><b>Place of supply:</b> {inv.placeOfSupply}</div>
        </div>
        <div className="space-y-0.5 text-right">
          <div className="text-[10px] font-semibold tracking-wider text-stone-500 uppercase">Billed to</div>
          <div><b>{inv.buyer.name}</b></div>
          {inv.buyer.phone && <div>{inv.buyer.phone}</div>}
          {inv.buyer.email && <div>{inv.buyer.email}</div>}
          <div>{addr(inv.buyer.address)}</div>
        </div>
      </div>

      <table className="w-full text-xs">
        <thead className="border-y border-stone-200">
          <tr>
            <th className="py-1.5 text-left">Description</th>
            <th className="py-1.5 text-left">SAC</th>
            <th className="py-1.5 text-right">Qty</th>
            <th className="py-1.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="align-top">
            <td className="py-2 pr-2">
              <div className="font-medium">{inv.plan.name} — salad subscription</div>
              <div className="text-stone-500">
                {inv.plan.meals} bowls ({inr(perBowl)} each) · {inv.plan.slot === "lunch" ? "lunch" : "dinner"} delivery · valid {day(inv.plan.startDate)} – {day(inv.plan.endDate)} · delivery included
              </div>
            </td>
            <td className="py-2">996331</td>
            <td className="py-2 text-right">1</td>
            <td className="py-2 text-right">{inr(inv.taxableValue)}</td>
          </tr>
        </tbody>
      </table>

      <dl className="mt-3 ml-auto max-w-xs space-y-0.5 border-t border-stone-200 pt-2 text-xs">
        <Line k="Taxable value" v={inr(inv.taxableValue)} />
        <Line k={`CGST @ ${half}%`} v={inr(inv.cgst)} />
        <Line k={`SGST @ ${half}%`} v={inr(inv.sgst)} />
        {inv.roundOff !== 0 && <Line k="Round off" v={inr(inv.roundOff)} />}
        <div className="flex justify-between border-t border-stone-200 pt-1 text-sm font-semibold">
          <span>Total</span>
          <span>{inr(inv.total)}</span>
        </div>
      </dl>
      <p className="mt-2 text-right text-xs text-stone-600">{rupeesInWords(inv.total)}</p>

      <div className="mt-4 rounded-lg bg-stone-50 p-3 text-xs text-stone-600 print:bg-transparent print:p-0">
        <b>Payment:</b> {inv.payment.mode === "online" ? `Online (Razorpay${inv.payment.method ? ` · ${inv.payment.method.toUpperCase()}` : ""})` : "Paid to Leafli (cash / UPI)"}
        {inv.payment.paymentId && <> · Ref {inv.payment.paymentId}</>}
        {inv.payment.paidAt && <> · {date(inv.payment.paidAt)}</>}
        {!!inv.payment.refundedAmount && <div className="mt-1">Refunded so far: {inr(inv.payment.refundedAmount)}</div>}
      </div>

      <p className="mt-3 text-[10px] text-stone-500">
        SAC 996331 — Restaurant services. GST @ {s.gstRate}% without input tax credit. Tax is charged once on the plan; the individual bowls delivered under it are not invoiced again.
      </p>
      <p className="mt-1 text-[10px] text-stone-500">This is a computer-generated invoice and does not need a signature.</p>
      {s.invoiceFooter && <p className="mt-4 text-center text-xs text-stone-500">{s.invoiceFooter}</p>}
    </article>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-stone-500">{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
