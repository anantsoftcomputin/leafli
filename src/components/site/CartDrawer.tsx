"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { api } from "@/lib/api";
import { payWithRazorpay, type CheckoutArgs } from "@/lib/razorpay-client";
import { computeBill, DEFAULT_SETTINGS } from "@/lib/billing";
import { rupees as inr } from "@/lib/costing";
import { gsap, useGSAP } from "@/lib/gsap";
import type { Address } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { AddressForm, emptyAddress } from "@/components/AddressForm";
import { DishImage } from "./DishImage";
import { useSite } from "./SiteContext";

export function CartDrawer() {
  const { cartOpen, setCartOpen, cart, add, menu, clear, count } = useSite();
  const { user, profile } = useAuth();
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"bag" | "details">("bag");
  const [mode, setMode] = useState<"porter" | "pickup">("porter");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [notes, setNotes] = useState("");
  const [payMode, setPayMode] = useState<"online" | "pay_later">("online");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (cartOpen) setMounted(true);
  }, [cartOpen]);

  useEffect(() => {
    if (!profile) return;
    setName((n) => n || profile.name || "");
    setPhone((p) => p || (profile.phone ?? "").replace("+91", ""));
    if (profile.addresses?.[0]) setAddress((a) => (a.line1 ? a : profile.addresses![0]!));
  }, [profile]);

  useEffect(() => {
    if (!mounted) return;
    document.body.style.overflow = cartOpen ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCartOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [cartOpen, mounted, setCartOpen]);

  // Desktop: side panel sliding in from the right. Phones: bottom sheet sliding up.
  useGSAP(
    () => {
      if (!mounted || !panel.current) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const desktop = window.matchMedia("(min-width: 1024px)").matches;
      const axis = desktop ? "xPercent" : "yPercent";
      if (cartOpen) {
        gsap.set(panel.current, { y: 0 });
        gsap.fromTo(shade.current, { opacity: 0 }, { opacity: 1, duration: reduce ? 0 : 0.4 });
        gsap.fromTo(panel.current, { [axis]: 100 }, { [axis]: 0, duration: reduce ? 0 : 0.6, ease: "expo.out" });
        if (!reduce) gsap.from(panel.current.querySelectorAll("[data-line]"), { [desktop ? "x" : "y"]: 30, opacity: 0, stagger: 0.05, delay: 0.15, duration: 0.5 });
      } else {
        gsap.to(shade.current, { opacity: 0, duration: reduce ? 0 : 0.3 });
        gsap.to(panel.current, { [axis]: 100, y: desktop ? 0 : undefined, duration: reduce ? 0 : 0.4, ease: "power3.in", onComplete: () => { setMounted(false); setStep("bag"); } });
      }
    },
    { dependencies: [cartOpen, mounted] },
  );

  // Drag the sheet's handle down to dismiss (phones).
  const drag = useRef<{ y0: number; dy: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    drag.current = { y0: e.clientY, dy: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !panel.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y0);
    gsap.set(panel.current, { y: drag.current.dy });
  };
  const onPointerUp = () => {
    if (!drag.current || !panel.current) return;
    const { dy } = drag.current;
    drag.current = null;
    if (dy > 110) setCartOpen(false);
    else gsap.to(panel.current, { y: 0, duration: 0.4, ease: "elastic.out(1, 0.8)" });
  };

  if (!mounted) return null;

  const byId = new Map(menu.items.map((i) => [i.id, i]));
  const lines = Object.entries(cart).filter(([id]) => byId.has(id)).map(([id, qty]) => ({ item: byId.get(id)!, qty }));
  const bill = computeBill(
    { source: "website", lines: lines.map((l) => ({ unitPrice: l.item.price, qty: l.qty })), delivery: mode === "porter" },
    { ...DEFAULT_SETTINGS, gstRate: menu.gstRate, packagingChargePerOrder: menu.packagingChargePerOrder, defaultDeliveryCharge: menu.deliveryCharge },
  );

  async function place() {
    setErr(null);
    if (!name.trim()) return setErr("Please add your name");
    if (phone.replace(/\D/g, "").length < 10) return setErr("Please add a 10-digit mobile number");
    if (mode === "porter" && (!address.line1 || !/^\d{6}$/.test(address.pincode) || !address.city)) return setErr("Please complete your delivery address");
    if (mode === "porter" && address.lat == null) return setErr("Tap “Use my location” so the rider can find you");
    setBusy(true);
    try {
      const online = payMode === "online" && !!menu.razorpayKeyId;
      const order = await api<{ id: string; orderNo: string; checkout?: Omit<CheckoutArgs, "orderId" | "orderNo"> }>("/api/orders", {
        source: "website",
        customer: { name, phone: `+91${phone.replace(/\D/g, "").slice(-10)}`, email: profile?.email ?? undefined, address: mode === "porter" ? address : null },
        lines: lines.map((l) => ({ menuItemId: l.item.id, qty: l.qty })),
        paymentMode: online ? "online" : "pay_later",
        deliveryProvider: mode,
        notes: notes || undefined,
      });
      if (mode === "porter" && profile && !profile.addresses?.some((a) => a.line1 === address.line1))
        await updateDoc(doc(db, "users", profile.uid), { addresses: arrayUnion(JSON.parse(JSON.stringify(address))) }).catch(() => {});
      clear();
      if (order.checkout) {
        // Hand over to Razorpay; whether they pay or close it, the order page shows the right state.
        setCartOpen(false);
        const result = await payWithRazorpay({
          ...order.checkout,
          orderId: order.id,
          orderNo: order.orderNo,
          prefill: { name, email: profile?.email ?? undefined, contact: phone.replace(/\D/g, "").slice(-10) },
        }).catch(() => "dismissed" as const);
        router.push(`/account/orders/${order.id}${result === "paid" ? "?placed=1" : ""}`);
        return;
      }
      setCartOpen(false);
      router.push(`/account/orders/${order.id}?placed=1`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-2xl border-0 bg-cream-100 px-4 py-3 text-[15px] ring-1 ring-ink/10 outline-none focus:ring-2 focus:ring-leaf-500";

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal aria-label="Your bowl">
      <div ref={shade} className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
      <div
        ref={panel}
        className="absolute inset-x-0 bottom-0 flex max-h-[92svh] flex-col rounded-t-[2rem] bg-cream-50 pb-[env(safe-area-inset-bottom)] shadow-2xl lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:max-h-none lg:w-full lg:max-w-md lg:rounded-none lg:pb-0"
      >
        <div
          className="flex touch-none justify-center pt-3 pb-1 lg:hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-hidden
        >
          <span className="h-1.5 w-12 rounded-full bg-ink/15" />
        </div>
        <div
          className="flex touch-none items-center justify-between border-b border-ink/5 px-6 pt-2 pb-4 lg:touch-auto lg:py-5"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div>
            <h2 className="font-display text-2xl font-medium">{step === "bag" ? "Your bowl" : "Almost there"}</h2>
            <p className="text-sm text-ink/50">{count} item{count === 1 ? "" : "s"}</p>
          </div>
          <button onClick={() => setCartOpen(false)} className="grid size-10 place-items-center rounded-full bg-ink/5 hover:bg-ink/10" aria-label="Close cart">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {lines.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <DishImage id="chana-moong" className="mx-auto w-32 opacity-80" />
                <p className="mt-4 font-display text-xl">Your bowl is empty</p>
                <button className="mt-4 text-sm font-semibold text-leaf-600 underline" onClick={() => { setCartOpen(false); router.push("/#menu"); }}>
                  Browse the menu
                </button>
              </div>
            </div>
          ) : step === "bag" ? (
            <ul className="space-y-4">
              {lines.map(({ item, qty }) => (
                <li key={item.id} data-line className="flex items-center gap-4">
                  <DishImage id={item.id} src={item.imageUrl} className="size-16 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium leading-tight">{item.name}</div>
                    <div className="text-sm text-ink/50">{inr(item.price)}</div>
                  </div>
                  <div className="flex items-center rounded-full bg-white ring-1 ring-ink/10">
                    <button className="grid size-9 place-items-center" onClick={() => add(item.id, -1)} aria-label={`Remove one ${item.name}`}>−</button>
                    <span className="w-5 text-center text-sm font-semibold tabular-nums">{qty}</span>
                    <button className="grid size-9 place-items-center" onClick={() => add(item.id, 1)} aria-label={`Add one ${item.name}`}>+</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : !user ? (
            <div className="rounded-3xl bg-lime-300/50 p-6 text-center">
              <p className="font-display text-xl">Sign in to place your order</p>
              <p className="mt-2 text-sm text-ink/60">Use Google or your mobile number — it takes 20 seconds.</p>
              <Link href="/login?next=/%23menu" className="mt-5 inline-flex rounded-full bg-leaf-700 px-6 py-3 font-semibold text-cream-50">Sign in</Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-1 rounded-full bg-ink/5 p-1 text-sm font-semibold">
                {(["porter", "pickup"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)} className={`rounded-full py-2.5 transition ${mode === m ? "bg-white shadow" : "text-ink/60"}`}>
                    {m === "porter" ? "Delivery" : "Pickup"}
                  </button>
                ))}
              </div>
              <input className={field} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              <input className={field} placeholder="Mobile number" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
              {mode === "porter" && <AddressForm value={address} onChange={setAddress} allowGeo />}
              <input className={field} placeholder="Anything for the kitchen? (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-semibold">Payment</legend>
                {([
                  ["online", "Pay online", "UPI, cards, netbanking & wallets via Razorpay"],
                  ["pay_later", mode === "pickup" ? "Pay at pickup" : "Pay on delivery", "UPI or cash"],
                ] as const)
                  .filter(([k]) => k !== "online" || !!menu.razorpayKeyId)
                  .map(([k, title, sub]) => (
                    <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 ring-1 transition-colors ${(menu.razorpayKeyId ? payMode : "pay_later") === k ? "bg-lime-300/40 ring-leaf-600" : "bg-cream-100 ring-ink/10"}`}>
                      <input type="radio" name="pay" className="accent-leaf-700" checked={(menu.razorpayKeyId ? payMode : "pay_later") === k} onChange={() => setPayMode(k)} />
                      <span>
                        <span className="block text-sm font-semibold">{title}</span>
                        <span className="block text-xs text-ink/50">{sub}</span>
                      </span>
                    </label>
                  ))}
              </fieldset>
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="border-t border-ink/5 bg-white px-6 pt-4 pb-6">
            <dl className="space-y-1 text-sm text-ink/60">
              <div className="flex justify-between"><dt>Items</dt><dd className="tabular-nums">{inr(bill.subtotal)}</dd></div>
              {bill.packagingCharge > 0 && <div className="flex justify-between"><dt>Packaging</dt><dd className="tabular-nums">{inr(bill.packagingCharge)}</dd></div>}
              {bill.deliveryCharge > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd className="tabular-nums">{inr(bill.deliveryCharge)}</dd></div>}
              <div className="flex justify-between"><dt>GST</dt><dd className="tabular-nums">{inr(bill.cgst + bill.sgst)}</dd></div>
              <div className="flex justify-between pt-2 text-lg font-semibold text-ink"><dt>To pay</dt><dd className="tabular-nums">{inr(bill.total)}</dd></div>
            </dl>
            {err && <p className="mt-3 rounded-xl bg-tomato/10 px-3 py-2 text-sm text-tomato">{err}</p>}
            {step === "bag" ? (
              <button onClick={() => setStep("details")} disabled={!menu.acceptingOrders} className="mt-4 w-full rounded-full bg-leaf-700 py-4 font-semibold text-cream-50 transition hover:bg-leaf-800 disabled:opacity-50">
                {menu.acceptingOrders ? "Checkout" : "Kitchen closed right now"}
              </button>
            ) : (
              <div className="mt-4 flex gap-2">
                <button onClick={() => setStep("bag")} className="rounded-full px-5 py-4 font-semibold text-ink/60 hover:bg-ink/5">Back</button>
                {user && (
                  <button onClick={place} disabled={busy} className="flex-1 rounded-full bg-leaf-700 py-4 font-semibold text-cream-50 transition hover:bg-leaf-800 disabled:opacity-60">
                    {busy ? "Placing order…" : payMode === "online" && menu.razorpayKeyId ? `Pay ${inr(bill.total)}` : `Place order · ${inr(bill.total)}`}
                  </button>
                )}
              </div>
            )}
            <p className="mt-3 text-center text-xs text-ink/40">{menu.razorpayKeyId ? "Secure payments by Razorpay, or pay when your bowl arrives." : "Pay by UPI or cash when your bowl arrives."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
