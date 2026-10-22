import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageHero } from "@/components/site/PageShell";
import { faqPage, graph } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "FAQs — Ordering, Delivery, Allergens & Subscriptions",
  description: "Answers to common questions about ordering from Leafli: delivery areas and times, payment, allergens, freshness, subscriptions, cancellations and refunds.",
  alternates: { canonical: "/faq" },
};

const GROUPS: { title: string; items: { q: string; a: string }[] }[] = [
  {
    title: "Ordering & delivery",
    items: [
      { q: "Where do you deliver?", a: "We deliver from our cloud kitchen through Porter delivery partners. Enter your address at checkout — if we can reach you, you'll see the delivery option." },
      { q: "How long does delivery take?", a: "Most orders are assembled within 15–20 minutes and then handed to a rider. You can track your rider live from your order page." },
      { q: "Can I order on Zomato?", a: "Yes, Leafli is on Zomato too. Ordering directly on leafli.in gets you subscriptions and saved addresses." },
      { q: "How do I pay?", a: "Pay online with UPI, cards, netbanking or wallets through Razorpay, or choose pay on delivery." },
    ],
  },
  {
    title: "Food & freshness",
    items: [
      { q: "Why are dressings packed separately?", a: "So nothing goes soggy on the way. Toss the dressing in just before you eat for the best crunch." },
      { q: "How fresh is the food?", a: "Bowls are assembled to order. Sauces and roasted components are made in small dated batches, kept at 4°C or below, and never used past their use-by." },
      { q: "Do you list allergens?", a: "Yes — every dish page lists its allergens. Our kitchen also handles nuts, peanuts, sesame, soy, gluten, egg, dairy and mustard, so tell us about allergies in your order notes." },
      { q: "Do you have vegetarian options?", a: "Most of our menu is vegetarian, clearly marked with the green veg symbol. Egg and non-veg dishes are marked too." },
    ],
  },
  {
    title: "Subscriptions",
    items: [
      { q: "How do subscriptions work?", a: "Buy a pack of bowls, pick your delivery days and slot, and we deliver one bowl per delivery day. Choose your bowl for any day or let the chef rotate the menu." },
      { q: "Can I pause or skip?", a: "Yes — skip a day, pause your plan or change your bowl until 9 pm the day before. Pausing extends your plan's validity." },
      { q: "What happens to unused bowls?", a: "Bowls must be used within the plan's validity period. See our refund policy for cancellations." },
    ],
  },
];

export default function Faq() {
  return (
    <main>
      <JsonLd data={graph(faqPage(GROUPS.flatMap((g) => g.items)))} />
      <PageHero crumbs={[{ name: "FAQs", path: "/faq" }]} eyebrow="Help" title="Frequently asked questions" />
      <div className="mx-auto max-w-3xl space-y-14 px-5 pb-24 sm:px-8">
        {GROUPS.map((g) => (
          <section key={g.title} aria-labelledby={g.title}>
            <h2 id={g.title} className="font-display text-3xl font-medium">{g.title}</h2>
            <div className="mt-4 divide-y divide-ink/10">
              {g.items.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none justify-between gap-4 font-medium">{f.q}<span className="text-xl text-leaf-600 transition-transform group-open:rotate-45">+</span></summary>
                  <p className="mt-3 leading-relaxed text-ink/70">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
