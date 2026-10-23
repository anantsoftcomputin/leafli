"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { rupees } from "@/lib/costing";
import { useSite } from "./SiteContext";

/**
 * Sticky "View bowl" pill. The header hides while scrolling down, so once
 * something is in the bowl this keeps checkout one tap away.
 */
export function FloatingCart() {
  const ref = useRef<HTMLButtonElement>(null);
  const { count, cart, menu, setCartOpen, cartOpen } = useSite();
  const total = menu.items.reduce((s, i) => s + (cart[i.id] ?? 0) * i.price, 0);
  const show = count > 0 && !cartOpen;

  // Initial state lives in GSAP (not inline CSS) so it owns the whole transform.
  useGSAP(() => {
    gsap.set(ref.current, { xPercent: -50, yPercent: 160, y: 0, autoAlpha: 0 });
  });

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      gsap.to(ref.current, {
        yPercent: show ? 0 : 160,
        autoAlpha: show ? 1 : 0,
        duration: reduce ? 0 : show ? 0.7 : 0.35,
        ease: show ? "elastic.out(1, 0.7)" : "power2.in",
      });
    },
    { dependencies: [show] },
  );

  return (
    <button
      ref={ref}
      onClick={() => setCartOpen(true)}
      style={{ visibility: "hidden" }}
      className="fixed bottom-5 left-1/2 z-30 hidden lg:flex w-[min(26rem,calc(100%-2rem))] items-center justify-between rounded-full bg-leaf-700 py-2.5 pr-2.5 pl-6 text-cream-50 shadow-2xl shadow-leaf-900/30 transition-colors hover:bg-leaf-800"
      aria-label={`View bowl, ${count} items`}
    >
      <span className="font-semibold">
        {count} item{count === 1 ? "" : "s"} · {rupees(total)}
      </span>
      <span className="rounded-full bg-lime-400 px-4 py-2 text-sm font-bold text-leaf-900">View bowl →</span>
    </button>
  );
}
