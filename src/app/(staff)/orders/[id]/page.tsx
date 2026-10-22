"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { inr } from "@/lib/costing";
import { useLiveDoc, useSettings } from "@/lib/hooks";
import type { Order } from "@/lib/types";
import { OrderActions, SourceBadge, StatusBadge } from "@/components/OrderBits";
import { Badge, Button, Card, ErrorText } from "@/components/ui";

export default function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: order, loading } = useLiveDoc<Order>(`orders/${id}`);
  const settings = useSettings();
  const autoPrint = useSearchParams().get("print") === "1";

  useEffect(() => {
    if (autoPrint && order) setTimeout(() => window.print(), 400);
  }, [autoPrint, order]);

  if (loading) return <p className="text-sm text-stone-500">Loading…</p>;
  if (!order) return <p className="text-sm text-stone-500">Order not found.</p>;

  const margin = order.taxableValue - order.foodCost - order.aggregatorCommission - (order.delivery.fare ?? 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="no-print flex flex-wrap items-center gap-3">
          <Link href="/orders" className="text-sm text-stone-500 hover:underline">← Orders</Link>
          <h1 className="text-xl font-semibold">{order.orderNo}</h1>
          <SourceBadge source={order.source} />
          <StatusBadge status={order.status} />
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={() => window.print()}>Print bill</Button>
          </div>
        </div>
        <div className="no-print">
          <OrderActions order={order} />
        </div>

        <Invoice order={order} settings={settings} />
      </div>

      <div className="no-print space-y-4">
        <Card title="Delivery">
          <DeliveryPanel order={order} />
        </Card>
        <Card title="Profitability">
          <dl className="space-y-1 text-sm">
            <Line k="Net sales (excl. GST)" v={inr(order.taxableValue)} />
            <Line k="Food + packaging cost" v={`− ${inr(order.foodCost)}`} />
            {order.aggregatorCommission > 0 && <Line k="Zomato commission (est.)" v={`− ${inr(order.aggregatorCommission)}`} />}
            {order.delivery.fare != null && <Line k="Porter fare" v={`− ${inr(order.delivery.fare)}`} />}
            <div className="flex justify-between border-t border-stone-100 pt-1 font-semibold">
              <span>Contribution</span>
              <span className={margin < 0 ? "text-red-600" : "text-leaf-700"}>{inr(margin)}</span>
            </div>
            <p className="pt-1 text-xs text-stone-500">
              Food cost {order.taxableValue ? ((order.foodCost / order.taxableValue) * 100).toFixed(1) : 0}% ·{" "}
              {order.stockDeducted ? "stock deducted (actual batch costs)" : "estimated — stock not yet deducted"}
            </p>
          </dl>
        </Card>
        <Card title="Timeline">
          <ol className="space-y-1 text-sm">
            {order.statusHistory.map((h, i) => (
              <li key={i} className="flex justify-between">
                <span className="capitalize">{h.status}</span>
                <span className="text-stone-500">{new Date(h.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}
          </ol>
          {"cancelReason" in order && <p className="mt-2 text-xs text-red-600">Reason: {String((order as unknown as { cancelReason: string }).cancelReason)}</p>}
        </Card>
      </div>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-stone-600">{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}

function Invoice({ order, settings }: { order: Order; settings: ReturnType<typeof useSettings> }) {
  const isTaxInvoice = !order.gstCollectedByAggregator;
  const a = settings.address;
  return (
    <article className="rounded-xl border border-stone-200 bg-white p-6 text-sm print:border-0 print:p-0">
      <header className="mb-4 text-center">
        <div className="text-xl font-bold tracking-tight text-leaf-700">{settings.name.toUpperCase()}</div>
        <div className="text-xs text-stone-600">{settings.legalName}</div>
        <div className="text-xs text-stone-500">
          {[a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ")}
        </div>
        <div className="text-xs text-stone-500">
          {settings.gstin && <>GSTIN: {settings.gstin} · </>}
          {settings.fssai && <>FSSAI: {settings.fssai}</>}
        </div>
        <div className="mt-2 font-semibold">{isTaxInvoice ? "TAX INVOICE" : "ORDER SUMMARY"}</div>
      </header>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          {order.invoiceNo && <div><b>Invoice:</b> {order.invoiceNo}</div>}
          <div><b>Order:</b> {order.orderNo}</div>
          {order.externalId && <div><b>Zomato ID:</b> {order.externalId}</div>}
          <div><b>Date:</b> {new Date(order.createdAt).toLocaleString("en-IN")}</div>
        </div>
        <div className="text-right">
          <div><b>{order.customer.name}</b></div>
          {order.customer.phone && <div>{order.customer.phone}</div>}
          {order.customer.address && (
            <div>{[order.customer.address.line1, order.customer.address.line2, order.customer.address.city, order.customer.address.pincode].filter(Boolean).join(", ")}</div>
          )}
        </div>
      </div>
      <table className="w-full text-xs">
        <thead className="border-y border-stone-200">
          <tr>
            <th className="py-1 text-left">Item</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Rate</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.menuItemId}>
              <td className="py-1">{l.name}</td>
              <td className="py-1 text-right">{l.qty}</td>
              <td className="py-1 text-right">{inr(l.unitPrice)}</td>
              <td className="py-1 text-right">{inr(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-3 ml-auto max-w-xs space-y-0.5 border-t border-stone-200 pt-2 text-xs">
        <Line k="Subtotal" v={inr(order.subtotal)} />
        {order.discount > 0 && <Line k="Discount" v={`− ${inr(order.discount)}`} />}
        {order.packagingCharge > 0 && <Line k="Packaging" v={inr(order.packagingCharge)} />}
        {order.deliveryCharge > 0 && <Line k="Delivery" v={inr(order.deliveryCharge)} />}
        {isTaxInvoice ? (
          <>
            <Line k="Taxable value" v={inr(order.taxableValue)} />
            <Line k={`CGST @ ${settings.gstRate / 2}%`} v={inr(order.cgst)} />
            <Line k={`SGST @ ${settings.gstRate / 2}%`} v={inr(order.sgst)} />
          </>
        ) : (
          <Line k="GST" v="Collected by Zomato" />
        )}
        {order.roundOff !== 0 && <Line k="Round off" v={inr(order.roundOff)} />}
        <div className="flex justify-between border-t border-stone-200 pt-1 text-sm font-semibold">
          <span>Total</span>
          <span>{inr(order.total)}</span>
        </div>
        <div className="text-right text-stone-500">
          {order.paymentMode === "online" ? "Online (Razorpay)" : order.paymentMode.replace("_", " ")} · {order.paymentStatus}
        </div>
        {order.payment?.paymentId && <div className="no-print text-right text-[10px] text-stone-400">Payment {order.payment.paymentId}{order.payment.refundId && ` · refund ${order.payment.refundId}`}</div>}
        {order.payment?.refundError && <div className="no-print text-right text-[10px] text-red-600">Refund failed: {order.payment.refundError} — refund from the Razorpay dashboard</div>}
      </dl>
      {isTaxInvoice && <p className="mt-3 text-[10px] text-stone-500">SAC 996331 — Restaurant services. GST @ {settings.gstRate}% without input tax credit.</p>}
      {order.notes && <p className="mt-2 text-xs"><b>Note:</b> {order.notes}</p>}
      <p className="mt-4 text-center text-xs text-stone-500">{settings.invoiceFooter}</p>
    </article>
  );
}

function DeliveryPanel({ order }: { order: Order }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<{ vehicle: string; fare: number; etaMinutes: number | null }[] | null>(null);
  const d = order.delivery;

  async function act(action: "quote" | "book" | "refresh" | "cancel") {
    if (action === "cancel" && !confirm("Cancel the Porter booking?")) return;
    setBusy(action);
    setErr(null);
    try {
      const r = await api<{ quotes?: typeof quotes }>(`/api/orders/${order.id}/delivery`, { action });
      if (r.quotes) setQuotes(r.quotes);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (d.provider === "pickup") return <p className="text-sm text-stone-600">Customer pickup.</p>;
  if (d.provider === "zomato") return <p className="text-sm text-stone-600">Delivered by Zomato&apos;s rider.</p>;
  if (d.provider === "self") return <p className="text-sm text-stone-600">Own delivery staff.</p>;

  const live = d.porterOrderId && d.status !== "cancelled";
  return (
    <div className="space-y-3 text-sm">
      {live ? (
        <>
          <div className="flex items-center justify-between">
            <span>Porter #{d.porterOrderId}</span>
            <Badge tone="green">{d.status}</Badge>
          </div>
          {d.partnerName && <div>Rider: {d.partnerName} {d.partnerPhone && `· ${d.partnerPhone}`}</div>}
          {d.fare != null && <div>Fare: {inr(d.fare)}</div>}
          {d.trackingUrl && <a className="text-leaf-700 underline" href={d.trackingUrl} target="_blank" rel="noreferrer">Live tracking ↗</a>}
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" loading={busy === "refresh"} onClick={() => act("refresh")}>Refresh status</Button>
            <Button size="sm" variant="ghost" loading={busy === "cancel"} onClick={() => act("cancel")}>Cancel booking</Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-stone-600">
            {order.customer.address?.lat == null ? "⚠ The address has no coordinates — Porter needs lat/lng." : "Ready to book a Porter rider."}
          </p>
          {quotes && (
            <ul className="space-y-1 rounded-lg bg-stone-50 p-2 text-xs">
              {quotes.length === 0 && <li>No vehicles available.</li>}
              {quotes.map((q) => (
                <li key={q.vehicle} className="flex justify-between">
                  <span>{q.vehicle}</span>
                  <span>{inr(q.fare)} {q.etaMinutes != null && `· ${q.etaMinutes} min`}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" loading={busy === "quote"} onClick={() => act("quote")}>Get quote</Button>
            <Button size="sm" loading={busy === "book"} onClick={() => act("book")} disabled={order.status === "cancelled"}>Book Porter</Button>
          </div>
        </>
      )}
      <ErrorText>{err}</ErrorText>
    </div>
  );
}
