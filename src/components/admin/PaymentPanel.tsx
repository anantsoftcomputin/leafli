"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { inr } from "@/lib/costing";
import type { Order, Subscription } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, ErrorText, Input } from "@/components/ui";

type Target = { kind: "order"; doc: Order } | { kind: "subscription"; doc: Subscription };

/** Razorpay status + actions for one order or subscription: check, payment link, refund. */
export function PaymentPanel(t: Target) {
  const { profile } = useAuth();
  const isMgr = profile?.role === "admin" || profile?.role === "manager";
  const d = t.doc;
  const pay = d.payment;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const refunded = pay?.refundedAmount ?? 0;
  const left = Math.max(0, Math.round((d.total - refunded) * 100) / 100);
  const order = t.kind === "order" ? t.doc : null;
  const cancelled = d.status === "cancelled";
  const canLink =
    order && d.paymentStatus === "pending" && !cancelled && !order.subscriptionId && order.source !== "zomato" && !pay?.rzpOrderId;
  const canRefund = isMgr && pay?.paymentId && left > 0 && pay.refundStatus !== "pending";

  async function run(key: string, path: string, body: unknown, done?: (r: Record<string, unknown>) => string | null) {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      const r = await api<Record<string, unknown>>(path, body);
      setMsg(done?.(r) ?? null);
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function submitRefund() {
    const amt = amount.trim() ? Number(amount) : undefined;
    if (amt != null && !(amt > 0 && amt <= left)) return setErr(`Enter an amount up to ${inr(left)}`);
    if (!confirm(`Refund ${inr(amt ?? left)} to the customer's original payment method?`)) return;
    const ok = await run("refund", "/api/payments/razorpay/refund", { kind: t.kind, id: d.id, amount: amt, reason }, (r) => `Refund of ${inr(Number(r.amount))} started`);
    if (ok) {
      setRefunding(false);
      setAmount("");
      setReason("");
    }
  }

  const tone = d.paymentStatus === "paid" ? "green" : d.paymentStatus === "refunded" ? "gray" : "amber";
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-stone-600">{pay ? `Razorpay${pay.method ? ` · ${pay.method.toUpperCase()}` : ""}` : (order?.paymentMode.replace("_", " ") ?? d.paymentMode)}</span>
        <Badge tone={tone}>{d.paymentStatus}</Badge>
      </div>
      {pay?.paymentId && (
        <dl className="space-y-0.5 text-xs text-stone-500">
          <div>Payment <code>{pay.paymentId}</code></div>
          {pay.paidAt && <div>Paid {new Date(pay.paidAt).toLocaleString("en-IN")}</div>}
        </dl>
      )}
      {d.paymentStatus === "pending" && pay?.lastError && <p className="text-xs text-red-600">Last attempt failed: {pay.lastError}</p>}
      {refunded > 0 && (
        <p className="text-xs">
          Refunded {inr(refunded)} of {inr(d.total)} ·{" "}
          <Badge tone={pay?.refundStatus === "processed" ? "green" : pay?.refundStatus === "failed" ? "red" : "amber"}>{pay?.refundStatus ?? "pending"}</Badge>
        </p>
      )}
      {pay?.refundError && <p className="text-xs text-red-600">Refund problem: {pay.refundError}</p>}
      {order?.paymentLink && d.paymentStatus === "pending" && (
        <p className="text-xs">
          Link sent: <a className="break-all text-leaf-700 underline" href={order.paymentLink.url} target="_blank" rel="noreferrer">{order.paymentLink.url}</a>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {pay?.rzpOrderId && d.paymentStatus === "pending" && (
          <Button size="sm" variant="secondary" loading={busy === "check"} onClick={() => run("check", "/api/payments/razorpay/reconcile", { kind: t.kind, id: d.id }, (r) => (r.changed ? "Payment found and recorded" : "No successful payment yet"))}>
            Check with Razorpay
          </Button>
        )}
        {canLink && (
          <Button size="sm" variant="secondary" loading={busy === "link"} onClick={() => run("link", "/api/payments/razorpay/link", { orderId: d.id }, (r) => {
            void navigator.clipboard?.writeText(String(r.url)).catch(() => {});
            return r.reused ? "Link already sent — copied" : "Link sent to the customer by SMS — copied";
          })}>
            {order?.paymentLink ? "Copy payment link" : "Send payment link"}
          </Button>
        )}
        {canRefund && !refunding && (
          <Button size="sm" variant="ghost" onClick={() => setRefunding(true)}>{pay?.refundError ? "Retry refund" : "Refund…"}</Button>
        )}
      </div>

      {refunding && (
        <div className="space-y-2 rounded-lg bg-stone-50 p-3">
          <div className="flex items-center gap-2">
            <Input type="number" min={1} max={left} step="0.01" inputMode="decimal" placeholder={`${left} (full)`} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-32" />
            <span className="text-xs text-stone-500">of {inr(left)} left</span>
          </div>
          <Input placeholder="Reason (e.g. missing item, quality)" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full" />
          <div className="flex gap-2">
            <Button size="sm" variant="danger" loading={busy === "refund"} disabled={reason.trim().length < 3} onClick={submitRefund}>Refund</Button>
            <Button size="sm" variant="ghost" onClick={() => setRefunding(false)}>Cancel</Button>
          </div>
          {t.kind === "order" && !cancelled && <p className="text-[11px] text-stone-500">Refunding doesn&apos;t cancel the order. Cancelling an order refunds it automatically.</p>}
          {t.kind === "subscription" && <p className="text-[11px] text-stone-500">A full refund also cancels the plan.</p>}
        </div>
      )}
      {msg && <p className="text-xs text-leaf-700">{msg}</p>}
      <ErrorText>{err}</ErrorText>
    </div>
  );
}
