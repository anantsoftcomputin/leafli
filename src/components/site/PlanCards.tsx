import Link from "next/link";
import { rupees } from "@/lib/costing";
import { perMeal, savingsPct } from "@/lib/subscriptions";
import type { Plan } from "@/lib/types";

/** Server-rendered plan cards (crawlable prices, links to each plan page). */
export function PlanCards({ plans, compact }: { plans: Plan[]; compact?: boolean }) {
  return (
    <div className={`grid gap-5 sm:grid-cols-2 ${plans.length >= 4 ? "xl:grid-cols-4" : "lg:grid-cols-3"}`}>
      {plans.map((p) => {
        const save = savingsPct(p.price, p.compareAtPrice);
        return (
          <article key={p.id} className={`relative flex flex-col rounded-[1.75rem] p-7 ${p.highlight ? "bg-leaf-800 text-cream-50 shadow-2xl shadow-leaf-900/25" : "bg-white text-ink ring-1 ring-ink/5"}`}>
            {p.highlight && <span className="absolute -top-3 left-7 rounded-full bg-tomato px-3 py-1 text-xs font-bold text-white">{p.highlight}</span>}
            <h3 className="font-display text-2xl font-medium">
              <Link href={`/plans/${p.slug}`} className="after:absolute after:inset-0">{p.name}</Link>
            </h3>
            <p className={`mt-1 text-sm ${p.highlight ? "text-cream-50/70" : "text-ink/60"}`}>{p.tagline}</p>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-display text-4xl font-semibold">{rupees(perMeal(p.price, p.meals))}</span>
              <span className={`text-sm ${p.highlight ? "text-cream-50/60" : "text-ink/50"}`}>per bowl</span>
            </div>
            <p className={`mt-1 text-sm ${p.highlight ? "text-cream-50/70" : "text-ink/60"}`}>
              {rupees(p.price)} for {p.meals} bowls{save > 0 && <> · <b className={p.highlight ? "text-lime-300" : "text-leaf-600"}>save {save}%</b></>}
            </p>
            {!compact && (
              <ul className={`mt-6 space-y-2 text-sm ${p.highlight ? "text-cream-50/85" : "text-ink/70"}`}>
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><span className={p.highlight ? "text-lime-300" : "text-leaf-600"}>✓</span>{f}</li>
                ))}
              </ul>
            )}
            <div className="mt-auto pt-8">
              <span className={`flex justify-center rounded-full py-3.5 font-semibold ${p.highlight ? "bg-lime-400 text-leaf-900" : "bg-leaf-700 text-cream-50"}`}>
                Choose {p.name}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
