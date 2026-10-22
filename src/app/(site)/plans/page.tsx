import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageHero } from "@/components/site/PageShell";
import { PlanCards } from "@/components/site/PlanCards";
import { rupees } from "@/lib/costing";
import { faqPage, graph, planProduct } from "@/lib/jsonld";
import { getPlans } from "@/lib/server/content";
import { perMeal, savingsPct } from "@/lib/subscriptions";

export const metadata: Metadata = {
  title: "Salad Subscription Plans — Weekly & Monthly",
  description:
    "Weekly, fortnightly and monthly salad subscriptions from ₹375 per bowl, delivery included. Pick your days, swap bowls and pause anytime with Leafli.",
  alternates: { canonical: "/plans" },
};

const FAQS = [
  { q: "How does a Leafli salad subscription work?", a: "Pick a plan, your delivery days and lunch or dinner slot. We deliver one fresh bowl on each delivery day until your bowls are used. Choose your bowl for any day from your account, or let the chef rotate the menu for you." },
  { q: "Can I pause, skip or change my bowl?", a: "Yes — skip a day, pause your whole plan, or swap the bowl for any upcoming day until 9 pm the day before. Pausing extends your plan's validity by the days you paused." },
  { q: "Is delivery included?", a: "Yes. Every plan includes delivery to your address on your chosen days." },
  { q: "Do you have vegetarian subscriptions?", a: "Yes. Choose vegetarian, eggetarian or non-vegetarian when you subscribe and we'll only send bowls that match." },
  { q: "How do I pay?", a: "Pay securely online with UPI, cards, netbanking or wallets via Razorpay. You get a GST invoice for your plan." },
];

export default async function PlansPage() {
  const plans = await getPlans();
  return (
    <main>
      <JsonLd data={graph(...plans.map(planProduct), faqPage(FAQS))} />
      <PageHero
        crumbs={[{ name: "Subscriptions", path: "/plans" }]}
        eyebrow="Salad subscriptions"
        title={<>Healthy lunches, <em className="text-leaf-600 italic">on repeat.</em></>}
        intro="Prepay for your bowls, pick your delivery days, and we'll handle the rest. Save up to 22% compared with ordering one by one — with delivery included."
      />
      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
        <PlanCards plans={plans} />
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8" aria-labelledby="compare-h">
        <h2 id="compare-h" className="font-display text-3xl font-medium">Compare plans</h2>
        <div className="mt-6 overflow-x-auto rounded-[1.5rem] bg-white ring-1 ring-ink/5">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-cream-200/60">
              <tr>
                <th className="px-5 py-3 font-semibold">Plan</th>
                <th className="px-5 py-3 font-semibold">Bowls</th>
                <th className="px-5 py-3 font-semibold">Use within</th>
                <th className="px-5 py-3 font-semibold">Per bowl</th>
                <th className="px-5 py-3 font-semibold">You save</th>
                <th className="px-5 py-3 font-semibold">Price (+GST)</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-t border-ink/5">
                  <td className="px-5 py-3 font-medium">{p.name}</td>
                  <td className="px-5 py-3">{p.meals}</td>
                  <td className="px-5 py-3">{p.validityDays} days</td>
                  <td className="px-5 py-3">{rupees(perMeal(p.price, p.meals))}</td>
                  <td className="px-5 py-3 font-semibold text-leaf-600">{savingsPct(p.price, p.compareAtPrice)}%</td>
                  <td className="px-5 py-3">{rupees(p.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-cream-50 py-24" aria-labelledby="faq-h">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <h2 id="faq-h" className="font-display text-3xl font-medium">Subscription FAQs</h2>
          <div className="mt-8 divide-y divide-ink/10">
            {FAQS.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <span className="text-xl text-leaf-600 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 leading-relaxed text-ink/70">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
