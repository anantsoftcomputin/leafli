"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, PenLine, Quote, Star } from "lucide-react";
import { gsap, MOTION_OK, SplitText, useGSAP } from "@/lib/gsap";
import type { Testimonial } from "@/lib/types";
import { ReviewModal } from "./ReviewModal";

const SOURCE = { google: "Google review", zomato: "Zomato review", instagram: "Instagram", direct: "Verified Leafli customer" } as const;
const ROTATE_MS = 6000;

function Stars({ n, size = "size-4" }: { n: number; size?: string }) {
  return (
    <span className="flex gap-0.5" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= Math.round(n) ? "fill-mango text-mango" : "fill-white/15 text-white/15"}`} strokeWidth={0} />
      ))}
    </span>
  );
}

/**
 * Homepage testimonials — the social-proof highlight. Real reviews only: customer
 * submissions (approved in Admin → Testimonials) and quotes copied from Google/Zomato.
 * With no reviews yet it invites the first ones instead of hiding.
 */
export function Testimonials({ items, googleUrl, zomatoUrl }: { items: Testimonial[]; googleUrl?: string; zomatoUrl?: string }) {
  const root = useRef<HTMLElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [writing, setWriting] = useState(false);
  const count = items.length;
  const avg = count ? items.reduce((s, t) => s + t.rating, 0) / count : 0;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const split = SplitText.create("[data-t-title]", { type: "words", mask: "words" });
        gsap.from(split.words, { yPercent: 110, stagger: 0.06, duration: 1, ease: "expo.out", scrollTrigger: { trigger: root.current, start: "top 72%" } });
        gsap.from("[data-t-reveal]", { y: 40, opacity: 0, stagger: 0.1, duration: 1, ease: "expo.out", scrollTrigger: { trigger: root.current, start: "top 70%" } });
        gsap.from("[data-t-card]", { y: 60, rotate: -3, opacity: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: root.current, start: "top 65%" } });
        gsap.to("[data-t-glow]", { scale: 1.15, opacity: 0.7, duration: 4, repeat: -1, yoyo: true, ease: "sine.inOut" });
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  const go = useCallback(
    (next: number) => {
      if (!card.current || count < 2) return;
      const n = (next + count) % count;
      const dir = next > i ? 1 : -1;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setI(n);
      gsap
        .timeline()
        .to(card.current, { x: -40 * dir, opacity: 0, duration: 0.3, ease: "power2.in" })
        .call(() => setI(n))
        .fromTo(card.current, { x: 40 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "expo.out" });
    },
    [count, i],
  );

  useEffect(() => {
    if (count < 2 || paused) return;
    const t = setInterval(() => document.visibilityState === "visible" && go(i + 1), ROTATE_MS);
    return () => clearInterval(t);
  }, [count, paused, i, go]);

  // Swipe between reviews on phones.
  const touch = useRef<number | null>(null);
  const t = items[i];

  return (
    <section id="reviews" ref={root} className="relative scroll-mt-16 overflow-hidden bg-leaf-800 py-20 text-cream-50 md:py-32" aria-labelledby="t-h">
      <div data-t-glow aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[36rem] rounded-full bg-lime-400/15 opacity-40 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <div>
          <p data-t-reveal className="mb-4 text-sm font-semibold tracking-[0.2em] text-lime-400 uppercase">Happy moods</p>
          <h2 id="t-h" data-t-title className="font-display text-[clamp(2.6rem,9vw,5rem)] leading-[0.92] font-medium tracking-[-0.03em]">
            Loved by our <em className="text-lime-300 italic">regulars.</em>
          </h2>
          {count > 0 ? (
            <div data-t-reveal className="mt-8 flex items-center gap-4">
              <span className="font-display text-6xl font-semibold text-lime-300">{avg.toFixed(1)}</span>
              <div>
                <Stars n={avg} size="size-5" />
                <p className="mt-1 text-sm text-cream-50/65">from {count} review{count > 1 ? "s" : ""}</p>
              </div>
            </div>
          ) : (
            <p data-t-reveal className="mt-6 max-w-md text-lg leading-relaxed text-cream-50/70">
              We&apos;re a new kitchen and we read every word. Ordered from us? Your review helps other people find fresh, honest food.
            </p>
          )}
          <div data-t-reveal className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => setWriting(true)} className="tap inline-flex items-center gap-2 rounded-full bg-lime-400 px-6 py-3.5 font-semibold text-leaf-900 shadow-lg shadow-black/20">
              <PenLine className="size-4" /> Write a review
            </button>
            {googleUrl && <a href={googleUrl} target="_blank" rel="noreferrer" className="tap rounded-full px-5 py-3.5 font-semibold text-cream-50 ring-1 ring-cream-50/25 hover:bg-white/5">Review us on Google ↗</a>}
            {zomatoUrl && <a href={zomatoUrl} target="_blank" rel="noreferrer" className="tap rounded-full px-5 py-3.5 font-semibold text-cream-50 ring-1 ring-cream-50/25 hover:bg-white/5">See us on Zomato ↗</a>}
          </div>
        </div>

        <div onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
          <div
            data-t-card
            ref={card}
            className="relative rounded-[2rem] bg-cream-50 p-7 text-ink shadow-2xl shadow-black/30 sm:p-10"
            onTouchStart={(e) => (touch.current = e.touches[0]!.clientX)}
            onTouchEnd={(e) => {
              if (touch.current == null) return;
              const dx = e.changedTouches[0]!.clientX - touch.current;
              if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
              touch.current = null;
            }}
          >
            <Quote className="absolute -top-5 left-7 size-12 rounded-2xl bg-lime-400 p-2.5 text-leaf-900 sm:left-10" strokeWidth={2.5} />
            {t ? (
              <figure>
                <div className="mt-2 flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`size-5 ${n <= t.rating ? "fill-mango text-mango" : "fill-ink/10 text-ink/10"}`} strokeWidth={0} />)}
                </div>
                <blockquote className="mt-5 font-display text-[clamp(1.4rem,4.5vw,2rem)] leading-snug">“{t.quote}”</blockquote>
                <figcaption className="mt-8 flex items-center gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-leaf-700 font-display text-lg text-lime-300">{t.name.charAt(0)}</span>
                  <span className="min-w-0">
                    <b className="block">{t.name}</b>
                    <span className="block truncate text-sm text-ink/55">
                      {[t.location, t.dish && `ordered ${t.dish}`].filter(Boolean).join(" · ") || SOURCE[t.source ?? "direct"]}
                    </span>
                    {(t.location || t.dish) && <span className="text-xs text-ink/40">{SOURCE[t.source ?? "direct"]}</span>}
                  </span>
                </figcaption>
              </figure>
            ) : (
              <div className="py-4 text-center">
                <div className="mx-auto flex w-fit gap-1">
                  {[1, 2, 3, 4, 5].map((n) => <Star key={n} className="size-8 fill-mango/25 text-mango" strokeWidth={1.5} />)}
                </div>
                <p className="mt-5 font-display text-3xl leading-tight">Be our first review</p>
                <p className="mx-auto mt-3 max-w-sm text-ink/60">Tried a bowl? Tell us how the freshness, flavours and delivery were — it takes a minute.</p>
                <button onClick={() => setWriting(true)} className="tap mt-6 rounded-full bg-leaf-700 px-6 py-3 font-semibold text-cream-50">Share your experience</button>
              </div>
            )}
          </div>
          {count > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="flex gap-1.5" role="tablist" aria-label="Reviews">
                {items.map((r, k) => (
                  <button key={r.id} role="tab" aria-selected={k === i} aria-label={`Review ${k + 1}`} onClick={() => go(k)} className={`h-2 rounded-full transition-all ${k === i ? "w-7 bg-lime-400" : "w-2 bg-white/25"}`} />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => go(i - 1)} aria-label="Previous review" className="tap grid size-11 place-items-center rounded-full ring-1 ring-white/25 hover:bg-white/10"><ChevronLeft className="size-5" /></button>
                <button onClick={() => go(i + 1)} aria-label="Next review" className="tap grid size-11 place-items-center rounded-full bg-lime-400 text-leaf-900"><ChevronRight className="size-5" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
      {writing && <ReviewModal onClose={() => setWriting(false)} />}
    </section>
  );
}
