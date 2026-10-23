"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";

const STEPS = [
  { n: "01", title: "Pick your bowl", body: "Browse the menu, check allergens, and add bowls in a couple of taps. Sign in with Google or your phone number." },
  { n: "02", title: "We assemble it fresh", body: "Your order goes straight to the kitchen screen. Bowls are built to order from chilled, dated, small-batch prep." },
  { n: "03", title: "Delivered cold", body: "A Porter rider brings it over in a rigid box with dressings sealed on the side. Track every step live." },
];

export function HowItWorks() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.set(q("[data-reveal]"), { visibility: "visible" });
        const tl = gsap.timeline({ scrollTrigger: { trigger: q("[data-steps]")[0], start: "top 75%", end: "bottom 60%", scrub: 0.6 } });
        tl.from(q("[data-route]"), { drawSVG: "0%", ease: "none", duration: 3 });
        tl.to(q("[data-vline]"), { scaleY: 1, ease: "none", duration: 3 }, 0);
        q("[data-step]").forEach((s, i) => {
          tl.from(s.querySelector("[data-dot]"), { scale: 0, duration: 0.3, ease: "back.out(3)" }, i * 1.1)
            .from(s.querySelectorAll("[data-step-copy] > *"), { y: 30, opacity: 0, stagger: 0.1, duration: 0.5 }, i * 1.1 + 0.1);
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section id="how" ref={root} className="relative overflow-hidden bg-leaf-800 py-24 text-cream-50 md:py-36">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <p className="mb-6 text-sm font-semibold tracking-[0.2em] text-lime-400 uppercase">How it works</p>
        <h2 className="max-w-3xl font-display text-[clamp(2.3rem,8vw,4.4rem)] leading-[0.98] font-medium tracking-[-0.03em]">
          From our board to your desk in <em className="text-lime-300 italic">three</em> easy steps.
        </h2>

        <div data-steps className="relative mt-14 md:mt-20">
          <svg className="absolute -top-[20px] left-0 hidden h-24 w-full md:block" viewBox="0 0 1200 96" preserveAspectRatio="none" aria-hidden>
            <path d="M28 48C180 18 300 78 444 48S760 18 888 48 1100 70 1190 40" stroke="#ffffff22" strokeWidth="2" fill="none" />
            <path data-route d="M28 48C180 18 300 78 444 48S760 18 888 48 1100 70 1190 40" stroke="#c9e665" strokeWidth="3" strokeLinecap="round" fill="none" />
          </svg>
          {/* Phones: a vertical line that fills as you scroll */}
          <div aria-hidden className="absolute top-2 bottom-2 left-7 w-0.5 rounded-full bg-white/10 md:hidden">
            <div data-vline className="h-full origin-top scale-y-0 rounded-full bg-lime-400" />
          </div>
          <ol className="relative grid gap-12 md:grid-cols-3 md:gap-8">
            {STEPS.map((s) => (
              <li key={s.n} data-reveal data-step className="relative">
                <div data-dot className="relative z-10 grid size-14 place-items-center rounded-full bg-lime-400 font-display text-lg font-semibold text-leaf-900 ring-8 ring-leaf-800">
                  {s.n}
                </div>
                <div data-step-copy className="-mt-14 ml-20 max-w-sm md:mt-8 md:ml-0">
                  <h3 className="font-display text-3xl font-medium tracking-tight">{s.title}</h3>
                  <p className="mt-3 leading-relaxed text-cream-50/70">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="pointer-events-none absolute -right-40 -bottom-40 size-[34rem] rounded-full bg-leaf-600/40 blur-3xl" />
    </section>
  );
}
