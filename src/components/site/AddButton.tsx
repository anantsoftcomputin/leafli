"use client";

import { useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useSite, type PublicItem } from "./SiteContext";

/**
 * Add-to-bowl button. On add, a little green pea arcs from the button into
 * the cart in the header; once in the cart it becomes a − / + stepper.
 */
export function AddButton({ item, accent = "#1f4d33", size = "md" }: { item: PublicItem; accent?: string; size?: "md" | "sm" }) {
  const { cart, add, cartTarget, menu } = useSite();
  const btn = useRef<HTMLButtonElement>(null);
  const qty = cart[item.id] ?? 0;
  const disabled = !item.available;

  function fly() {
    add(item.id, 1);
    const from = btn.current?.getBoundingClientRect();
    const to = cartTarget?.getBoundingClientRect();
    if (!from || !to || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dot = document.createElement("div");
    dot.style.cssText = `position:fixed;z-index:60;left:${from.left + from.width / 2 - 10}px;top:${from.top + from.height / 2 - 10}px;width:20px;height:20px;border-radius:999px;background:#a9cf3c;box-shadow:0 0 0 4px #fff;pointer-events:none`;
    document.body.appendChild(dot);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    gsap
      .timeline({ onComplete: () => dot.remove() })
      .to(dot, { x: dx, duration: 0.75, ease: "power1.inOut" }, 0)
      .to(dot, { y: Math.min(dy, -80) - 60, duration: 0.35, ease: "power2.out" }, 0)
      .to(dot, { y: dy, duration: 0.4, ease: "power2.in" }, 0.35)
      .to(dot, { scale: 0.3, opacity: 0.6, duration: 0.2 }, 0.6);
    if (cartTarget) gsap.fromTo(cartTarget, { scale: 1 }, { scale: 1.12, yoyo: true, repeat: 1, duration: 0.15, delay: 0.7 });
  }

  const pad = size === "sm" ? "h-9 text-sm sm:h-10" : "h-12 text-[15px]";
  if (disabled) return <span className={`inline-flex items-center rounded-full px-4 text-sm font-semibold opacity-60 ${pad}`}>Sold out</span>;
  if (!menu.acceptingOrders && qty === 0)
    return <span className={`inline-flex items-center rounded-full px-4 text-sm font-semibold opacity-70 ${pad}`}>Opening soon</span>;

  if (qty > 0)
    return (
      <div className={`inline-flex items-center rounded-full font-semibold text-white ${pad}`} style={{ background: accent }}>
        <button className="grid h-full w-11 place-items-center rounded-l-full transition hover:bg-black/10" onClick={() => add(item.id, -1)} aria-label={`Remove one ${item.name}`}>
          −
        </button>
        <span className="w-6 text-center tabular-nums" aria-live="polite">{qty}</span>
        <button ref={btn} className="grid h-full w-11 place-items-center rounded-r-full transition hover:bg-black/10" onClick={fly} aria-label={`Add another ${item.name}`}>
          +
        </button>
      </div>
    );

  return (
    <button
      ref={btn}
      onClick={fly}
      className={`group inline-flex items-center gap-2 rounded-full pr-2 pl-5 font-semibold text-white transition active:scale-95 ${pad}`}
      style={{ background: accent }}
      aria-label={`Add ${item.name} to your bowl`}
    >
      Add
      <span className="grid size-8 place-items-center rounded-full bg-white/20 text-lg leading-none transition-transform duration-300 group-hover:rotate-90">+</span>
    </button>
  );
}
