import type { Metadata } from "next";
import Link from "next/link";
import { DishImage } from "@/components/site/DishImage";
import { PageHero } from "@/components/site/PageShell";
import { LOCAL } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "About Leafli — Vadodara's Cloud Kitchen for Fresh Salads" },
  description: "Leafli is a Vadodara cloud kitchen in Akota making chef-made salads and healthy bowls with written recipes, small-batch sauces and a cold chain to your door.",
  alternates: { canonical: "/about" },
};

const VALUES = [
  ["Written recipes, every time", "Every bowl and sauce follows a documented kitchen procedure, with weighed portions — so your favourite tastes the same every day."],
  ["Small batches, dated and chilled", "Dressings, pesto and roasted components are made in small dated batches and held at 4°C or below. Nothing is served past its use-by."],
  ["Packed to travel", "Dressings and crunchy toppings go in separate sealed cups, inside rigid bowls, so salads arrive crisp — not soggy."],
  ["You choose, every day", "Our logo says it: you choose everyday. Clear calories, allergens and ingredients on every dish, so you can eat the way you want."],
];

export default function About() {
  return (
    <main>
      <PageHero
        crumbs={[{ name: "About", path: "/about" }]}
        eyebrow="Our story"
        title={<>Good food shouldn&apos;t be <em className="text-leaf-600 italic">hard work.</em></>}
        intro={`Leafli started in ${LOCAL.city} with a simple idea: healthy food you actually look forward to, made with the care of a restaurant kitchen and delivered the way it was meant to be eaten.`}
      />
      <section className="mx-auto max-w-3xl px-5 pb-16 text-lg leading-relaxed text-ink/75 sm:px-8">
        <h2 className="font-display text-3xl font-medium text-ink">A salad kitchen made for {LOCAL.city}</h2>
        <p className="mt-4">
          {LOCAL.city} eats well — but finding a genuinely healthy lunch that isn&apos;t boring, oily or soggy by the time it reaches your desk was harder than it should be. So we built a
          delivery-only kitchen in {LOCAL.kitchenArea} that does one thing properly: fresh salads and healthy bowls, made to order and delivered cold across {LOCAL.altName}.
        </p>
        <p className="mt-4">
          Our menu mixes global favourites like the <Link href="/menu/classic-chicken-caesar-salad" className="font-semibold text-leaf-700 hover:underline">Chicken Caesar</Link> and{" "}
          <Link href="/menu/salad-caprese" className="font-semibold text-leaf-700 hover:underline">Salad Caprese</Link> with Gujarati-friendly, mostly vegetarian bowls such as the{" "}
          <Link href="/menu/desi-mango-sprout-salad" className="font-semibold text-leaf-700 hover:underline">Desi Mango &amp; Sprout Salad</Link>. Whether you&apos;re an office team in Alkapuri or Race Course, a student near
          MSU, or a family in Gotri, Vasna-Bhayli or Manjalpur, every bowl is made to taste good and to be honest about what&apos;s inside.
        </p>
        <p className="mt-4">We&apos;re open {LOCAL.hoursLabel.toLowerCase()}, and our <Link href="/plans" className="font-semibold text-leaf-700 hover:underline">salad subscriptions</Link> bring lunch or dinner to your door on the days you choose.</p>
      </section>
      <section className="mx-auto grid max-w-7xl gap-6 px-5 pb-20 sm:grid-cols-2 sm:px-8">
        {VALUES.map(([t, d]) => (
          <article key={t} className="rounded-[1.75rem] bg-white p-8 ring-1 ring-ink/5">
            <h2 className="font-display text-2xl font-medium">{t}</h2>
            <p className="mt-3 leading-relaxed text-ink/70">{d}</p>
          </article>
        ))}
      </section>
      <section className="bg-lime-400 py-20">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-8 px-5 sm:px-8">
          <div className="max-w-xl">
            <h2 className="font-display text-4xl font-medium text-leaf-900">Taste the difference.</h2>
            <p className="mt-3 text-leaf-900/75">Start with a single bowl, or try a Taster Week subscription.</p>
            <div className="mt-6 flex gap-3">
              <Link href="/menu" className="rounded-full bg-leaf-800 px-6 py-3 font-semibold text-cream-50">See the menu</Link>
              <Link href="/plans" className="rounded-full px-6 py-3 font-semibold text-leaf-900 ring-1 ring-leaf-900/30">Subscriptions</Link>
            </div>
          </div>
          <div className="flex -space-x-10">
            {["caprese", "chicken-caesar", "chana-moong"].map((id) => <DishImage key={id} id={id} className="w-36 drop-shadow-xl sm:w-44" />)}
          </div>
        </div>
      </section>
    </main>
  );
}
