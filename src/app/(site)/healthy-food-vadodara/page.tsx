import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { AreasServed } from "@/components/site/AreasServed";
import { MenuSection } from "@/components/site/MenuSection";
import { PageHero } from "@/components/site/PageShell";
import { PostCards } from "@/components/site/PostCards";
import { faqPage, graph, restaurant } from "@/lib/jsonld";
import { getPublicMenu, getPublicSettings, getPublishedPosts } from "@/lib/server/content";
import { LOCAL } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "Healthy Food Delivery in Vadodara — Salads & Bowls | Leafli" },
  description:
    "Looking for healthy food in Vadodara? Leafli delivers chef-made salads, high-protein veg bowls and fruit bowls across Vadodara, 11 am–9 pm. Calories listed.",
  alternates: { canonical: "/healthy-food-vadodara" },
};

const WHY = [
  ["Made to order in Akota", "Every bowl is assembled when you order, from small-batch prep made the same day — not reheated, not pre-packed hours earlier."],
  ["Mostly vegetarian, clearly marked", "Most of our salads are vegetarian, with paneer, chana, sprouts and cheese for protein. Egg and chicken bowls are marked separately."],
  ["Calories and allergens on every dish", "Each dish page lists calories, protein, ingredients and allergens, so you can eat for your goals without guessing."],
  ["Crisp when it reaches you", "Dressings and crunchy toppings travel in separate sealed cups, inside rigid bowls kept chilled all the way to your door."],
];

const FAQS = [
  { q: "Where can I order healthy food in Vadodara?", a: `Leafli is a ${LOCAL.city} cloud kitchen that only makes salads and healthy bowls. Order at leafli.in for delivery anywhere in ${LOCAL.city}, ${LOCAL.hoursLabel.toLowerCase()}.` },
  { q: "Do you deliver salads across all of Vadodara?", a: "Yes — from our kitchen in Akota we deliver across Vadodara city, including Alkapuri, Gotri, Vasna-Bhayli, Manjalpur, Karelibaug, Fatehgunj, Sama, Old Padra Road, Nizampura and Waghodia Road." },
  { q: "Do you have high-protein vegetarian salads?", a: "Yes. Our Salad Caprese has around 28 g of protein, and our chana-and-sprout salads use legumes for plant protein. Protein and calories are listed on each dish page." },
  { q: "Can I get a daily healthy lunch delivered in Vadodara?", a: "Yes. Our salad subscriptions deliver one fresh bowl per day on the days you choose, for lunch (12–2 pm) or dinner (7–9 pm), with delivery included and the option to pause anytime." },
  { q: "Is Leafli good for weight loss?", a: "Our bowls are portion-controlled and list calories, so they are easy to fit into a calorie target. For a personal weight-loss plan, speak to a registered dietitian." },
];

export default async function HealthyFoodVadodara() {
  const [menu, settings, posts] = await Promise.all([getPublicMenu().catch(() => null), getPublicSettings().catch(() => null), getPublishedPosts().catch(() => [])]);
  const localPosts = posts.filter((p) => /vadodara|baroda/i.test(`${p.title} ${p.focusKeyword ?? ""}`)).slice(0, 3);
  return (
    <main>
      <JsonLd data={graph(...(settings && menu ? [restaurant(settings, menu.items)] : []), faqPage(FAQS))} />
      <PageHero
        crumbs={[{ name: `Healthy food in ${LOCAL.city}`, path: "/healthy-food-vadodara" }]}
        eyebrow={`${LOCAL.city} · ${LOCAL.altName}`}
        title={<>Healthy food delivery in <em className="text-leaf-600 italic">{LOCAL.city}.</em></>}
        intro={`Fresh salads, high-protein vegetarian bowls and fruit bowls — made to order in our ${LOCAL.kitchenArea} kitchen and delivered chilled across ${LOCAL.city}, ${LOCAL.hoursLabel.toLowerCase()}.`}
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/menu" className="rounded-full bg-leaf-700 px-6 py-3 font-semibold text-cream-50 hover:bg-leaf-800">Order now</Link>
          <Link href="/plans" className="rounded-full px-6 py-3 font-semibold text-leaf-700 ring-1 ring-leaf-700/20 hover:bg-leaf-700/5">Daily salad subscription</Link>
        </div>
      </PageHero>

      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8" aria-labelledby="why-h">
        <h2 id="why-h" className="max-w-3xl font-display text-[clamp(2rem,4vw,3.2rem)] leading-[1] font-medium tracking-[-0.03em]">
          Why {LOCAL.city} orders its salads from Leafli
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {WHY.map(([t, d]) => (
            <article key={t} className="rounded-[1.75rem] bg-white p-8 ring-1 ring-ink/5">
              <h3 className="font-display text-2xl font-medium">{t}</h3>
              <p className="mt-3 leading-relaxed text-ink/70">{d}</p>
            </article>
          ))}
        </div>
      </section>

      <MenuSection />
      <AreasServed />

      <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8" aria-labelledby="faq-h">
        <h2 id="faq-h" className="font-display text-[clamp(2rem,4vw,3rem)] font-medium tracking-[-0.03em]">Healthy food in {LOCAL.city}: your questions</h2>
        <div className="mt-8 divide-y divide-ink/10 rounded-[1.75rem] bg-white px-6 ring-1 ring-ink/5">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">{f.q}</summary>
              <p className="mt-3 leading-relaxed text-ink/70">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {localPosts.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8" aria-labelledby="guides-h">
          <h2 id="guides-h" className="mb-10 font-display text-[clamp(2rem,4vw,3rem)] font-medium tracking-[-0.03em]">Eating well in {LOCAL.city}</h2>
          <PostCards posts={localPosts} />
        </section>
      )}
    </main>
  );
}
