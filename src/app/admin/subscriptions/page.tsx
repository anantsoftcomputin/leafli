"use client";

import { Fragment, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { inr } from "@/lib/costing";
import { useLive, useMenu } from "@/lib/hooks";
import { istDate } from "@/lib/site";
import { addDays, DAY_NAMES, dishFor, eligibleDishes, isDue, mealsRemaining, SUB_STATUS_LABEL } from "@/lib/subscriptions";
import type { Plan, Subscription } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { PaymentPanel } from "@/components/admin/PaymentPanel";
import { Badge, Button, Card, Empty, ErrorText, Input, PageHeader, Stat, Td, Th } from "@/components/ui";

export default function SubscriptionsAdmin() {
  const { profile } = useAuth();
  const isMgr = profile?.role === "admin" || profile?.role === "manager";
  const { data: subs } = useLive<Subscription>("subscriptions");
  const { data: plans } = useLive<Plan>("plans");
  const { data: menu } = useMenu();
  const [date, setDate] = useState(istDate());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState<string | null>(null);

  const planMap = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);
  const due = useMemo(
    () =>
      subs
        .filter((s) => isDue(s, date))
        .map((s) => ({ s, dish: dishFor(s, date, eligibleDishes(menu, planMap.get(s.planId)?.eligibleMenuIds ?? [], s.diet)) }))
        .sort((a, b) => a.s.slot.localeCompare(b.s.slot)),
    [subs, date, menu, planMap],
  );
  const doneToday = subs.filter((s) => s.fulfilled?.[date]).length;
  const pending = subs.filter((s) => s.status === "pending_payment");
  const active = subs.filter((s) => s.status === "active" || s.status === "paused");
  const prepCount = due.reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.dish?.name ?? "—"]: (acc[d.dish?.name ?? "—"] ?? 0) + 1 }), {});

  async function generate() {
    setBusy("gen");
    setErr(null);
    setMsg(null);
    try {
      const r = await api<{ created: string[]; skipped: { id: string; reason: string }[] }>("/api/subscriptions/generate", { date });
      setMsg(`${r.created.length} kitchen order(s) created${r.skipped.length ? `, ${r.skipped.length} skipped (${r.skipped[0]!.reason})` : ""}.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function activate(id: string) {
    if (!confirm("Confirm payment was received (cash/UPI) and activate this plan?")) return;
    setBusy(id);
    try {
      await api(`/api/subscriptions/${id}/activate`, {});
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="Subscriptions" sub="Each morning, create the day's kitchen orders. They join the normal order board and deduct stock like any order." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active plans" value={active.length} />
        <Stat label={`Due ${date === istDate() ? "today" : date}`} value={due.length} sub={`${doneToday} already sent to kitchen`} />
        <Stat label="Awaiting payment" value={pending.length} tone={pending.length ? "amber" : undefined} />
        <Stat label="Bowls left (all plans)" value={active.reduce((s, x) => s + mealsRemaining(x), 0)} />
      </div>

      <Card
        title="Delivery schedule"
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => setDate(addDays(date, -1))}>←</Button>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value || istDate())} className="w-40 py-1" />
            <Button size="sm" variant="ghost" onClick={() => setDate(addDays(date, 1))}>→</Button>
            <Button size="sm" onClick={generate} loading={busy === "gen"} disabled={!due.length}>Send {due.length} to kitchen</Button>
          </>
        }
      >
        {msg && <p className="mb-3 rounded bg-leaf-50 p-2 text-sm text-leaf-800">{msg}</p>}
        <ErrorText>{err}</ErrorText>
        {Object.keys(prepCount).length > 0 && (
          <p className="mb-3 text-sm text-stone-600"><b>Prep:</b> {Object.entries(prepCount).map(([n, c]) => `${c}× ${n}`).join(" · ")}</p>
        )}
        {!due.length ? (
          <Empty>No subscription deliveries due on {date} (or they&apos;ve all been sent to the kitchen).</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><Th>Customer</Th><Th>Slot</Th><Th>Bowl</Th><Th>Plan</Th><Th>Address</Th></tr></thead>
              <tbody>
                {due.map(({ s, dish }) => (
                  <tr key={s.id} className="border-t border-stone-100">
                    <Td><div className="font-medium">{s.customer.name}</div><div className="text-xs text-stone-500">{s.customer.phone}</div></Td>
                    <Td><Badge tone={s.slot === "lunch" ? "amber" : "violet"}>{s.slot}</Badge></Td>
                    <Td>{dish?.name ?? <span className="text-red-600">No eligible bowl</span>}{s.selections[date] ? <Badge tone="green">chosen</Badge> : <span className="ml-1 text-xs text-stone-400">rotation</span>}</Td>
                    <Td className="text-xs">{s.planName} · {mealsRemaining(s)} left</Td>
                    <Td className="max-w-xs text-xs text-stone-600">{[s.address.line1, s.address.line2, s.address.landmark, s.address.pincode].filter(Boolean).join(", ")}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pending.length > 0 && (
        <Card title="Awaiting payment" className="mt-5">
          <table className="w-full text-sm">
            <thead><tr><Th>Customer</Th><Th>Plan</Th><Th>Starts</Th><Th className="text-right">Amount</Th><Th>Mode</Th><Th /></tr></thead>
            <tbody>
              {pending.map((s) => (
                <tr key={s.id} className="border-t border-stone-100">
                  <Td><div className="font-medium">{s.customer.name}</div><div className="text-xs text-stone-500">{s.customer.phone}</div></Td>
                  <Td>{s.planName}</Td>
                  <Td className="text-xs">{s.startDate}</Td>
                  <Td className="text-right">{inr(s.total)}</Td>
                  <Td className="text-xs">{s.paymentMode === "online" ? "Online (not completed)" : "Pay before delivery"}</Td>
                  <Td className="text-right">{isMgr && <Button size="sm" variant="secondary" loading={busy === s.id} onClick={() => activate(s.id)}>Mark paid & activate</Button>}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card title={`All plans (${subs.length})`} className="mt-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><Th>Customer</Th><Th>Plan</Th><Th>Days</Th><Th>Diet</Th><Th>Bowls</Th><Th>Valid until</Th><Th>Status</Th><Th>Payment</Th></tr></thead>
            <tbody>
              {[...subs].sort((a, b) => b.createdAt - a.createdAt).map((s) => (
                <Fragment key={s.id}>
                <tr className="border-t border-stone-100">
                  <Td><div className="font-medium">{s.customer.name}</div><div className="text-xs text-stone-500">{s.customer.phone}</div></Td>
                  <Td>{s.planName}</Td>
                  <Td className="text-xs">{s.deliveryDays.map((d) => DAY_NAMES[d]).join(" ")} · {s.slot}</Td>
                  <Td className="text-xs">{s.diet}</Td>
                  <Td className="tabular-nums">{s.mealsUsed}/{s.mealsTotal}</Td>
                  <Td className="text-xs">{s.endDate}</Td>
                  <Td><Badge tone={s.status === "active" ? "green" : s.status === "pending_payment" || s.status === "paused" ? "amber" : "gray"}>{SUB_STATUS_LABEL[s.status]}</Badge></Td>
                  <Td>
                    <Button size="sm" variant="ghost" onClick={() => setPayOpen(payOpen === s.id ? null : s.id)}>
                      {s.paymentStatus}{s.payment?.refundedAmount ? ` · ${inr(s.payment.refundedAmount)} refunded` : ""} {payOpen === s.id ? "▴" : "▾"}
                    </Button>
                  </Td>
                </tr>
                {payOpen === s.id && (
                  <tr className="bg-stone-50/60">
                    <Td colSpan={8}>
                      <div className="max-w-md py-1"><PaymentPanel kind="subscription" doc={s} /></div>
                    </Td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
