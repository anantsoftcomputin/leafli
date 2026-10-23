"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Home, ShoppingBag, Sparkles, User } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { useAuth } from "@/components/AuthProvider";
import { useSite } from "./SiteContext";

type Tab = { href: string; label: string; icon: typeof Home; match: (p: string) => boolean };

/**
 * Floating bottom navigation for phones: a dark glass pill where the active tab
 * expands to show its label, plus a lime "Bowl" button with the live item count.
 * It tucks away while scrolling down and comes back on scroll up, at the top
 * and at the end of the page.
 */
export function MobileTabBar() {
  const path = usePathname();
  const { user } = useAuth();
  const { count, setCartOpen, setCartTarget } = useSite();
  const bowl = useRef<HTMLButtonElement>(null);
  const badge = useRef<HTMLSpanElement>(null);
  const [tapped, setTapped] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setTapped(null);
    setHidden(false);
  }, [path]);

  const tabs: Tab[] = [
    { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
    { href: "/menu", label: "Menu", icon: BookOpen, match: (p) => p.startsWith("/menu") },
    { href: "/plans", label: "Plans", icon: Sparkles, match: (p) => p.startsWith("/plans") },
    { href: user ? "/account" : "/login?next=/account", label: user ? "Account" : "Sign in", icon: User, match: (p) => p.startsWith("/account") || p.startsWith("/login") },
  ];

  // On phones the "fly to cart" animation should land on the bowl button.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => mq.matches && setCartTarget(bowl.current);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [setCartTarget]);

  // Hide while scrolling down, reveal on scroll up / near the top / at the end.
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - last;
        if (Math.abs(dy) < 6) return;
        const atEnd = y + window.innerHeight >= document.documentElement.scrollHeight - 80;
        setHidden(dy > 0 && y > 120 && !atEnd);
        last = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Let bars pinned above the tab bar (buy bar, install banner) follow it down.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-tabbar-hidden", hidden);
    return () => document.documentElement.removeAttribute("data-tabbar-hidden");
  }, [hidden]);

  useGSAP(
    () => {
      if (count && badge.current) gsap.fromTo(badge.current, { scale: 0.3 }, { scale: 1, duration: 0.6, ease: "elastic.out(1.2, 0.4)" });
    },
    { dependencies: [count] },
  );

  return (
    <nav
      aria-label="Primary"
      className={`no-print fixed inset-x-3 bottom-[calc(10px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-2 transition-[translate,opacity] duration-400 ease-[cubic-bezier(.2,.8,.2,1)] lg:hidden ${hidden ? "pointer-events-none translate-y-[calc(100%+24px)] opacity-0" : ""}`}
    >
      <div className="flex h-16 min-w-0 flex-1 items-center gap-1 rounded-full bg-leaf-950/88 p-1.5 shadow-[0_12px_40px_-8px_rgba(10,32,16,.55)] ring-1 ring-white/10 backdrop-blur-xl backdrop-saturate-150">
        {tabs.map((t) => {
          const active = tapped ? tapped === t.href : t.match(path);
          const Icon = t.icon;
          return (
            <Link
              key={t.label}
              href={t.href}
              aria-label={t.label}
              aria-current={active ? "page" : undefined}
              data-active={active}
              onClick={() => !t.match(path) && setTapped(t.href)}
              style={{ flexGrow: active ? 2.2 : 1 }}
              className={`tap relative flex h-full min-w-0 basis-0 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-[flex-grow,background-color,color] duration-400 ease-[cubic-bezier(.2,.8,.2,1)] ${active ? "bg-lime-400 text-leaf-950" : "text-cream-50/60 active:bg-white/10"}`}
            >
              <Icon className="size-[21px] shrink-0" strokeWidth={active ? 2.3 : 1.8} />
              <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-400 ${active ? "max-w-20 opacity-100" : "max-w-0 opacity-0"}`}>{t.label}</span>
              <PendingDot />
            </Link>
          );
        })}
      </div>
      <button
        ref={bowl}
        onClick={() => setCartOpen(true)}
        aria-label={`Open your bowl, ${count} item${count === 1 ? "" : "s"}`}
        className="tap relative grid size-16 shrink-0 place-items-center rounded-full bg-lime-400 text-leaf-950 shadow-[0_12px_40px_-8px_rgba(10,32,16,.55)] ring-1 ring-black/5"
      >
        <ShoppingBag className="size-6" strokeWidth={2.1} />
        {count > 0 && (
          <span ref={badge} className="absolute -top-1 -right-1 grid min-w-6 place-items-center rounded-full bg-leaf-950 px-1.5 text-xs leading-6 font-bold text-lime-300 ring-2 ring-cream-50">
            {count}
          </span>
        )}
      </button>
    </nav>
  );
}

/** Small spinner on a tab while its page is loading (Next.js link status). */
function PendingDot() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span aria-hidden className="absolute top-1.5 right-2 size-2.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />;
}
