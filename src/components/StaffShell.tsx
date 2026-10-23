"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { where } from "firebase/firestore";
import {
  Bell,
  BookOpenText,
  ChefHat,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  CookingPot,
  ExternalLink,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  MessageSquareQuote,
  Package,
  PenLine,
  Percent,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "@/components/brand/Logo";
import { cx } from "@/components/ui";
import { useLive } from "@/lib/hooks";
import { istDate } from "@/lib/site";
import { isDue } from "@/lib/subscriptions";
import { awaitingPayment, type Order, type Role, type StockItem, type Subscription, type Testimonial } from "@/lib/types";

const ALL: Role[] = ["admin", "manager", "kitchen", "cashier"];
const MGR: Role[] = ["admin", "manager"];

type Icon = typeof LayoutDashboard;
type BadgeKey = "newOrders" | "openTickets" | "lowStock" | "subsDue" | "reviews";
export interface NavItem {
  href: string;
  label: string;
  roles: Role[];
  icon: Icon;
  group: string;
  badge?: BadgeKey;
}

export const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", roles: MGR, icon: LayoutDashboard, group: "Overview" },
  { href: "/admin/pos", label: "Billing / POS", roles: ["admin", "manager", "cashier"], icon: Receipt, group: "Sell" },
  { href: "/admin/orders", label: "Orders", roles: ALL, icon: ClipboardList, group: "Sell", badge: "newOrders" },
  { href: "/admin/subscriptions", label: "Subscriptions", roles: ALL, icon: RefreshCw, group: "Sell", badge: "subsDue" },
  { href: "/admin/kitchen", label: "Kitchen display", roles: ALL, icon: ChefHat, group: "Kitchen & stock", badge: "openTickets" },
  { href: "/admin/production", label: "Batch prep", roles: ["admin", "manager", "kitchen"], icon: FlaskConical, group: "Kitchen & stock" },
  { href: "/admin/inventory", label: "Inventory", roles: ALL, icon: Package, group: "Kitchen & stock", badge: "lowStock" },
  { href: "/admin/purchasing", label: "Purchasing", roles: MGR, icon: Truck, group: "Kitchen & stock" },
  { href: "/admin/suppliers", label: "Suppliers", roles: MGR, icon: CookingPot, group: "Kitchen & stock" },
  { href: "/admin/menu", label: "Menu & recipes", roles: MGR, icon: UtensilsCrossed, group: "Menu & pricing" },
  { href: "/admin/plans", label: "Plans", roles: MGR, icon: Sparkles, group: "Menu & pricing" },
  { href: "/admin/food-cost", label: "Food cost", roles: MGR, icon: Percent, group: "Menu & pricing" },
  { href: "/admin/blog", label: "Blog & SEO", roles: MGR, icon: PenLine, group: "Growth" },
  { href: "/admin/testimonials", label: "Testimonials", roles: MGR, icon: MessageSquareQuote, group: "Growth", badge: "reviews" },
  { href: "/admin/settings", label: "Settings", roles: ["admin"], icon: Settings, group: "Settings" },
];

const isActive = (href: string, path: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));

/** First page a staff role can open (kitchen → orders, cashier → POS, …). */
export function homeFor(role: Role) {
  return NAV.find((n) => n.roles.includes(role))?.href ?? "/";
}

/** Live counts shown as badges in the nav. */
function useBadges(enabled: boolean): Record<BadgeKey, number> & { ready: boolean } {
  const { data: open, loading: openLoading } = useLive<Order>(enabled ? "orders" : null, [where("status", "in", ["new", "accepted", "preparing"])], "open");
  const { data: items } = useLive<StockItem>(enabled ? "items" : null);
  const { data: subs } = useLive<Subscription>(enabled ? "subscriptions" : null, [where("status", "==", "active")], "active");
  const { data: pendingReviews } = useLive<Testimonial>(enabled ? "testimonials" : null, [where("pending", "==", true)], "pending");
  return useMemo(() => {
    const live = open.filter((o) => !awaitingPayment(o));
    const today = istDate();
    return {
      newOrders: live.filter((o) => o.status === "new").length,
      openTickets: live.filter((o) => o.status !== "new").length,
      lowStock: items.filter((i) => i.active !== false && i.currentStock <= i.reorderLevel).length,
      subsDue: subs.filter((s) => isDue(s, today)).length,
      reviews: pendingReviews.length,
      ready: !openLoading,
    };
  }, [open, items, subs, pendingReviews, openLoading]);
}

/** Short chime for new orders (no audio file needed). */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.start(t);
      o.stop(t + 0.32);
    });
  } catch {}
}

