"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, SplitText, useGSAP } from "@/lib/gsap";

// Every promise here comes straight from the Leafli kitchen SOPs.
const PROMISES = [
  {
    stat: "0",
    unit: "soggy leaves",
    title: "Dressings travel separately",
    body: "Caesar, pesto, mango-chilli and Ghibriche go in their own sealed cups. Croutons and granola go on last, so they still crunch.",
    color: "bg-lime-300",
  },
  {
    stat: "4",
    unit: "°C or colder",
    title: "Cold from prep to door",
    body: "Sauces and cut produce are kept chilled and labelled with their prep time and use-by. Nothing goes out past its date.",
    color: "bg-[#ffd9c9]",
  },
  {
    stat: "165",
    unit: "grams, exactly",
    title: "Weighed, not eyeballed",
    body: "Every component is weighed to the gram, so the bowl you love on Monday tastes the same on Friday.",
    color: "bg-[#ffe7a8]",
  },
  {
    stat: "13",
    unit: "small-batch preps",
    title: "Sauces made in-house",
    body: "Dressings, pesto and slow-roasted potatoes are made in small dated batches, following our own recipes.",
    color: "bg-[#e6dcf5]",
  },
];

export function PromiseSection() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.set(q("[data-reveal]"), { visibility: "visible" });
        const split = SplitText.create(q("[data-big]"), { type: "words", mask: "words" });
        // Big statement: words light up as you scroll through.
        gsap.fromTo(split.words, { opacity: 0.15 }, { opacity: 1, stagger: 0.1, ease: "none", scrollTrigger: { trigger: q("[data-big]")[0], start: "top 80%", end: "bottom 45%", scrub: true } });

        q("[data-promise]").forEach((card, i) => {
          gsap.from(card, { y: 80, rotate: i % 2 ? 3 : -3, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: card, start: "top 88%" } });
          const num = card.querySelector<HTMLElement>("[data-count]");
          if (num) {
            const end = Number(num.dataset.count);
            const o = { v: 0 };
            gsap.to(o, { v: end, duration: 1.6, ease: "power2.out", scrollTrigger: { trigger: card, start: "top 80%" }, onUpdate: () => (num.textContent = String(Math.round(o.v))) });
          }
        });
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section id="promise" ref={root} className="relative bg-cream-50 py-24 md:py-36">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <p className="mb-6 text-sm font-semibold tracking-[0.2em] text-leaf-600 uppercase">The Leafli promise</p>
        <h2 data-big className="max-w-5xl font-display text-[clamp(2rem,4.6vw,4rem)] leading-[1.05] font-medium tracking-[-0.025em]">
          We run our kitchen on written recipes, timers and thermometers — so your lunch is fresh, safe, and exactly as good as last time.
        </h2>
        <div className="no-scrollbar -mx-5 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 lg:mt-24 lg:grid-cols-4">
          {PROMISES.map((p) => (
            <article key={p.title} data-reveal data-promise className={`flex w-[80vw] shrink-0 snap-center flex-col rounded-[1.75rem] p-7 sm:w-auto ${p.color}`}>
              <div className="flex items-baseline gap-2">
                <span data-count={p.stat} className="font-display text-6xl font-semibold tracking-tight tabular-nums">
                  {p.stat}
                </span>
                <span className="text-sm font-medium text-ink/60">{p.unit}</span>
              </div>
              <h3 className="mt-10 font-display text-xl font-medium">{p.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink/70">{p.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
