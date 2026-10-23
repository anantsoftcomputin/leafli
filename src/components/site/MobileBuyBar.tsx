"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";

/**
 * Sticky purchase bar for phones, pinned above the tab bar. It appears once
 * the element with id `watch` (the page's main buy button) scrolls out of view.
 */
export function MobileBuyBar({ watch, children }: { watch: string; children: React.ReactNode }) {
  const bar = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = document.getElementById(watch);
    if (!target) return;
    const io = new IntersectionObserver(([e]) => setShow(!e!.isIntersecting && e!.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(target);
    return () => io.disconnect();
  }, [watch]);

  useEffect(() => {
    if (!bar.current) return;
    gsap.to(bar.current, { yPercent: show ? 0 : 140, autoAlpha: show ? 1 : 0, duration: show ? 0.5 : 0.3, ease: show ? "expo.out" : "power2.in" });
  }, [show]);

  return (
    <div
      ref={bar}
      style={{ visibility: "hidden", transform: "translateY(140%)" }}
      className="fixed inset-x-3 bottom-[calc(var(--tabbar-h)+10px)] z-30 flex items-center justify-between gap-3 rounded-[1.4rem] bg-white/95 p-2.5 pl-4 shadow-2xl shadow-leaf-900/20 ring-1 ring-ink/5 backdrop-blur lg:hidden"
    >
      {children}
    </div>
  );
}
