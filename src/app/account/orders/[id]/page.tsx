"use client";

import Link from "next/link";
import { Suspense, use, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { rupees as inr } from "@/lib/costing";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { useLiveDoc } from "@/lib/hooks";
import { awaitingPayment, ORDER_FLOW, type Order } from "@/lib/types";
import { payWithRazorpay } from "@/lib/razorpay-client";
import { useSite } from "@/components/site/SiteContext";
import { useAuth } from "@/components/AuthProvider";
import { LeafMark } from "@/components/brand/Logo";
import { DishImage } from "@/components/site/DishImage";

const LABEL: Record<string, { t: string; d: string }> = {
  new: { t: "Order placed", d: "We've got it — the kitchen is reviewing your order." },
  accepted: { t: "Confirmed", d: "Your bowl is in the queue." },
  preparing: { t: "Being prepared", d: "Fresh greens, weighed and assembled to order." },
  ready: { t: "Packed & ready", d: "Sealed, with dressings on the side." },
  dispatched: { t: "On the way", d: "Your rider is heading over." },
  delivered: { t: "Delivered", d: "Enjoy! Toss it right before you eat." },
};

function Track({ id }: { id: string }) {
  const { user } = useAuth();
  const placed = useSearchParams().get("placed") === "1";
  const { data: o, loading } = useLiveDoc<Order>(user ? `orders/${id}` : null);
  const root = useRef<HTMLDivElement>(null);
  const { menu } = useSite();
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const steps = o?.delivery.provider === "pickup" ? ORDER_FLOW.filter((s) => s !== "dispatched") : ORDER_FLOW;
  const at = o ? steps.indexOf(o.status) : -1;

  // Progress bar follows the live status.
  useGSAP(
    () => {
      if (!o || at < 0) return;
      gsap.to("[data-fill]", { scaleY: at / (steps.length - 1), duration: 1, ease: "power3.inOut" });
      gsap.fromTo(`[data-step="${o.status}"] [data-dot]`, { scale: 0.6 }, { scale: 1, duration: 0.8, ease: "elastic.out(1.2, 0.4)" });
    },
    { scope: root, dependencies: [o?.status] },
  );

  // A little burst of leaves when the order has just been placed.
  useGSAP(
    () => {
      if (!placed || !o) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from("[data-hello]", { y: 30, opacity: 0, duration: 0.8, ease: "expo.out" });
        gsap.fromTo(
          "[data-confetti]",
          { x: 0, y: 0, scale: 0, opacity: 1 },
          {
            x: () => gsap.utils.random(-260, 260),
            y: () => gsap.utils.random(-220, 40),
            rotate: () => gsap.utils.random(-260, 260),
            scale: () => gsap.utils.random(0.6, 1.3),
            opacity: 0,
            duration: 1.8,
            ease: "power3.out",
            stagger: 0.01,
          },
        );
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [placed, !!o] },
  );

  if (loading || !o) return <p className="text-ink/50">{loading ? "Loading your order…" : "Order not found."}</p>;

  async function completePayment() {
    if (!o?.payment || !menu.razorpayKeyId) return;
    setPaying(true);
    setPayErr(null);
    try {
      await payWithRazorpay({
        keyId: menu.razorpayKeyId,
        rzpOrderId: o.payment.rzpOrderId,
        amount: Math.round(o.total * 100),
        orderId: o.id,
        orderNo: o.orderNo,
        prefill: { name: o.customer.name, email: o.customer.email, contact: o.customer.phone?.replace("+91", "") },
      });
    } catch (e) {
      setPayErr((e as Error).message);
    } finally {
      setPaying(false);
    }
  }

  return (
    <div ref={root} className="relative">
      {placed && (
        <div className="pointer-events-none absolute top-10 left-1/2" aria-hidden>
          {Array.from({ length: 28 }, (_, i) => (
            <LeafMark key={i} className={`absolute size-6 ${["text-lime-500", "text-leaf-500", "text-mango", "text-tomato"][i % 4]}`} data-confetti="" />
          ))}
        </div>
      )}
      <div data-hello>
        <p className="text-sm font-semibold tracking-[0.2em] text-leaf-600 uppercase">{placed ? "Thank you!" : "Order"} · {o.orderNo}</p>
        <h1 className="mt-2 font-display text-5xl font-medium tracking-tight">
          {o.status === "cancelled" ? "Order cancelled" : LABEL[o.status]?.t}
        </h1>
        <p className="mt-3 text-lg text-ink/60">{o.status === "cancelled" ? "If you were charged, it will be refunded." : LABEL[o.status]?.d}</p>
      </div>

      {awaitingPayment(o) && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] bg-mango/20 px-6 py-5">
          <div>
            <p className="font-semibold">Payment pending</p>
            <p className="text-sm text-ink/60">Your order goes to the kitchen as soon as payment is complete.</p>
            {payErr && <p className="mt-1 text-sm text-tomato">{payErr}</p>}
          </div>
          <button onClick={completePayment} disabled={paying || !menu.razorpayKeyId} className="rounded-full bg-leaf-700 px-6 py-3 font-semibold text-cream-50 transition-colors hover:bg-leaf-800 disabled:opacity-60">
            {paying ? "Opening…" : `Pay ${inr(o.total)}`}
          </button>
        </div>
      )}

      <div className="mt-12 grid gap-8 md:grid-cols-[1fr_1.1fr]">
        {o.status !== "cancelled" && (
          <ol className="relative space-y-7 pl-2">
            <div className="absolute top-3 bottom-3 left-[1.15rem] w-1 rounded-full bg-ink/10">
              <div data-fill className="h-full origin-top scale-y-0 rounded-full bg-leaf-600" />
            </div>
            {steps.map((s, i) => (
              <li key={s} data-step={s} className="relative flex items-start gap-4">
                <span data-dot className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${i <= at ? "bg-leaf-700 text-lime-300" : "bg-white text-ink/30 ring-1 ring-ink/10"}`}>
                  {i < at ? "✓" : i + 1}
                </span>
                <div className={i <= at ? "" : "opacity-40"}>
                  <div className={`font-medium ${i === at ? "text-leaf-700" : ""}`}>{LABEL[s]?.t}</div>
                  {i === at && <div className="text-sm text-ink/50">{new Date(o.updatedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</div>}
                </div>
              </li>
            ))}
          </ol>
        )}
        <div className="space-y-4">
          {o.delivery.trackingUrl && o.status === "dispatched" && (
            <a href={o.delivery.trackingUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-[1.5rem] bg-leaf-700 px-6 py-5 font-semibold text-cream-50">
              Track your rider live <span>↗</span>
            </a>
          )}
          {o.delivery.partnerName && <p className="rounded-2xl bg-white px-5 py-4 text-sm ring-1 ring-ink/5">Rider: <b>{o.delivery.partnerName}</b></p>}
          <div className="rounded-[1.5rem] bg-white p-6 ring-1 ring-ink/5">
            <ul className="space-y-3">
              {o.lines.map((l) => (
                <li key={l.menuItemId} className="flex items-center gap-3">
                  <DishImage id={l.menuItemId} className="size-12" />
                  <span className="flex-1">{l.qty}× {l.name}</span>
                  <span className="tabular-nums">{inr(l.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-between border-t border-ink/5 pt-4 text-lg font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{inr(o.total)}</span>
            </div>
            <p className="mt-1 text-xs text-ink/40">Includes GST · {o.paymentStatus === "paid" ? "Paid" : "Pay on delivery"}</p>
          </div>
          <Link href="/#menu" className="inline-flex text-sm font-semibold text-leaf-600 hover:underline">Order something else →</Link>
        </div>
      </div>
    </div>
  );
}

export default function TrackOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="mx-auto max-w-4xl px-5">
      <Suspense>
        <Track id={id} />
      </Suspense>
    </div>
  );
}
