"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import type { Testimonial } from "@/lib/types";

const SOURCE = { google: "Google review", zomato: "Zomato review", instagram: "Instagram", direct: "Leafli customer" } as const;

/** Real customer quotes managed in Admin → Testimonials. Drifts slowly; pauses on hover. */
export function Testimonials({ items }: { items: Testimonial[] }) {
  const root = useRef<HTMLElement>(null);
  const loop = items.length >= 3;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from("[data-t-head] > *", { y: 40, opacity: 0, stagger: 0.1, duration: 1, ease: "expo.out", scrollTrigger: { trigger: root.current, start: "top 75%" } });
        if (!loop) {
          gsap.from("[data-t-card]", { y: 50, opacity: 0, stagger: 0.12, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: root.current, start: "top 70%" } });
          return;
        }
        const tween = gsap.to("[data-t-track]", { xPercent: -50, duration: items.length * 9, ease: "none", repeat: -1 });
        const track = root.current!.querySelector("[data-t-track]")!;
        const pause = () => tween.pause();
        const play = () => tween.play();
        track.addEventListener("mouseenter", pause);
        track.addEventListener("mouseleave", play);
        return () => {
          track.removeEventListener("mouseenter", pause);
          track.removeEventListener("mouseleave", play);
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  const cards = loop ? [...items, ...items] : items;
  return (
    <section ref={root} className="overflow-hidden bg-leaf-800 py-24 text-cream-50 md:py-32" aria-labelledby="t-h">
      <div data-t-head className="mx-auto mb-14 max-w-7xl px-5 sm:px-8">
        <p className="mb-4 text-sm font-semibold tracking-[0.2em] text-lime-400 uppercase">Happy moods</p>
        <h2 id="t-h" className="max-w-3xl font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.95] font-medium tracking-[-0.03em]">
          What our regulars <em className="text-lime-300 italic">say.</em>
        </h2>
      </div>
      <div className={loop ? "" : "mx-auto max-w-7xl px-5 sm:px-8"}>
        <ul data-t-track className={loop ? "flex w-max gap-5 pl-5" : "grid gap-5 md:grid-cols-2"}>
          {cards.map((t, i) => (
            <li key={`${t.id}-${i}`} data-t-card aria-hidden={i >= items.length || undefined} className="flex w-[22rem] shrink-0 flex-col rounded-[1.75rem] bg-white/8 p-7 ring-1 ring-white/10 backdrop-blur md:w-[26rem]">
              <div className="text-lime-300" aria-label={`${t.rating} out of 5`}>{"★".repeat(t.rating)}<span className="text-white/20">{"★".repeat(5 - t.rating)}</span></div>
              <blockquote className="mt-4 flex-1 font-display text-xl leading-snug">“{t.quote}”</blockquote>
              <figcaption className="mt-6 text-sm">
                <b>{t.name}</b>
                <span className="text-cream-50/55">{[t.location, t.dish && `ordered ${t.dish}`].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>
                <span className="block text-xs text-cream-50/40">{SOURCE[t.source ?? "direct"]}</span>
              </figcaption>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
