"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { orderBy, where } from "firebase/firestore";
import { useLive } from "@/lib/hooks";
import { canOrderNow, mealsRemaining, SUB_STATUS_LABEL as STATUS_LABEL } from "@/lib/subscriptions";
import type { Subscription } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";


export default function MySubscriptions() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/account/subscriptions");
  }, [loading, user, router]);
  const { data, loading: busy } = useLive<Subscription>(user ? "subscriptions" : null, [where("customerUid", "==", user?.uid ?? ""), orderBy("createdAt", "desc")], user?.uid);

  return (
    <div className="mx-auto max-w-3xl px-5">
      <Link href="/account" className="text-sm text-ink/50 hover:underline">← My orders</Link>
      <h1 className="mt-3 font-display text-5xl font-medium tracking-tight">My subscriptions</h1>
      {!busy && data.length === 0 ? (
        <div className="mt-10 rounded-[2rem] bg-white p-10 text-center ring-1 ring-ink/5">
          <p className="font-display text-2xl">No subscriptions yet</p>
          <p className="mt-2 text-ink/60">Save up to 22% and never think about lunch again.</p>
          <Link href="/plans" className="mt-6 inline-flex rounded-full bg-leaf-700 px-6 py-3 font-semibold text-cream-50">See plans</Link>
        </div>
      ) : (
        <ul className="mt-10 space-y-3">
          {data.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-[1.5rem] bg-white p-2 pr-3 ring-1 ring-ink/5 transition hover:shadow-xl hover:shadow-leaf-900/5">
              <Link href={`/account/subscriptions/${s.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-[1.2rem] p-3">
                <div className="min-w-0">
                  <div className="font-display text-xl">{s.planName}</div>
                  <div className="text-sm text-ink/50">{mealsRemaining(s)} of {s.mealsTotal} bowls left · until {s.endDate}</div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${s.status === "active" ? "bg-lime-300 text-leaf-900" : s.status === "pending_payment" ? "bg-mango/30" : "bg-ink/5 text-ink/60"}`}>{STATUS_LABEL[s.status]}</span>
              </Link>
              {canOrderNow(s) && (
                <Link href={`/account/subscriptions/${s.id}#order-now`} className="shrink-0 rounded-full bg-leaf-700 px-4 py-2 text-sm font-semibold text-cream-50 hover:bg-leaf-800">Order now</Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
