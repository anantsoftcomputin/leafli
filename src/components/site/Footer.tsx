"use client";

import Link from "next/link";
import { useRef } from "react";
import { gsap, MOTION_OK, SplitText, useGSAP } from "@/lib/gsap";
import { Logo } from "@/components/brand/Logo";
import { DishImage } from "./DishImage";

export function ClosingCta() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const split = SplitText.create(q("[data-cta-title]"), { type: "chars", mask: "chars" });
        gsap.from(split.chars, { yPercent: 120, stagger: 0.02, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: root.current, start: "top 70%" } });
        q("[data-orbit]").forEach((el, i) => {
          gsap.to(el, { rotate: i % 2 ? -360 : 360, duration: 60 + i * 12, repeat: -1, ease: "none" });
          gsap.fromTo(el, { yPercent: 30 }, { yPercent: -30, ease: "none", scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: true } });
        });
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: root },
  );
  return (
    <section ref={root} className="relative overflow-hidden bg-lime-400 py-28 text-leaf-900 md:py-40">
      <div data-orbit className="pointer-events-none absolute -top-16 -left-20 w-64 opacity-90 md:w-96"><DishImage id="caprese" /></div>
      <div data-orbit className="pointer-events-none absolute -right-16 -bottom-24 w-64 opacity-90 md:w-[26rem]"><DishImage id="chocolate-fruit-bowl" /></div>
      <div className="relative mx-auto max-w-4xl px-5 text-center">
        <h2 data-cta-title className="font-display text-[clamp(3rem,10vw,8rem)] leading-[0.9] font-medium tracking-[-0.04em]">
          Hungry yet?
        </h2>
        <p className="mx-auto mt-6 max-w-md text-lg text-leaf-900/75">Your next good mood is one bowl away.</p>
        <Link href="#menu" className="group mt-10 inline-flex items-center gap-3 rounded-full bg-leaf-800 py-4 pr-4 pl-8 text-lg font-semibold text-cream-50 shadow-2xl shadow-leaf-900/30 transition hover:bg-leaf-900">
          Build my order
          <span className="grid size-9 place-items-center rounded-full bg-lime-400 text-leaf-900 transition-transform duration-300 group-hover:-rotate-45">→</span>
        </Link>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-leaf-950 pt-20 pb-10 text-cream-50/70">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo tone="light" className="h-20" />
          <p className="mt-5 max-w-xs font-display text-2xl leading-snug text-cream-50 italic">Fresh bowls. Happy moods.</p>
          <a href="https://www.instagram.com/leafli.in" target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm text-lime-300 hover:underline">@leafli.in on Instagram ↗</a>
        </div>
        <div>
          <h3 className="mb-4 text-xs font-semibold tracking-[0.2em] text-lime-400 uppercase">Explore</h3>
          <ul className="space-y-2">
            <li><Link href="/#bowls" className="hover:text-cream-50">Our bowls</Link></li>
            <li><Link href="/#menu" className="hover:text-cream-50">Menu</Link></li>
            <li><Link href="/#how" className="hover:text-cream-50">How it works</Link></li>
            <li><Link href="/account" className="hover:text-cream-50">My orders</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-xs font-semibold tracking-[0.2em] text-lime-400 uppercase">Also on</h3>
          <ul className="space-y-2">
            <li><a href="https://www.zomato.com" target="_blank" rel="noreferrer" className="hover:text-cream-50">Zomato ↗</a></li>
          </ul>
          <p className="mt-6 text-sm">Allergen information is listed on every dish. Please tell us about any allergies before ordering.</p>
        </div>
      </div>
      <div className="mx-auto mt-16 flex max-w-7xl flex-wrap justify-between gap-4 border-t border-white/10 px-5 pt-6 text-xs sm:px-8">
        <span>© {new Date().getFullYear()} Leafli. All rights reserved.</span>
        <Link href="/login" className="hover:text-cream-50">Team login</Link>
      </div>
    </footer>
  );
}