export function StaffShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, isStaff, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [palette, setPalette] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const badges = useBadges(isStaff);
  const prevNew = useRef<number | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (profile && !isStaff) router.replace("/");
  }, [loading, user, profile, isStaff, router, path]);

  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("leafli-admin-collapsed") === "1");
    } catch {}
  }, []);
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem("leafli-admin-collapsed", c ? "0" : "1");
      } catch {}
      return !c;
    });

  // ⌘K / Ctrl+K opens the command palette.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // New order arrived: chime, toast and a count in the tab title.
  // Orders that already existed when the page opened don't count as "arrived".
  useEffect(() => {
    if (!badges.ready) return;
    const n = badges.newOrders;
    if (prevNew.current != null && n > prevNew.current) {
      chime();
      setToast(`${n - prevNew.current} new order${n - prevNew.current > 1 ? "s" : ""} received`);
      setTimeout(() => setToast(null), 5000);
    }
    prevNew.current = n;
    document.title = n ? `(${n}) Leafli Kitchen` : "Leafli Kitchen";
  }, [badges.newOrders, badges.ready]);

  if (loading || !profile || !isStaff)
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-3 text-sm text-stone-500">
          <span className="size-6 animate-spin rounded-full border-2 border-leaf-600 border-t-transparent" />
          Loading kitchen…
        </div>
      </div>
    );

  const links = NAV.filter((n) => n.roles.includes(profile.role));
  const current = links.find((l) => isActive(l.href, path));
  const allowed = !!current;
  const groups = [...new Set(links.map((l) => l.group))];
  const canBill = links.some((l) => l.href === "/admin/pos");

  const navList = (compact: boolean) => (
    <nav className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map((g) => (
        <div key={g}>
          {!compact && <div className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.14em] text-cream-50/35 uppercase">{g}</div>}
          <ul className="space-y-0.5">
            {links
              .filter((l) => l.group === g)
              .map((l) => {
                const active = isActive(l.href, path);
                const count = l.badge ? badges[l.badge] : 0;
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      title={compact ? l.label : undefined}
                      className={cx(
                        "group relative flex items-center gap-3 rounded-xl py-2 text-sm font-medium transition-colors",
                        compact ? "justify-center px-0" : "px-3",
                        active ? "bg-lime-400 text-leaf-950 shadow-sm" : "text-cream-50/70 hover:bg-white/[.07] hover:text-cream-50",
                      )}
                    >
                      <l.icon className="size-[18px] shrink-0" strokeWidth={active ? 2.3 : 1.8} />
                      {!compact && <span className="flex-1 truncate">{l.label}</span>}
                      {count > 0 && (
                        <span
                          className={cx(
                            "grid min-w-5 place-items-center rounded-full px-1.5 text-[10px] leading-5 font-bold",
                            compact && "absolute -top-1 -right-0.5",
                            active ? "bg-leaf-900 text-lime-300" : l.badge === "lowStock" ? "bg-red-500/90 text-white" : "bg-lime-400 text-leaf-950",
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const userBlock = (compact: boolean) => (
    <div className="border-t border-white/10 p-3">
      <div className={cx("flex items-center gap-3 rounded-xl p-2", compact && "justify-center")}>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lime-400 text-sm font-bold text-leaf-950">{profile.name.charAt(0).toUpperCase()}</span>
        {!compact && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-cream-50">{profile.name}</div>
            <div className="truncate text-[11px] text-cream-50/50"><span className="capitalize">{profile.role}</span> · {profile.email || profile.phone}</div>
          </div>
        )}
      </div>
      <div className={cx("mt-1 flex gap-1", compact ? "flex-col items-center" : "")}>
        <Link href="/" title="View website" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs text-cream-50/70 hover:bg-white/[.07] hover:text-cream-50">
          <ExternalLink className="size-3.5" />
          {!compact && "Website"}
        </Link>
        <button
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
          title="Sign out"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs text-red-300 hover:bg-red-500/15 hover:text-red-200"
        >
          <LogOut className="size-3.5" />
          {!compact && "Sign out"}
        </button>
      </div>
    </div>
  );

  // Phone bottom nav: up to four destinations + "More".
  const preferred = ["/admin", "/admin/orders", "/admin/pos", "/admin/kitchen", "/admin/inventory", "/admin/subscriptions"];
  const mobileTabs = preferred.map((h) => links.find((l) => l.href === h)).filter(Boolean).slice(0, 4) as NavItem[];
  const centre = mobileTabs.find((t) => t.href === "/admin/pos");

  return (
    <div className="min-h-screen bg-[#f6f5f0] lg:flex">
      {/* ── Desktop sidebar ── */}
      <aside className={cx("no-print sticky top-0 hidden h-screen shrink-0 flex-col bg-leaf-950 transition-[width] duration-300 lg:flex", collapsed ? "w-[76px]" : "w-64")}>
        <div className={cx("flex h-16 items-center border-b border-white/10", collapsed ? "justify-center" : "justify-between px-5")}>
          <Link href="/admin" aria-label="Dashboard">
            <Logo tone="light" className={collapsed ? "h-9" : "h-11"} />
          </Link>
          {!collapsed && <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-cream-50/60 uppercase">Kitchen</span>}
        </div>
        {navList(collapsed)}
        <button onClick={toggleCollapsed} className="mx-3 mb-1 flex items-center justify-center gap-2 rounded-lg py-1.5 text-xs text-cream-50/40 hover:bg-white/[.07] hover:text-cream-50/80" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
        </button>
        {userBlock(collapsed)}
      </aside>

      {/* ── Phone drawer ("More") ── */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal aria-label="All sections">
          <div className="absolute inset-0 bg-stone-950/50 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88svh] flex-col rounded-t-3xl bg-leaf-950 pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-5 pt-4 pb-1">
              <Logo tone="light" className="h-10" />
              <button onClick={() => setDrawer(false)} className="grid size-9 place-items-center rounded-full bg-white/10 text-cream-50" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            {navList(false)}
            {userBlock(false)}
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        {/* ── Top bar ── */}
        <header className="no-print sticky top-0 z-30 border-b border-stone-200/70 bg-[#f6f5f0]/85 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:h-16">
            <Link href="/admin" className="lg:hidden" aria-label="Dashboard">
              <Logo className="h-9" />
            </Link>
            <div className="hidden min-w-0 items-center gap-2 lg:flex">
              {current && <current.icon className="size-4 text-stone-400" />}
              <span className="truncate text-sm font-semibold text-stone-800">{current?.label ?? "Admin"}</span>
            </div>
            <button
              onClick={() => setPalette(true)}
              className="ml-auto flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-sm text-stone-400 ring-1 ring-stone-200 transition hover:ring-stone-300 sm:w-64 lg:ml-6"
              aria-label="Search and jump to"
            >
              <Search className="size-4" />
              <span className="hidden flex-1 text-left sm:inline">Search or jump to…</span>
              <kbd className="hidden rounded-md bg-stone-100 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-stone-500 sm:inline">⌘K</kbd>
            </button>
            <div className="flex items-center gap-2 lg:ml-auto">
              <Link
                href="/admin/orders"
                className={cx(
                  "relative flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition",
                  badges.newOrders ? "bg-lime-400 text-leaf-950 shadow-sm" : "bg-white text-stone-500 ring-1 ring-stone-200 hover:text-stone-800",
                )}
                aria-label={`${badges.newOrders} new orders`}
              >
                <Bell className={cx("size-4", badges.newOrders > 0 && "animate-[wiggle_1s_ease-in-out_infinite]")} />
                <span className="hidden sm:inline">{badges.newOrders ? `${badges.newOrders} new` : "No new orders"}</span>
                {badges.newOrders > 0 && <span className="absolute -top-1 -right-1 size-2.5 animate-ping rounded-full bg-tomato sm:hidden" />}
              </Link>
              {canBill && (
                <Link href="/admin/pos" className="hidden h-9 items-center gap-1.5 rounded-xl bg-leaf-700 px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-leaf-800 sm:flex">
                  <Plus className="size-4" /> New bill
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-5 pb-[calc(88px+env(safe-area-inset-bottom))] sm:px-6 sm:py-7 lg:pb-10">
          {allowed ? children : <RedirectHome role={profile.role} />}
        </main>
      </div>

      {/* ── Phone bottom nav ── */}
      <nav aria-label="Admin" className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex h-16 max-w-lg items-stretch px-1">
          {mobileTabs.map((t) => {
            const active = isActive(t.href, path);
            const count = t.badge ? badges[t.badge] : 0;
            if (t === centre)
              return (
                <div key={t.href} className="flex flex-1 justify-center">
                  <Link href={t.href} aria-label="New bill" className="tap -mt-5 grid size-14 place-items-center rounded-2xl bg-leaf-700 text-white shadow-lg shadow-leaf-900/30 ring-4 ring-white">
                    <Plus className="size-6" strokeWidth={2.4} />
                  </Link>
                </div>
              );
            return (
              <Link key={t.href} href={t.href} className={cx("tap relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold", active ? "text-leaf-700" : "text-stone-400")}>
                <t.icon className="size-5" strokeWidth={active ? 2.3 : 1.8} />
                {t.label.split(" ")[0]}
                {count > 0 && <span className="absolute top-1.5 left-1/2 ml-1.5 grid min-w-4 place-items-center rounded-full bg-tomato px-1 text-[9px] leading-4 font-bold text-white">{count}</span>}
              </Link>
            );
          })}
          <button onClick={() => setDrawer(true)} className="tap flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-stone-400">
            <MenuIcon className="size-5" />
            More
          </button>
        </div>
      </nav>

      {palette && <CommandPalette links={links} onClose={() => setPalette(false)} />}

      {toast && (
        <div role="status" className="fixed top-3 left-1/2 z-[70] flex w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-leaf-950 py-2.5 pr-2.5 pl-3 text-sm whitespace-nowrap text-cream-50 shadow-2xl">
          <span className="grid size-8 place-items-center rounded-full bg-lime-400 text-leaf-950"><Bell className="size-4" /></span>
          <span className="font-semibold">{toast}</span>
          <Link href="/admin/orders" onClick={() => setToast(null)} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold hover:bg-white/20">View</Link>
        </div>
      )}
    </div>
  );
}

const ACTIONS: { label: string; href: string; icon: Icon; roles: Role[]; keywords: string }[] = [
  { label: "New bill", href: "/admin/pos", icon: Receipt, roles: ["admin", "manager", "cashier"], keywords: "pos invoice order counter" },
  { label: "Record a batch prep", href: "/admin/production", icon: FlaskConical, roles: ["admin", "manager", "kitchen"], keywords: "dressing sauce make produce" },
  { label: "Create purchase orders", href: "/admin/purchasing", icon: Truck, roles: MGR, keywords: "reorder buy po supplier stock" },
  { label: "Send today's subscriptions to kitchen", href: "/admin/subscriptions", icon: RefreshCw, roles: ALL, keywords: "plans deliveries generate" },
  { label: "Write a blog post", href: "/admin/blog/new", icon: BookOpenText, roles: MGR, keywords: "seo article content" },
  { label: "Open the website", href: "/", icon: ExternalLink, roles: ALL, keywords: "site storefront public" },
];

function CommandPalette({ links, onClose }: { links: NavItem[]; onClose: () => void }) {
  const { profile } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const results = useMemo(() => {
    const items = [
      ...links.map((l) => ({ label: l.label, href: l.href, icon: l.icon, group: "Go to", keywords: l.group })),
      ...ACTIONS.filter((a) => profile && a.roles.includes(profile.role)).map((a) => ({ label: a.label, href: a.href, icon: a.icon, group: "Actions", keywords: a.keywords })),
    ];
    const t = q.trim().toLowerCase();
    return t ? items.filter((x) => `${x.label} ${x.keywords}`.toLowerCase().includes(t)) : items;
  }, [q, links, profile]);

  useEffect(() => setI(0), [q]);
  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-stone-950/40 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-stone-900/10" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <div className="flex items-center gap-3 border-b border-stone-100 px-4">
          <Search className="size-4 text-stone-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setI((x) => Math.min(x + 1, results.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setI((x) => Math.max(x - 1, 0));
              }
              if (e.key === "Enter" && results[i]) go(results[i]!.href);
              if (e.key === "Escape") onClose();
            }}
            placeholder="Search pages and actions…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-stone-400"
          />
          <kbd className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-500">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {results.map((r, idx) => (
            <li key={`${r.group}-${r.href}-${r.label}`}>
              {(idx === 0 || results[idx - 1]!.group !== r.group) && <div className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-stone-400 uppercase">{r.group}</div>}
              <button
                onMouseEnter={() => setI(idx)}
                onClick={() => go(r.href)}
                className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", idx === i ? "bg-leaf-50 text-leaf-900" : "text-stone-700")}
              >
                <r.icon className={cx("size-4", idx === i ? "text-leaf-700" : "text-stone-400")} />
                <span className="flex-1">{r.label}</span>
                {idx === i && <span className="text-xs text-stone-400">↵</span>}
              </button>
            </li>
          ))}
          {!results.length && <li className="px-3 py-8 text-center text-sm text-stone-500">No matches for “{q}”.</li>}
        </ul>
      </div>
    </div>
  );
}

function RedirectHome({ role }: { role: Role }) {
  const router = useRouter();
  useEffect(() => router.replace(homeFor(role)), [router, role]);
  return <p className="text-sm text-stone-500">Redirecting…</p>;
}
