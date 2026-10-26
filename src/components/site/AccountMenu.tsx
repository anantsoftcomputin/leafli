"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { usePwa } from "@/components/pwa/PwaProvider";

/** Signed-in menu in the site header: account links, admin (staff) and sign out. */
export function AccountMenu() {
  const { user, profile, isStaff, logout } = useAuth();
  const { isInstalled, openInstall } = usePwa();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!user) {
    return (
      <Link href="/login" className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5 lg:inline-flex">
        Sign in
      </Link>
    );
  }

  const name = profile?.name || user.displayName || user.email || user.phoneNumber || "Account";
  const initial = name.trim().charAt(0).toUpperCase();
  const item = "block rounded-xl px-3 py-2 text-sm text-ink/80 hover:bg-ink/5";

  async function signOut() {
    setOpen(false);
    await logout();
    router.push("/");
  }

  return (
    <div ref={ref} className="relative hidden lg:block">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-medium text-ink/75 hover:bg-ink/5"
      >
        <span className="grid size-8 place-items-center rounded-full bg-lime-400 font-semibold text-leaf-900">{initial}</span>
        <span className="max-w-28 truncate">{name.split(" ")[0]}</span>
        <svg viewBox="0 0 12 12" className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-60 rounded-2xl bg-white p-2 shadow-2xl shadow-leaf-900/15 ring-1 ring-ink/5">
          <div className="px-3 pt-1 pb-2 text-xs text-ink/50">
            Signed in as<br />
            <span className="font-medium text-ink/80">{user.email || user.phoneNumber}</span>
          </div>
          <div className="border-t border-ink/5 pt-1">
            <Link role="menuitem" href="/account" className={item} onClick={() => setOpen(false)}>My orders</Link>
            <Link role="menuitem" href="/account/subscriptions" className={item} onClick={() => setOpen(false)}>My subscriptions</Link>
            {isStaff && (
              <Link role="menuitem" href="/admin" className={`${item} font-semibold text-leaf-700`} onClick={() => setOpen(false)}>Admin dashboard →</Link>
            )}
          </div>
          {!isInstalled && (
            <div className="mt-1 border-t border-ink/5 pt-1">
              <button role="menuitem" onClick={() => { setOpen(false); openInstall(); }} className={`${item} w-full text-left`}>Install the app</button>
            </div>
          )}
          <div className="mt-1 border-t border-ink/5 pt-1">
            <button role="menuitem" onClick={signOut} className={`${item} w-full text-left text-tomato`}>Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}
