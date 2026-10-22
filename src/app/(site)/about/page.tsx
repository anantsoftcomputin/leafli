import type { Metadata } from "next";
import Link from "next/link";
import { DishImage } from "@/components/site/DishImage";
import { PageHero } from "@/components/site/PageShell";

export const metadata: Metadata = {
  title: { absolute: "About Leafli — A Cloud Kitchen for Fresh, Honest Bowls" },
  description: "Leafli is a cloud kitchen making chef-made salads and healthy bowls with written recipes, small-batch sauces and a cold chain from prep to your door.",
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
        intro="Leafli started with a simple idea: healthy food you actually look forward to, made with the care of a restaurant kitchen and delivered the way it was meant to be eaten."
      />
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
