"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { where } from "firebase/firestore";
import {
  AlertTriangle,
  ArrowRight,
  ChefHat,
  ClipboardList,
  Clock,
  FlaskConical,
  IndianRupee,
  PackageX,
  PenLine,
  Percent,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Truck,
  Wallet,
} from "lucide-react";
import { AreaChart, BarList, compact, Meter, ShareBar, Sparkline } from "@/components/admin/charts";
import { useAuth } from "@/components/AuthProvider";
import { SourceBadge, StatusBadge, timeAgo } from "@/components/OrderBits";
import { Badge, Card, cx, Empty, Stat } from "@/components/ui";
import { inr, rupees } from "@/lib/costing";
import { useItems, useLive, useMenu } from "@/lib/hooks";
import { startOfDay, summarize } from "@/lib/reports";
import { istDate } from "@/lib/site";
import { isDue } from "@/lib/subscriptions";
import { awaitingPayment, type Order, type PrepBatch, type PurchaseOrder, type Subscription } from "@/lib/types";

const DAY = 86400000;
const pctChange = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : now > 0 ? null : 0);

export default function Dashboard() {
  const { profile } = useAuth();
  const [range, setRange] = useState<7 | 30>(7);
  const since = useMemo(() => startOfDay(new Date(Date.now() - 29 * DAY)), []);
  const { data: orders, loading } = useLive<Order>("orders", [where("createdAt", ">=", since)], String(since));
  const { data: items, loading: itemsLoading } = useItems();
  const { data: menu, loading: menuLoading } = useMenu();
  const { data: batches } = useLive<PrepBatch>("prepBatches", [where("status", "==", "active")], "active");
  const { data: pos } = useLive<PurchaseOrder>("purchaseOrders", [where("status", "in", ["draft", "sent"])], "open");
  const { data: subs } = useLive<Subscription>("subscriptions", [where("status", "in", ["active", "pending_payment"])], "subs");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // One summary per day for the last 30 days (oldest → newest).
  const days = useMemo(
    () =>
      Array.from({ length: 30 }, (_, k) => {
        const start = startOfDay(new Date(Date.now() - (29 - k) * DAY));
        return { start, ...summarize(orders.filter((o) => o.createdAt >= start && o.createdAt < start + DAY)) };
      }),
    [orders],
  );
  const t = days[29]!;
  const y = days[28]!;
  const last14 = days.slice(-14);
  const span = days.slice(-range);
  const rangeSummary = useMemo(() => summarize(orders.filter((o) => o.createdAt >= span[0]!.start)), [orders, span]);

  const open = orders.filter((o) => ["new", "accepted", "preparing", "ready", "dispatched"].includes(o.status) && !awaitingPayment(o)).sort((a, b) => a.createdAt - b.createdAt);
  const low = items.filter((i) => i.active !== false && i.currentStock <= i.reorderLevel).sort((a, b) => a.currentStock / Math.max(a.reorderLevel, 1) - b.currentStock / Math.max(b.reorderLevel, 1));
  const expiring = batches.filter((b) => b.useBy && b.useBy - now < DAY).sort((a, b) => (a.useBy ?? 0) - (b.useBy ?? 0));
  const dueToday = subs.filter((s) => isDue(s, istDate())).length;
  const pendingSubs = subs.filter((s) => s.status === "pending_payment").length;
  const openItems = menu.reduce((n, m) => n + (m.openItems?.length ?? 0), 0);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const fmtDay = (ts: number) => new Date(ts).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });

  const actions = [
    { href: "/admin/pos", label: "New bill", icon: Receipt, tone: "bg-leaf-700 text-white" },
    { href: "/admin/production", label: "Batch prep", icon: FlaskConical, tone: "bg-white text-stone-800 ring-1 ring-stone-200" },
    { href: "/admin/purchasing", label: "Reorder stock", icon: Truck, tone: "bg-white text-stone-800 ring-1 ring-stone-200" },
    { href: "/admin/blog/new", label: "Write a post", icon: PenLine, tone: "bg-white text-stone-800 ring-1 ring-stone-200" },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting + quick actions */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-stone-500">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-stone-900 sm:text-[1.75rem]">
            {greet}, {profile?.name.split(" ")[0]} <span aria-hidden>👋</span>
          </h1>
        </div>
        <div className="no-scrollbar -mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:px-0">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className={cx("tap flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold shadow-sm", a.tone)}>
              <a.icon className="size-4" /> {a.label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI tiles — today vs yesterday, 14-day sparklines */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat
          label="Net sales today"
          icon={<IndianRupee className="size-3.5" />}
          value={inr(t.revenue).replace(".00", "")}
          delta={{ pct: pctChange(t.revenue, y.revenue), vs: "vs yesterday" }}
          trend={<Sparkline values={last14.map((d) => d.revenue)} label="Net sales, last 14 days" />}
        />
        <Stat
          label="Orders today"
          icon={<ShoppingBag className="size-3.5" />}
          value={t.orders}
          delta={{ pct: pctChange(t.orders, y.orders), vs: "vs yesterday" }}
          trend={<Sparkline values={last14.map((d) => d.orders)} label="Orders, last 14 days" />}
        />
        <Stat
          label="Avg. order value"
          icon={<Wallet className="size-3.5" />}
          value={rupees(Math.round(t.aov))}
          delta={{ pct: pctChange(t.aov, y.aov), vs: "vs yesterday" }}
          trend={<Sparkline values={last14.map((d) => d.aov)} label="Average order value, last 14 days" />}
        />
        <Stat
          label="Food cost today"
          icon={<Percent className="size-3.5" />}
          value={`${t.foodCostPct}%`}
          goodWhen="down"
          tone={t.foodCostPct > 35 ? "red" : t.foodCostPct > 30 ? "amber" : undefined}
          delta={{ pct: y.foodCostPct ? t.foodCostPct - y.foodCostPct : null, vs: "pts vs yesterday" }}
          trend={
            <div className="space-y-1.5 pt-2">
              <Meter value={t.foodCostPct} target={30} />
              <p className="text-[11px] text-stone-500">Target ≤ 30%</p>
            </div>
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Sales trend */}
        <Card
          className="xl:col-span-2"
          title="Net sales"
          description={`${inr(rangeSummary.revenue)} · ${rangeSummary.orders} orders in the last ${range} days`}
          actions={
            <div className="flex rounded-lg bg-stone-100 p-0.5 text-xs font-semibold">
              {([7, 30] as const).map((r) => (
                <button key={r} onClick={() => setRange(r)} className={cx("rounded-md px-2.5 py-1", range === r ? "bg-white text-stone-900 shadow-sm" : "text-stone-500")}>
                  {r}D
                </button>
              ))}
            </div>
          }
        >
          {loading ? (
            <div className="h-[240px] animate-pulse rounded-xl bg-stone-100" />
          ) : (
            <AreaChart
              label={`Net sales per day, last ${range} days`}
              points={span.map((d) => ({ label: fmtDay(d.start), value: d.revenue, detail: `${d.orders} orders · food cost ${d.foodCostPct}%` }))}
              format={(n) => rupees(Math.round(n))}
            />
          )}
        </Card>

        {/* Channel mix */}
        <Card title="Sales by channel" description={`Last ${range} days`}>
          <ShareBar
            format={(n) => `₹${compact(n)}`}
            segments={[
              { key: "pos", label: "Counter & phone", value: rangeSummary.byChannel.get("pos")?.revenue ?? 0 },
              { key: "website", label: "Website", value: rangeSummary.byChannel.get("website")?.revenue ?? 0 },
              { key: "zomato", label: "Zomato", value: rangeSummary.byChannel.get("zomato")?.revenue ?? 0 },
            ]}
          />
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-stone-100 pt-4 text-sm">
            <div>
              <div className="text-xs text-stone-500">Zomato commission</div>
              <div className="font-semibold text-stone-900">{inr(rangeSummary.commission)}</div>
            </div>
            <div>
              <div className="text-xs text-stone-500">Contribution</div>
              <div className="font-semibold text-leaf-700">{inr(rangeSummary.contribution)}</div>
            </div>
          </div>
        </Card>

        {/* Live orders */}
        <Card
          className="xl:col-span-2"
          title="Live orders"
          icon={<ClipboardList className="size-4" />}
          description={open.length ? `${open.length} open · oldest ${timeAgo(open[0]!.createdAt)}` : "All caught up"}
          actions={<Link href="/admin/orders" className="flex items-center gap-1 text-xs font-semibold text-leaf-700 hover:underline">Order board <ArrowRight className="size-3.5" /></Link>}
          flush
        >
          {open.length === 0 ? (
            <div className="p-5"><Empty icon={<ChefHat className="size-5" />}>No open orders right now.</Empty></div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {open.slice(0, 7).map((o) => {
                const mins = Math.floor((now - o.createdAt) / 60000);
                return (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50">
                      <div className={cx("grid size-10 shrink-0 place-items-center rounded-xl text-xs font-bold", mins > 20 ? "bg-red-50 text-red-700" : mins > 10 ? "bg-amber-50 text-amber-700" : "bg-leaf-50 text-leaf-700")}>
                        {mins}m
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-stone-900">{o.orderNo.slice(-3)}</span>
                          <SourceBadge source={o.source} />
                          {o.subscriptionId && <Badge tone="violet">plan</Badge>}
                        </div>
                        <div className="truncate text-xs text-stone-500">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</div>
                      </div>
                      <div className="hidden text-right text-sm font-semibold text-stone-900 tabular-nums sm:block">{rupees(o.total)}</div>
                      <StatusBadge status={o.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Top dishes */}
        <Card title="Top dishes" description={`By bowls sold · last ${range} days`}>
          <BarList
            format={(n) => `${n}`}
            empty="No dishes sold in this period"
            rows={rangeSummary.dishes
              .slice()
              .sort((a, b) => b.qty - a.qty)
              .slice(0, 6)
              .map((d) => ({ label: d.name, value: d.qty, detail: `${inr(d.revenue)} · FC ${d.foodCostPct}%` }))}
          />
        </Card>

        {/* Needs attention */}
        <Card className="xl:col-span-3" title="Needs attention" icon={<AlertTriangle className="size-4" />}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AttentionTile
              href="/admin/inventory"
              icon={<PackageX className="size-4" />}
              tone={low.length ? "red" : "green"}
              title={itemsLoading ? "Checking stock…" : low.length ? `${low.length} items low on stock` : "Stock levels healthy"}
              body={low.length ? low.slice(0, 4).map((i) => i.name).join(", ") + (low.length > 4 ? "…" : "") : "Nothing below its reorder level."}
              cta={low.length ? (pos.length ? `${pos.length} open POs` : "Create POs") : undefined}
              ctaHref="/admin/purchasing"
            />
            <AttentionTile
              href="/admin/production"
              icon={<Clock className="size-4" />}
              tone={expiring.length ? "amber" : "green"}
              title={expiring.length ? `${expiring.length} batches expire within 24h` : "No batches expiring soon"}
              body={expiring.length ? expiring.slice(0, 3).map((b) => `${b.itemName} (${b.useBy! < now ? "expired" : new Date(b.useBy!).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })})`).join(", ") : "Use-by dates are all comfortable."}
            />
            <AttentionTile
              href="/admin/subscriptions"
              icon={<RefreshCw className="size-4" />}
              tone={dueToday ? "blue" : "green"}
              title={dueToday ? `${dueToday} subscription meals due today` : "No subscription meals due"}
              body={pendingSubs ? `${pendingSubs} plan(s) awaiting payment` : "Send due meals to the kitchen each morning."}
              cta={dueToday ? "Send to kitchen" : undefined}
              ctaHref="/admin/subscriptions"
            />
            <AttentionTile
              href="/admin/menu"
              icon={<AlertTriangle className="size-4" />}
              tone={openItems ? "amber" : "green"}
              title={menuLoading ? "Checking recipes…" : openItems ? `${openItems} SOP items to confirm` : "Recipes confirmed"}
              body={openItems ? "Portions, yields or prices still marked TBC in Menu & recipes." : "Every recipe quantity is confirmed."}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function AttentionTile({ href, icon, tone, title, body, cta, ctaHref }: { href: string; icon: React.ReactNode; tone: "red" | "amber" | "green" | "blue"; title: string; body: string; cta?: string; ctaHref?: string }) {
  const toneCls = { red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-700", green: "bg-leaf-50 text-leaf-700", blue: "bg-sky-50 text-sky-700" }[tone];
  return (
    <div className="flex flex-col rounded-xl bg-stone-50/70 p-4 ring-1 ring-stone-900/[.04]">
      <Link href={href} className="flex items-start gap-3">
        <span className={cx("grid size-8 shrink-0 place-items-center rounded-lg", toneCls)}>{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-stone-900">{title}</div>
          <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{body}</p>
        </div>
      </Link>
      {cta && ctaHref && (
        <Link href={ctaHref} className="mt-3 ml-11 inline-flex items-center gap-1 self-start text-xs font-semibold text-leaf-700 hover:underline">
          {cta} <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}
