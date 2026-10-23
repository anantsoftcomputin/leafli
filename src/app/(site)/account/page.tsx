"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { orderBy, where } from "firebase/firestore";
import { rupees as inr } from "@/lib/costing";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { useLive } from "@/lib/hooks";
import type { Order, OrderStatus } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { DishImage } from "@/components/site/DishImage";
import { PushOptIn } from "@/components/pwa/PushOptIn";
import { InstallAppCard } from "@/components/pwa/InstallAppCard";

const LABEL: Record<OrderStatus, string> = {
  new: "Placed",
  accepted: "Confirmed",
  preparing: "In the kitchen",
  ready: "Packed",
  dispatched: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function AccountPage() {
  const { user, profile, loading, logout } = useAuth();
  const router = useRouter();
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/account");
  }, [loading, user, router]);
  const { data: orders, loading: loadingOrders } = useLive<Order>(
    user ? "orders" : null,
    [where("customerUid", "==", user?.uid ?? ""), orderBy("createdAt", "desc")],
    user?.uid,
  );

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from("[data-order]", { y: 30, opacity: 0, stagger: 0.06, duration: 0.7, ease: "expo.out" });
      });
      return () => mm.revert();
    },
    { scope: list, dependencies: [orders.length] },
  );

  return (
    <div className="mx-auto max-w-3xl px-5">
      <p className="text-sm font-semibold tracking-[0.2em] text-leaf-600 uppercase">Hi {profile?.name?.split(" ")[0] ?? "there"}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-5xl font-medium tracking-tight">Your orders</h1>
        <div className="flex gap-2">
          <Link href="/account/subscriptions" className="rounded-full bg-lime-300 px-5 py-2.5 text-sm font-semibold text-leaf-900">My subscriptions →</Link>
          <button onClick={async () => { await logout(); router.push("/"); }} className="rounded-full px-5 py-2.5 text-sm font-semibold text-ink/60 ring-1 ring-ink/15 hover:bg-ink/5">Sign out</button>
        </div>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <PushOptIn variant="account" />
        <InstallAppCard />
      </div>
      {!loadingOrders && orders.length === 0 ? (
        <div className="mt-12 rounded-[2rem] bg-white p-10 text-center ring-1 ring-ink/5">
          <DishImage id="asian-rice-noodle" className="mx-auto w-36" />
          <p className="mt-6 font-display text-2xl">Nothing here yet</p>
          <Link href="/#menu" className="mt-6 inline-flex rounded-full bg-leaf-700 px-6 py-3 font-semibold text-cream-50">Order your first bowl</Link>
        </div>
      ) : (
        <ul ref={list} className="mt-10 space-y-3">
          {orders.map((o) => (
            <li key={o.id} data-order>
              <Link href={`/account/orders/${o.id}`} className="group flex items-center gap-4 rounded-[1.5rem] bg-white p-4 ring-1 ring-ink/5 transition hover:shadow-xl hover:shadow-leaf-900/5">
                <div className="flex -space-x-5">
                  {o.lines.slice(0, 3).map((l) => <DishImage key={l.menuItemId} id={l.menuItemId} className="size-14 ring-4 ring-white" />)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</div>
                  <div className="text-sm text-ink/50">{o.orderNo} · {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{inr(o.total)}</div>
                  <span className={`text-xs font-semibold ${o.status === "cancelled" ? "text-tomato" : o.status === "delivered" ? "text-ink/40" : "text-leaf-600"}`}>{LABEL[o.status]}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
