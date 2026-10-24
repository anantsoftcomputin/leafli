"use client";

import Link from "next/link";
import { Suspense, use, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { rupees as inr } from "@/lib/costing";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { useLiveDoc } from "@/lib/hooks";
import { awaitingPayment, ORDER_FLOW, type Order } from "@/lib/types";
import { api } from "@/lib/api";
import { payWithRazorpay } from "@/lib/razorpay-client";
import { useSite } from "@/components/site/SiteContext";
import { useAuth } from "@/components/AuthProvider";
import { LeafMark } from "@/components/brand/Logo";
import { DishImage } from "@/components/site/DishImage";
import { PushOptIn } from "@/components/pwa/PushOptIn";
import { ReviewModal } from "@/components/site/ReviewModal";

const LABEL: Record<string, { t: string; d: string }> = {
  new: { t: "Order placed", d: "We've got it — the kitchen is reviewing your order." },
  accepted: { t: "Confirmed", d: "Your bowl is in the queue." },
  preparing: { t: "Being prepared", d: "Fresh greens, weighed and assembled to order." },
  ready: { t: "Packed & ready", d: "Sealed, with dressings on the side." },
  dispatched: { t: "On the way", d: "Your rider is heading over." },
  delivered: { t: "Delivered", d: "Enjoy! Toss it right before you eat." },
};

function paymentLabel(o: Order) {
  const refunded = o.payment?.refundedAmount ?? 0;
  if (refunded > 0) return `Refunded ${inr(refunded)}${o.payment?.refundStatus === "processed" ? "" : " (on its way)"}`;
  if (o.paymentStatus === "paid") return o.payment?.method ? `Paid via ${o.payment.method.toUpperCase()}` : "Paid";
  return o.paymentMode === "online" ? "Payment pending" : "Pay on delivery";
}

function refundNote(o: Order) {
  const r = o.payment?.refundedAmount ?? 0;
  if (r > 0 && o.payment?.refundStatus === "processed") return `${inr(r)} has been refunded to your original payment method.`;
  if (r > 0) return `Your refund of ${inr(r)} is on its way — banks usually take 5–7 working days.`;
  return o.paymentStatus === "paid" || o.paymentStatus === "refunded" ? "Your payment will be refunded." : "You haven't been charged.";
}

function Track({ id }: { id: string }) {
  const { user } = useAuth();
  const placed = useSearchParams().get("placed") === "1";
  const { data: o, loading } = useLiveDoc<Order>(user ? `orders/${id}` : null);
  const root = useRef<HTMLDivElement>(null);
  const { menu } = useSite();
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const pending = !!o && awaitingPayment(o);

  // Paid but the tab closed before we heard back? Ask Razorpay once when the page opens.
  useEffect(() => {
    if (!pending) return;
    api("/api/payments/razorpay/reconcile", { kind: "order", id }).catch(() => {});
  }, [pending, id]);

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
      // Dismissed after paying in another app (UPI intent)? Double-check before showing "pending".
      await api("/api/payments/razorpay/reconcile", { kind: "order", id: o.id }).catch(() => {});
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
        <p className="mt-3 text-lg text-ink/60">{o.status === "cancelled" ? refundNote(o) : LABEL[o.status]?.d}</p>
      </div>

      {o.status !== "cancelled" && o.status !== "delivered" && (
        <div className="mt-8">
          <PushOptIn variant="order" />
        </div>
      )}

      {o.status === "delivered" && <RateOrder order={o} />}

      {awaitingPayment(o) && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] bg-mango/20 px-6 py-5">
          <div>
            <p className="font-semibold">Payment pending</p>
            <p className="text-sm text-ink/60">Your order goes to the kitchen as soon as payment is complete.</p>
            {o.payment?.lastError && !payErr && <p className="mt-1 text-sm text-tomato">Last attempt failed: {o.payment.lastError}</p>}
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
            <p className="mt-1 text-xs text-ink/40">Includes GST · {paymentLabel(o)}</p>
            {o.paymentLink && o.paymentStatus === "pending" && o.status !== "cancelled" && (
              <a href={o.paymentLink.url} className="mt-3 inline-flex rounded-full bg-leaf-700 px-5 py-2 text-sm font-semibold text-cream-50 hover:bg-leaf-800">
                Pay {inr(o.total)} online
              </a>
            )}
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

/** After delivery: one tap on a star opens the review form pre-filled with that rating. */
function RateOrder({ order }: { order: Order }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  return (
    <div className="mt-8 rounded-[1.5rem] bg-leaf-800 px-6 py-6 text-cream-50">
      <p className="font-display text-2xl">How was your bowl?</p>
      <p className="mt-1 text-sm text-cream-50/65">Your review is featured on our home page once approved.</p>
      <div className="mt-4 flex gap-1" onPointerLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`} onPointerEnter={() => setHover(n)} onClick={() => setRating(n)} className="tap p-1">
            <svg viewBox="0 0 24 24" className={`size-9 transition-colors ${(hover || rating) >= n ? "fill-mango" : "fill-white/15"}`}><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
          </button>
        ))}
      </div>
      {rating > 0 && <ReviewModal initialRating={rating} dish={order.lines[0]?.name} orderId={order.id} onClose={() => setRating(0)} />}
    </div>
  );
}
