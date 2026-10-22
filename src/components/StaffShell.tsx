"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { cx } from "@/components/ui";
import { Logo } from "@/components/brand/Logo";
import type { Role } from "@/lib/types";

const ALL: Role[] = ["admin", "manager", "kitchen", "cashier"];
const MGR: Role[] = ["admin", "manager"];

export const NAV: { href: string; label: string; roles: Role[]; icon: string }[] = [
  { href: "/admin", label: "Dashboard", roles: MGR, icon: "◧" },
  { href: "/admin/pos", label: "Billing / POS", roles: ["admin", "manager", "cashier"], icon: "₹" },
  { href: "/admin/orders", label: "Orders", roles: ALL, icon: "☰" },
  { href: "/admin/kitchen", label: "Kitchen display", roles: ALL, icon: "♨" },
  { href: "/admin/production", label: "Batch prep", roles: ["admin", "manager", "kitchen"], icon: "⚗" },
  { href: "/admin/inventory", label: "Inventory", roles: ALL, icon: "▤" },
  { href: "/admin/purchasing", label: "Purchasing", roles: MGR, icon: "⇩" },
  { href: "/admin/menu", label: "Menu & recipes", roles: MGR, icon: "✎" },
  { href: "/admin/subscriptions", label: "Subscriptions", roles: ALL, icon: "↻" },
  { href: "/admin/plans", label: "Plans", roles: MGR, icon: "◎" },
  { href: "/admin/blog", label: "Blog & SEO", roles: MGR, icon: "✍" },
  { href: "/admin/testimonials", label: "Testimonials", roles: MGR, icon: "❝" },
  { href: "/admin/food-cost", label: "Food cost", roles: MGR, icon: "%" },
  { href: "/admin/suppliers", label: "Suppliers", roles: MGR, icon: "⚑" },
  { href: "/admin/settings", label: "Settings", roles: ["admin"], icon: "⚙" },
];

/** First page a staff role can open (kitchen → KDS, cashier → POS, …). */
export function homeFor(role: Role) {
  return NAV.find((n) => n.roles.includes(role))?.href ?? "/";
}

export function StaffShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, isStaff, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (profile && !isStaff) router.replace("/");
  }, [loading, user, profile, isStaff, router, path]);

  useEffect(() => setOpen(false), [path]);

  if (loading || !profile || !isStaff)
    return <div className="flex min-h-screen items-center justify-center text-sm text-stone-500">Loading…</div>;

  const links = NAV.filter((n) => n.roles.includes(profile.role));
  const allowed = links.some((l) => (l.href === "/admin" ? path === "/admin" : path.startsWith(l.href)));

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={cx(
          "no-print fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-stone-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-stone-100 px-5">
          <Logo className="h-10" />
          <span className="mt-1 text-xs text-stone-400">kitchen</span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                (l.href === "/admin" ? path === "/admin" : path.startsWith(l.href)) ? "bg-leaf-50 font-medium text-leaf-800" : "text-stone-600 hover:bg-stone-50",
              )}
            >
              <span className="w-4 text-center text-stone-400">{l.icon}</span>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-stone-100 p-4 text-xs">
          <div className="truncate font-medium text-stone-800">{profile.name}</div>
          <div className="truncate text-stone-500">{profile.email || profile.phone}</div>
          <div className="mb-3 capitalize text-stone-500">{profile.role}</div>
          <div className="flex items-center justify-between">
            <Link href="/" className="text-leaf-700 hover:underline">View website ↗</Link>
            <button onClick={async () => { await logout(); router.replace("/login"); }} className="rounded-md px-2 py-1 font-medium text-red-600 hover:bg-red-50">
              Sign out
            </button>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="min-w-0 flex-1">
        <div className="no-print flex h-14 items-center border-b border-stone-200 bg-white px-4 lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded p-2 hover:bg-stone-100" aria-label="Menu">
            ☰
          </button>
          <Logo className="ml-2 h-9" />
        </div>
        <main className="mx-auto max-w-7xl p-4 sm:p-6">
          {allowed ? children : <RedirectHome role={profile.role} />}
        </main>
      </div>
    </div>
  );
}

function RedirectHome({ role }: { role: Role }) {
  const router = useRouter();
  useEffect(() => router.replace(homeFor(role)), [router, role]);
  return <p className="text-sm text-stone-500">Redirecting…</p>;
}
