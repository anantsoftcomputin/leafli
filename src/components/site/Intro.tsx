"use client";

import { useRef, useState } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { Logo } from "@/components/brand/Logo";

/** First-visit curtain: the leaf draws itself, smiles, and the curtain lifts. Once per session. */
export function Intro() {
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useGSAP(
    () => {
      let seen = false;
      try {
        seen = sessionStorage.getItem("leafli-intro") === "1";
        sessionStorage.setItem("leafli-intro", "1");
      } catch {}
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        if (seen) return setDone(true);
        const q = gsap.utils.selector(ref);
        gsap
          .timeline({ onComplete: () => setDone(true) })
          .fromTo(q("[data-word]"), { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 1.1, ease: "power2.inOut" })
          .from(q("[data-word]"), { scale: 0.92, duration: 1.3, ease: "power3.out" }, 0)
          .to(q("[data-mark]"), { y: -24, opacity: 0, duration: 0.3, ease: "power2.in" }, "+=0.2")
          .to(ref.current, { yPercent: -100, duration: 0.75, ease: "expo.inOut" }, "-=0.1")
          .to(q("[data-curtain-edge]"), { scaleY: 0, duration: 0.6, ease: "expo.inOut" }, "<0.15");
      });
      mm.add("(prefers-reduced-motion: reduce)", () => setDone(true));
      return () => mm.revert();
    },
    { scope: ref },
  );

  if (done) return null;
  return (
    <div ref={ref} className="fixed inset-0 z-[100] grid place-items-center bg-lime-400" aria-hidden>
      <div data-mark>
        <div data-word style={{ clipPath: "inset(0 100% 0 0)" }}>
          <Logo className="h-40 sm:h-52" />
        </div>
      </div>
      <div data-curtain-edge className="absolute inset-x-0 -bottom-16 h-16 origin-top rounded-b-[50%] bg-lime-400" />
    </div>
  );
}
