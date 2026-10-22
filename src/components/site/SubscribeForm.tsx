"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { subscriptionTotals } from "@/lib/billing";
import { rupees } from "@/lib/costing";
import { payWithRazorpay } from "@/lib/razorpay-client";
import { istDate } from "@/lib/site";
import { addDays, DAY_NAMES, SLOT_LABEL, upcomingDates } from "@/lib/subscriptions";
import type { Address, DietPref, Plan } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { AddressForm, emptyAddress } from "@/components/AddressForm";

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function SubscribeForm({ plan, acceptsOnline, razorpayKeyId, gstRate }: { plan: Plan; acceptsOnline: boolean; razorpayKeyId: string | null; gstRate: number }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const tomorrow = addDays(istDate(), 1);
  const [startDate, setStartDate] = useState(tomorrow);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [slot, setSlot] = useState<"lunch" | "dinner">("lunch");
  const [diet, setDiet] = useState<DietPref>("veg");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [notes, setNotes] = useState("");
  const [pay, setPay] = useState<"online" | "offline">(acceptsOnline ? "online" : "offline");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setName((n) => n || profile.name || "");
    setPhone((p) => p || (profile.phone ?? "").replace("+91", ""));
    if (profile.addresses?.[0]) setAddress((a) => (a.line1 ? a : profile.addresses![0]!));
  }, [profile]);

  const t = subscriptionTotals(plan.price, gstRate);
  const preview = useMemo(
    () =>
      upcomingDates(
        { startDate, endDate: addDays(startDate, plan.validityDays - 1), deliveryDays: days, skipped: [], fulfilled: {}, status: "active", pausedFrom: null, mealsTotal: plan.meals, mealsUsed: 0 },
        startDate,
      ),
    [startDate, days, plan],
  );
  const fits = preview.length === plan.meals;

  async function submit() {
    setErr(null);
    if (!name.trim()) return setErr("Please add your name");
    if (phone.replace(/\D/g, "").length < 10) return setErr("Please add a 10-digit mobile number");
    if (!address.line1 || !/^\d{6}$/.test(address.pincode) || !address.city || !address.state) return setErr("Please complete your delivery address");
    if (address.lat == null) return setErr("Tap “Use my location” so our riders can find you");
    setBusy(true);
    try {
      const r = await api<{ id: string; checkout?: { keyId: string; rzpOrderId: string; amount: number } }>("/api/subscriptions", {
        planId: plan.id,
        startDate,
        deliveryDays: days,
        slot,
        diet,
        address,
        customer: { name: name.trim(), phone: `+91${phone.replace(/\D/g, "").slice(-10)}` },
        paymentMode: pay,
        notes: notes || undefined,
      });
      if (r.checkout && razorpayKeyId) {
        const res = await payWithRazorpay({
          ...r.checkout,
          orderId: r.id,
          orderNo: plan.name,
          description: `${plan.name} — ${plan.meals} bowls`,
          verifyPath: `/api/subscriptions/${r.id}/verify`,
          prefill: { name, email: profile?.email ?? undefined, contact: phone.replace(/\D/g, "").slice(-10) },
        }).catch(() => "dismissed" as const);
        router.push(`/account/subscriptions/${r.id}${res === "paid" ? "?welcome=1" : ""}`);
      } else {
        router.push(`/account/subscriptions/${r.id}`);
      }
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const field = "w-full rounded-2xl border-0 bg-cream-100 px-4 py-3 text-[15px] ring-1 ring-ink/10 outline-none focus:ring-2 focus:ring-leaf-500";
  const chip = (on: boolean) => `rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${on ? "bg-leaf-700 text-cream-50" : "bg-white text-ink/70 ring-1 ring-ink/10 hover:ring-ink/30"}`;

  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-2xl shadow-leaf-900/10 ring-1 ring-ink/5 sm:p-8">
      <h2 className="font-display text-2xl font-medium">Start {plan.name}</h2>
      {!user ? (
        <div className="mt-6 rounded-3xl bg-lime-300/50 p-6 text-center">
          <p className="font-display text-xl">Sign in to subscribe</p>
          <p className="mt-2 text-sm text-ink/60">Google, mobile OTP or email — then manage deliveries from your account.</p>
          <Link href={`/login?next=/plans/${plan.slug}`} className="mt-5 inline-flex rounded-full bg-leaf-700 px-6 py-3 font-semibold text-cream-50">Sign in to continue</Link>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Delivery days</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button key={d} type="button" aria-pressed={days.includes(d)} className={chip(days.includes(d))} onClick={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}>
                  {DAY_NAMES[d]}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Start date</span>
              <input type="date" className={field} min={tomorrow} max={addDays(tomorrow, 29)} value={startDate} onChange={(e) => setStartDate(e.target.value || tomorrow)} />
            </label>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Slot</legend>
              <div className="flex gap-2">
                {(["lunch", "dinner"] as const).map((s) => (
                  <button key={s} type="button" aria-pressed={slot === s} className={chip(slot === s)} onClick={() => setSlot(s)} title={SLOT_LABEL[s]}>
                    {s === "lunch" ? "Lunch" : "Dinner"}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Food preference</legend>
            <div className="flex flex-wrap gap-2">
              {([["veg", "Vegetarian"], ["egg", "Eggetarian"], ["nonveg", "Non-veg"]] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={diet === k} className={chip(diet === k)} onClick={() => setDiet(k)}>{l}</button>
              ))}
            </div>
          </fieldset>

          <div className="rounded-2xl bg-cream-100 p-4 text-sm">
            <p className="font-semibold">Your first deliveries</p>
            <p className="mt-1 text-ink/60">{preview.slice(0, 6).map(fmt).join(" · ")}{preview.length > 6 && " …"}</p>
            {!fits && <p className="mt-2 font-medium text-tomato">Only {preview.length} of {plan.meals} bowls fit in {plan.validityDays} days on these days — add more delivery days.</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input className={field} placeholder="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={field} placeholder="Mobile number" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <AddressForm value={address} onChange={setAddress} allowGeo />
          <input className={field} placeholder="Delivery note (gate, floor, office desk…) — optional" value={notes} onChange={(e) => setNotes(e.target.value)} />

          {acceptsOnline && (
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold">Payment</legend>
              {([["online", "Pay online now", "UPI, cards, netbanking & wallets via Razorpay"], ["offline", "Pay before first delivery", "Our team will call to collect by UPI or cash"]] as const).map(([k, title, sub]) => (
                <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 ring-1 transition-colors ${pay === k ? "bg-lime-300/40 ring-leaf-600" : "bg-cream-100 ring-ink/10"}`}>
                  <input type="radio" name="sub-pay" className="accent-leaf-700" checked={pay === k} onChange={() => setPay(k)} />
                  <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-ink/50">{sub}</span></span>
                </label>
              ))}
            </fieldset>
          )}

          <dl className="space-y-1 border-t border-ink/5 pt-4 text-sm text-ink/60">
            <div className="flex justify-between"><dt>{plan.meals} bowls</dt><dd>{rupees(plan.price)}</dd></div>
            <div className="flex justify-between"><dt>GST ({gstRate}%)</dt><dd>{rupees(t.cgst + t.sgst)}</dd></div>
            <div className="flex justify-between pt-1 text-lg font-semibold text-ink"><dt>Total</dt><dd>{rupees(t.total)}</dd></div>
          </dl>
          {err && <p role="alert" className="rounded-xl bg-tomato/10 px-3 py-2 text-sm text-tomato">{err}</p>}
          <button onClick={submit} disabled={busy || !fits || !days.length} className="w-full rounded-full bg-leaf-700 py-4 font-semibold text-cream-50 transition-colors hover:bg-leaf-800 disabled:opacity-50">
            {busy ? "Setting up…" : pay === "online" && acceptsOnline ? `Pay ${rupees(t.total)} & subscribe` : "Request subscription"}
          </button>
          <p className="text-center text-xs text-ink/40">Skip, pause or swap bowls anytime until 9 pm the day before.</p>
        </div>
      )}
    </div>
  );
}
