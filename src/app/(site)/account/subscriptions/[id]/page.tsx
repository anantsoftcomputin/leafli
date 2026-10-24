"use client";

import Link from "next/link";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { rupees } from "@/lib/costing";
import { useLiveDoc } from "@/lib/hooks";
import { payWithRazorpay } from "@/lib/razorpay-client";
import { istDate } from "@/lib/site";
import { addDays, canChange, daysBetween, dietAllows, mealsRemaining, SLOT_LABEL, upcomingDates, DAY_NAMES } from "@/lib/subscriptions";
import type { Plan, Subscription } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { DishImage } from "@/components/site/DishImage";
import { useSite, type PublicItem } from "@/components/site/SiteContext";

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });

function Manage({ id }: { id: string }) {
  const { user } = useAuth();
  const welcome = useSearchParams().get("welcome") === "1";
  const { data: s, loading } = useLiveDoc<Subscription>(user ? `subscriptions/${id}` : null);
  const { data: plan } = useLiveDoc<Plan>(s ? `plans/${s.planId}` : null);
  const { menu } = useSite();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const eligible = useMemo<PublicItem[]>(() => {
    if (!s) return [];
    const ids = plan?.eligibleMenuIds ?? [];
    return menu.items.filter((m) => m.available && (ids.length ? ids.includes(m.id) : !/dessert/i.test(m.category)) && dietAllows(s.diet, m.diet));
  }, [menu, plan, s]);

  // Paid but the tab closed before we heard back? Ask Razorpay once when the page opens.
  const unpaid = s?.status === "pending_payment" && !!s.payment?.rzpOrderId;
  useEffect(() => {
    if (unpaid) api("/api/payments/razorpay/reconcile", { kind: "subscription", id }).catch(() => {});
  }, [unpaid, id]);

  if (loading) return <p className="text-ink/50">Loading…</p>;
  if (!s) return <p className="text-ink/50">Subscription not found.</p>;

  const today = istDate();
  const upcoming = upcomingDates(s, addDays(today, 1), 14);
  // Show skipped days in their place so they can be restored.
  const rows = [...new Set([...upcoming, ...s.skipped.filter((d) => d > today && d <= s.endDate)])].sort().slice(0, 14);
  const rotation = (d: string) => {
    const picked = eligible.find((m) => m.id === s.selections[d]);
    if (picked) return { dish: picked, chosen: true };
    if (!eligible.length) return { dish: null, chosen: false };
    const idx = ((daysBetween(s.startDate, d) % eligible.length) + eligible.length) % eligible.length;
    return { dish: eligible[idx]!, chosen: false };
  };

  async function act(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setErr(null);
    try {
      await api(`/api/subscriptions/${s!.id}`, body);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function payNow() {
    if (!s?.payment || !menu.razorpayKeyId) return;
    setBusy("pay");
    try {
      await payWithRazorpay({ keyId: menu.razorpayKeyId, rzpOrderId: s.payment.rzpOrderId, amount: Math.round(s.total * 100), orderId: s.id, orderNo: s.planName, description: s.planName, verifyPath: `/api/subscriptions/${s.id}/verify` });
      await api("/api/payments/razorpay/reconcile", { kind: "subscription", id: s.id }).catch(() => {});
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const left = mealsRemaining(s);
  return (
    <div>
      <Link href="/account/subscriptions" className="text-sm text-ink/50 hover:underline">← My subscriptions</Link>
      {welcome && s.paymentStatus === "paid" && (
        <p className="mt-4 rounded-2xl bg-lime-300/60 px-5 py-4 font-medium text-leaf-900">You&apos;re subscribed! 🎉 Your first bowl arrives {fmt(upcoming[0] ?? s.startDate)}.</p>
      )}
      <h1 className="mt-3 font-display text-5xl font-medium tracking-tight">{s.planName}</h1>
      <p className="mt-2 text-ink/60">
        {SLOT_LABEL[s.slot]} · {s.deliveryDays.map((d) => DAY_NAMES[d]).join(", ")} · {s.diet === "veg" ? "Vegetarian" : s.diet === "egg" ? "Eggetarian" : "Non-veg"}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[1.5rem] bg-white p-5 ring-1 ring-ink/5">
          <div className="text-sm text-ink/50">Bowls left</div>
          <div className="font-display text-4xl font-semibold text-leaf-700">{left}<span className="text-lg text-ink/40">/{s.mealsTotal}</span></div>
        </div>
        <div className="rounded-[1.5rem] bg-white p-5 ring-1 ring-ink/5">
          <div className="text-sm text-ink/50">Valid until</div>
          <div className="font-display text-2xl">{fmt(s.endDate)}</div>
        </div>
        <div className="rounded-[1.5rem] bg-white p-5 ring-1 ring-ink/5">
          <div className="text-sm text-ink/50">Status</div>
          <div className="font-display text-2xl capitalize">{s.status.replace("_", " ")}</div>
          {s.status === "active" && <button onClick={() => act({ type: "pause" }, "pause")} disabled={!!busy} className="mt-2 text-sm font-semibold text-leaf-700 hover:underline">Pause plan</button>}
          {s.status === "paused" && <button onClick={() => act({ type: "resume" }, "resume")} disabled={!!busy} className="mt-2 text-sm font-semibold text-leaf-700 hover:underline">Resume deliveries</button>}
        </div>
      </div>

      {s.status === "pending_payment" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] bg-mango/20 px-6 py-5">
          <div>
            <p className="font-semibold">Payment pending · {rupees(s.total)}</p>
            <p className="text-sm text-ink/60">{s.paymentMode === "online" ? "Complete payment to start your deliveries." : "Our team will contact you to collect payment before your first delivery."}</p>
            {s.payment?.lastError && <p className="mt-1 text-sm text-tomato">Last attempt failed: {s.payment.lastError}</p>}
          </div>
          <div className="flex gap-2">
            {s.paymentMode === "online" && s.payment && <button onClick={payNow} disabled={!!busy} className="rounded-full bg-leaf-700 px-6 py-3 font-semibold text-cream-50">Pay {rupees(s.total)}</button>}
            <button onClick={() => confirm("Cancel this subscription request?") && act({ type: "cancel" }, "cancel")} className="rounded-full px-4 py-3 text-sm text-ink/60 hover:bg-ink/5">Cancel</button>
          </div>
        </div>
      )}
      {err && <p className="mt-4 rounded-xl bg-tomato/10 px-4 py-3 text-sm text-tomato">{err}</p>}

      {(s.status === "active" || s.status === "paused") && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-medium">Upcoming deliveries</h2>
          <p className="mt-1 text-sm text-ink/50">Change or skip any day until 9 pm the night before.</p>
          <ul className="mt-5 space-y-3">
            {rows.map((d) => {
              const skipped = s.skipped.includes(d);
              const editable = canChange(d);
              const { dish, chosen } = rotation(d);
              return (
                <li key={d} className={`flex flex-wrap items-center gap-4 rounded-[1.5rem] bg-white p-4 ring-1 ring-ink/5 ${skipped ? "opacity-55" : ""}`}>
                  {dish && !skipped ? <DishImage id={dish.id} src={dish.imageUrl} alt={dish.name} className="size-14 shrink-0" /> : <div className="grid size-14 place-items-center rounded-full bg-ink/5 text-xs">skip</div>}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{fmt(d)}</div>
                    <div className="text-sm text-ink/50">{skipped ? "Skipped — bowl stays in your balance" : `${dish?.name ?? "—"}${chosen ? "" : " · chef's pick"}`}</div>
                  </div>
                  {editable ? (
                    <div className="flex items-center gap-2">
                      {!skipped && (
                        <select
                          aria-label={`Bowl for ${fmt(d)}`}
                          className="max-w-44 rounded-full bg-cream-100 px-3 py-2 text-sm ring-1 ring-ink/10"
                          value={s.selections[d] ?? ""}
                          onChange={(e) => act({ type: "choose", date: d, menuItemId: e.target.value || null }, d)}
                          disabled={busy === d}
                        >
                          <option value="">Chef&apos;s pick</option>
                          {eligible.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      )}
                      <button onClick={() => act({ type: skipped ? "unskip" : "skip", date: d }, d)} disabled={busy === d} className="rounded-full px-3 py-2 text-sm font-semibold text-leaf-700 hover:bg-leaf-700/5">
                        {skipped ? "Restore" : "Skip"}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-ink/40">Locked</span>
                  )}
                </li>
              );
            })}
            {!rows.length && <li className="text-ink/50">No upcoming deliveries.</li>}
          </ul>
        </section>
      )}

      <section className="mt-10 rounded-[1.5rem] bg-white p-6 text-sm text-ink/70 ring-1 ring-ink/5">
        <h2 className="font-display text-xl text-ink">Plan details</h2>
        <p className="mt-2">Delivering to {[s.address.line1, s.address.line2, s.address.city, s.address.pincode].filter(Boolean).join(", ")}</p>
        <p className="mt-1">Paid {rupees(s.total)} (incl. GST {rupees(s.cgst + s.sgst)}){s.invoiceNo && <> · Invoice {s.invoiceNo}</>}</p>
        <p className="mt-3 text-ink/50">Need to change your address or delivery days? <Link href="/contact" className="underline">Contact us</Link>.</p>
      </section>
    </div>
  );
}

export default function SubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="mx-auto max-w-3xl px-5">
      <Suspense>
        <Manage id={id} />
      </Suspense>
    </div>
  );
}
