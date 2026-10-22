"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { LeafMark } from "@/components/brand/Logo";

const WORDS = ["Crisp greens", "Dressings on the side", "Small-batch sauces", "Weighed to the gram", "Packed to travel", "Made fresh daily"];

/** Infinite ticker that speeds up and reverses with scroll velocity. */
export function Marquee({ tone = "dark" }: { tone?: "dark" | "lime" }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const track = root.current!.querySelector("[data-track]")!;
        const loop = gsap.to(track, { xPercent: -50, duration: 32, ease: "none", repeat: -1 });
        let dir = 1;
        ScrollTrigger.create({
          trigger: root.current,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            if (self.direction !== dir) {
              dir = self.direction;
            }
            const v = Math.min(Math.abs(self.getVelocity()) / 300, 6);
            gsap.to(loop, { timeScale: dir * (1 + v), duration: 0.2, overwrite: true });
            gsap.to(loop, { timeScale: dir, duration: 1.2, delay: 0.25 });
          },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  const items = [...WORDS, ...WORDS];
  return (
    <div
      ref={root}
      className={`relative z-10 -rotate-1 overflow-hidden py-5 ${tone === "dark" ? "bg-leaf-700 text-cream-50" : "bg-lime-400 text-leaf-900"}`}
      aria-label={WORDS.join(", ")}
    >
      <div data-track className="flex w-max items-center gap-10 pr-10 whitespace-nowrap" aria-hidden>
        {items.map((w, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-3xl font-medium tracking-tight md:text-4xl">
            {w}
            <LeafMark className={`size-7 ${tone === "dark" ? "text-lime-400 [--logo-vein:#255f30]" : "text-leaf-700"}`} />
          </span>
        ))}
      </div>
    </div>
  );
}
