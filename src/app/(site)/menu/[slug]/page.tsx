import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DietDot } from "@/components/DietDot";
import { JsonLd } from "@/components/JsonLd";
import { AddButton } from "@/components/site/AddButton";
import { MobileBuyBar } from "@/components/site/MobileBuyBar";
import { DISH_THEME } from "@/components/site/DishArt";
import { DishImage } from "@/components/site/DishImage";
import { Breadcrumbs } from "@/components/site/PageShell";
import { rupees } from "@/lib/costing";
import { graph, menuItem } from "@/lib/jsonld";
import { getDishBySlug, getPlans, getPublicMenu } from "@/lib/server/content";
import { perMeal } from "@/lib/subscriptions";

export const revalidate = 300;

export async function generateStaticParams() {
  const menu = await getPublicMenu().catch(() => null);
  return (menu?.items ?? []).map((d) => ({ slug: d.slug }));
}

const DIET_LABEL = { veg: "Vegetarian", egg: "Contains egg", nonveg: "Non-vegetarian" } as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getDishBySlug(slug);
  if (!d) return { title: "Dish not found", robots: { index: false } };
  const kcal = d.nutrition?.calories ? ` ${d.nutrition.calories} kcal.` : "";
  return {
    title: `${d.name} — Order Online in Vadodara`,
    description: `${d.description.slice(0, 100).replace(/\s+\S*$/, "")}…${kcal} ${rupees(d.price)}, delivered fresh across Vadodara by Leafli.`.slice(0, 160),
    alternates: { canonical: `/menu/${d.slug}` },
    openGraph: {
      type: "website",
      title: `${d.name} | Leafli`,
      description: d.description,
      images: d.ogImageUrl ? [{ url: d.ogImageUrl, width: 1200, height: 630, alt: d.name }] : ["/opengraph-image"],
    },
    twitter: { card: "summary_large_image", images: [d.ogImageUrl || "/opengraph-image"] },
  };
}

export default async function DishPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [d, menu, plans] = await Promise.all([getDishBySlug(slug), getPublicMenu(), getPlans().catch(() => [])]);
  if (!d) notFound();
  const theme = DISH_THEME[d.id] ?? { bg: "#e9f1d8", fg: "#255f30", accent: "#bfcd30", tag: "" };
  const others = menu.items.filter((x) => x.id !== d.id).slice(0, 3);
  const cheapest = plans.filter((p) => !p.eligibleMenuIds.length || p.eligibleMenuIds.includes(d.id)).sort((a, b) => perMeal(a.price, a.meals) - perMeal(b.price, b.meals))[0];

  return (
    <main>
      <JsonLd data={graph(menuItem(d))} />
      <section className="pt-20 pb-12 md:pt-36 md:pb-16" style={{ background: theme.bg }}>
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-5 sm:px-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <Breadcrumbs items={[{ name: "Menu", path: "/menu" }, { name: d.name, path: `/menu/${d.slug}` }]} />
            <p className="mt-5 text-sm font-semibold tracking-[0.2em] uppercase lg:mt-8" style={{ color: theme.fg }}>{theme.tag || d.category}</p>
            <h1 className="mt-3 font-display text-[clamp(2.4rem,10vw,4.6rem)] leading-[0.95] font-medium tracking-[-0.03em]" style={{ color: theme.fg }}>{d.name}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">{d.description}</p>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-sm font-semibold">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5"><DietDot diet={d.diet} />{DIET_LABEL[d.diet]}</span>
              {d.nutrition?.calories ? <span className="rounded-full bg-white/70 px-3 py-1.5">{d.nutrition.calories} kcal</span> : null}
              {d.nutrition?.protein ? <span className="rounded-full bg-white/70 px-3 py-1.5">{d.nutrition.protein} g protein</span> : null}
            </div>
            <div id="dish-buy" className="mt-10 flex flex-wrap items-center gap-5">
              <span className="font-display text-4xl font-semibold" style={{ color: theme.fg }}>{rupees(d.price)}</span>
              <AddButton item={d} accent={theme.fg} />
            </div>
            {cheapest && (
              <p className="mt-5 text-sm text-ink/60">
                Or get it for {rupees(perMeal(cheapest.price, cheapest.meals))}/bowl with a <Link href={`/plans/${cheapest.slug}`} className="font-semibold underline">{cheapest.name}</Link> subscription.
              </p>
            )}
          </div>
          <div className="order-first mx-auto w-[min(86vw,22rem)] lg:order-none lg:w-full lg:max-w-lg">
            <DishImage id={d.id} src={d.imageUrl} alt={`${d.name} from Leafli, Vadodara — top view of the bowl`} priority className="w-full drop-shadow-[0_30px_40px_rgba(0,0,0,.2)]" />
          </div>
        </div>
      </section>

      <MobileBuyBar watch="dish-buy">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{d.name}</div>
          <div className="font-display text-lg font-semibold" style={{ color: theme.fg }}>{rupees(d.price)}</div>
        </div>
        <AddButton item={d} accent={theme.fg} />
      </MobileBuyBar>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-3">
        <div>
          <h2 className="font-display text-2xl font-medium">What&apos;s in it</h2>
          {d.ingredients.length ? (
            <ul className="mt-4 space-y-2 text-ink/75">{d.ingredients.map((i) => <li key={i} className="flex gap-2"><span className="text-leaf-600">•</span>{i}</li>)}</ul>
          ) : (
            <p className="mt-4 text-ink/60">Full ingredient list coming soon.</p>
          )}
        </div>
        <div>
          <h2 className="font-display text-2xl font-medium">Allergens</h2>
          <p className="mt-4 text-ink/75">{d.allergens.length ? d.allergens.join(", ") : "No major allergens listed."}</p>
          <p className="mt-3 text-sm text-ink/50">Made in a kitchen that also handles nuts, peanuts, sesame, soy, gluten, egg, dairy and mustard. Tell us about allergies in your order notes.</p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-medium">How it arrives</h2>
          <p className="mt-4 text-ink/75">Assembled to order in our Akota kitchen, packed in a rigid bowl and kept chilled. Dressings and crunchy toppings travel separately — toss just before you eat for the best texture.</p>
          <p className="mt-3 text-sm text-ink/50">Delivered across Vadodara, 11 am – 9 pm daily. <Link href="/healthy-food-vadodara" className="font-semibold text-leaf-700 hover:underline">Delivery areas →</Link></p>
        </div>
      </section>

      {others.length > 0 && (
        <section className="border-t border-ink/5 bg-cream-50 py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <h2 className="font-display text-3xl font-medium">You might also like</h2>
            <ul className="mt-8 grid gap-5 sm:grid-cols-3">
              {others.map((o) => (
                <li key={o.id}>
                  <Link href={`/menu/${o.slug}`} className="group flex items-center gap-4 rounded-[1.5rem] bg-white p-4 ring-1 ring-ink/5 transition-shadow hover:shadow-xl">
                    <DishImage id={o.id} src={o.imageUrl} alt={o.name} className="size-20 shrink-0 transition-transform duration-700 group-hover:rotate-12" />
                    <span>
                      <span className="block font-medium">{o.name}</span>
                      <span className="text-sm text-ink/50">{rupees(o.price)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
