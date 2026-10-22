"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "@/components/brand/Logo";
import { useSite } from "./SiteContext";

const LINKS = [
  { href: "/#bowls", label: "Bowls" },
  { href: "/#promise", label: "Our promise" },
  { href: "/#how", label: "How it works" },
  { href: "/#menu", label: "Menu" },
];

export function SiteHeader({ solid }: { solid?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const badge = useRef<HTMLSpanElement>(null);
  const cartBtn = useRef<HTMLButtonElement>(null);
  const mobile = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(!!solid);
  const { user, isStaff } = useAuth();
  const { count, setCartOpen, setCartTarget } = useSite();

  useEffect(() => setCartTarget(cartBtn.current), [setCartTarget]);

  // Hide on scroll down, reveal on scroll up; go solid after the hero top.
  useGSAP(
    () => {
      const show = gsap.quickTo(ref.current, "yPercent", { duration: 0.35, ease: "power2.out" });
      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => {
          setScrolled(solid || self.scroll() > 24);
          if (self.scroll() < 120) show(0);
          else show(self.direction === 1 ? -110 : 0);
        },
      });
    },
    { scope: ref },
  );

  // Bounce the badge whenever the cart count changes.
  useGSAP(
    () => {
      if (!count || !badge.current) return;
      gsap.fromTo(badge.current, { scale: 0.4 }, { scale: 1, duration: 0.6, ease: "elastic.out(1.2, 0.4)" });
    },
    { dependencies: [count] },
  );

  // Mobile menu
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        if (!mobile.current) return;
        if (open) {
          gsap.fromTo(mobile.current, { clipPath: "circle(0% at 92% 4%)" }, { clipPath: "circle(150% at 92% 4%)", duration: 0.7, ease: "power3.inOut" });
          gsap.from(mobile.current.querySelectorAll("a"), { y: 40, opacity: 0, stagger: 0.06, delay: 0.25, duration: 0.6 });
        }
      });
      return () => mm.revert();
    },
    { dependencies: [open] },
  );

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header
        ref={ref}
        className={`fixed inset-x-0 top-0 z-40 transition-[background,box-shadow] duration-300 ${scrolled ? "bg-cream-100/85 shadow-[0_1px_0_rgba(16,35,26,.08)] backdrop-blur-xl" : ""}`}
      >
        <div className="mx-auto flex h-18 max-w-7xl items-center gap-6 px-5 sm:px-8">
          <Link href="/" aria-label="Leafli home" className="shrink-0">
            <Logo className="h-14" />
          </Link>
          <nav className="ml-6 hidden items-center gap-7 text-[15px] font-medium text-ink/75 lg:flex">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="group relative py-1 hover:text-ink">
                {l.label}
                <span className="absolute inset-x-0 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-lime-500 transition-transform duration-300 group-hover:scale-x-100" />
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {isStaff && (
              <Link href="/dashboard" className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5 sm:inline-flex">
                Kitchen app
              </Link>
            )}
            <Link
              href={user ? "/account" : "/login?next=/"}
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5 sm:inline-flex"
            >
              {user ? "My orders" : "Sign in"}
            </Link>
            <button
              ref={cartBtn}
              onClick={() => setCartOpen(true)}
              className="group relative inline-flex items-center gap-2 rounded-full bg-leaf-700 py-2.5 pr-4 pl-3.5 text-sm font-semibold text-cream-50 shadow-lg shadow-leaf-900/15 transition hover:bg-leaf-800 active:scale-95"
              aria-label={`Open cart, ${count} items`}
            >
              <svg viewBox="0 0 24 24" className="size-5 transition-transform group-hover:-rotate-12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M3 10h18l-1.6 7.2A3 3 0 0 1 16.5 20h-9a3 3 0 0 1-2.9-2.8L3 10Z" />
                <path d="M7 10c0-3 2.2-6 5-6s5 3 5 6" strokeLinecap="round" />
              </svg>
              Bowl
              <span ref={badge} className="grid min-w-5 place-items-center rounded-full bg-lime-400 px-1 text-xs font-bold text-leaf-900">
                {count}
              </span>
            </button>
            <button className="grid size-10 place-items-center rounded-full hover:bg-ink/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <svg viewBox="0 0 24 24" className="size-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="M4 8h16M4 16h10" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div ref={mobile} className="fixed inset-0 z-50 flex flex-col bg-leaf-800 px-6 pt-5 pb-10 text-cream-50 lg:hidden" role="dialog" aria-modal>
          <div className="flex items-center justify-between">
            <Logo tone="light" className="h-16" />
            <button className="grid size-11 place-items-center rounded-full bg-white/10" onClick={() => setOpen(false)} aria-label="Close menu">
              ✕
            </button>
          </div>
          <nav className="mt-14 flex flex-col gap-3">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="font-display text-5xl font-medium tracking-tight">
                {l.label}
              </Link>
            ))}
            <Link href={user ? "/account" : "/login?next=/"} onClick={() => setOpen(false)} className="mt-6 text-lg text-lime-300">
              {user ? "My orders →" : "Sign in →"}
            </Link>
          </nav>
          <p className="mt-auto font-display text-2xl text-lime-300 italic">Fresh bowls. Happy moods.</p>
        </div>
      )}
    </>
  );
}
