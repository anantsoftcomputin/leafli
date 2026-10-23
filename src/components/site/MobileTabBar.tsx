"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { BookOpen, Home, ShoppingBag, Sparkles, User } from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { useAuth } from "@/components/AuthProvider";
import { useSite } from "./SiteContext";

type Tab = { href: string; label: string; icon: typeof Home; match: (p: string) => boolean };

/**
 * App-style bottom navigation for phones. The centre "Bowl" button is raised
 * and carries the live item count; a pill slides to the active tab.
 */
export function MobileTabBar() {
  const path = usePathname();
  const { user } = useAuth();
  const { count, setCartOpen, setCartTarget } = useSite();
  const bar = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const bowl = useRef<HTMLButtonElement>(null);
  const badge = useRef<HTMLSpanElement>(null);

  const left: Tab[] = [
    { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
    { href: "/menu", label: "Menu", icon: BookOpen, match: (p) => p.startsWith("/menu") },
  ];
  const right: Tab[] = [
    { href: "/plans", label: "Plans", icon: Sparkles, match: (p) => p.startsWith("/plans") },
    { href: user ? "/account" : "/login?next=/account", label: user ? "Account" : "Sign in", icon: User, match: (p) => p.startsWith("/account") },
  ];

  // On phones the "fly to cart" animation should land on the bowl button.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => mq.matches && setCartTarget(bowl.current);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [setCartTarget]);

  // Slide the indicator under the active tab.
  useGSAP(
    () => {
      const active = bar.current?.querySelector<HTMLElement>("[data-active='true']");
      if (!active || !pill.current) {
        gsap.to(pill.current, { opacity: 0, duration: 0.2 });
        return;
      }
      const r = active.getBoundingClientRect();
      const b = bar.current!.getBoundingClientRect();
      gsap.to(pill.current, { x: r.left - b.left + r.width / 2 - 20, opacity: 1, duration: 0.5, ease: "elastic.out(1, 0.75)" });
    },
    { dependencies: [path, user?.uid], scope: bar },
  );

  useGSAP(
    () => {
      if (count && badge.current) gsap.fromTo(badge.current, { scale: 0.3 }, { scale: 1, duration: 0.6, ease: "elastic.out(1.2, 0.4)" });
    },
    { dependencies: [count] },
  );

  const item = (t: Tab) => {
    const active = t.match(path);
    const Icon = t.icon;
    return (
      <Link
        key={t.label}
        href={t.href}
        data-active={active}
        aria-current={active ? "page" : undefined}
        className={`tap flex flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1 text-[11px] font-semibold ${active ? "text-leaf-800" : "text-ink/45"}`}
      >
        <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.8} />
        {t.label}
      </Link>
    );
  };

  return (
    <nav
      ref={bar}
      aria-label="Primary"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-ink/5 bg-cream-50/92 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(16,35,26,.08)] backdrop-blur-xl lg:hidden"
    >
      <span ref={pill} aria-hidden className="pointer-events-none absolute top-0 left-0 h-[3px] w-10 rounded-b-full bg-lime-500 opacity-0" />
      <div className="relative mx-auto flex h-[68px] max-w-md items-stretch px-2">
        {left.map(item)}
        <div className="flex flex-1 justify-center">
          <button
            ref={bowl}
            onClick={() => setCartOpen(true)}
            aria-label={`Open your bowl, ${count} item${count === 1 ? "" : "s"}`}
            className="tap relative -mt-6 grid size-16 place-items-center rounded-full bg-leaf-700 text-cream-50 shadow-xl shadow-leaf-900/30 ring-[6px] ring-cream-50"
          >
            <ShoppingBag className="size-6" strokeWidth={2} />
            {count > 0 && (
              <span ref={badge} className="absolute -top-0.5 -right-0.5 grid min-w-6 place-items-center rounded-full bg-lime-400 px-1.5 text-xs leading-6 font-bold text-leaf-900 ring-2 ring-cream-50">
                {count}
              </span>
            )}
          </button>
        </div>
        {right.map(item)}
      </div>
    </nav>
  );
}
