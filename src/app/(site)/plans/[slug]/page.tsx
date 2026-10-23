import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { DishImage } from "@/components/site/DishImage";
import { PageHero } from "@/components/site/PageShell";
import { SubscribeForm } from "@/components/site/SubscribeForm";
import { MobileBuyBar } from "@/components/site/MobileBuyBar";
import { rupees } from "@/lib/costing";
import { faqPage, graph, planProduct } from "@/lib/jsonld";
import { getPlanBySlug, getPlans, getPublicMenu } from "@/lib/server/content";
import { perMeal, savingsPct } from "@/lib/subscriptions";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getPlans().catch(() => [])).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPlanBySlug(slug);
  if (!p) return { title: "Plan not found", robots: { index: false } };
  return {
    title: { absolute: p.metaTitle || `${p.name} — Salad Subscription | Leafli` },
    description: p.metaDescription || p.tagline,
    alternates: { canonical: `/plans/${p.slug}` },
  };
}

export default async function PlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [plan, menu] = await Promise.all([getPlanBySlug(slug), getPublicMenu()]);
  if (!plan) notFound();
  const bowls = menu.items.filter((d) =>
    plan.eligibleMenuIds.length ? plan.eligibleMenuIds.includes(d.id) : !/dessert/i.test(d.category),
  );
  const save = savingsPct(plan.price, plan.compareAtPrice);

  return (
    <main>
      <JsonLd data={graph(planProduct(plan), ...(plan.faqs?.length ? [faqPage(plan.faqs)] : []))} />
      <PageHero
        crumbs={[{ name: "Subscriptions", path: "/plans" }, { name: plan.name, path: `/plans/${plan.slug}` }]}
        eyebrow={plan.highlight ?? "Salad subscription"}
        title={plan.name}
        intro={plan.description}
      >
        <div id="plan-price" className="mt-8 flex flex-wrap items-end gap-6">
          <div>
            <span className="font-display text-5xl font-semibold text-leaf-700">{rupees(perMeal(plan.price, plan.meals))}</span>
            <span className="ml-2 text-ink/50">per bowl</span>
          </div>
          <p className="pb-1 text-ink/60">
            {rupees(plan.price)} + GST for {plan.meals} bowls · use within {plan.validityDays} days
            {save > 0 && <> · <b className="text-leaf-600">save {save}%</b></>}
          </p>
        </div>
      </PageHero>

      <MobileBuyBar watch="plan-price">
        <div>
          <div className="text-sm font-semibold">{plan.name}</div>
          <div className="text-xs text-ink/50">{rupees(perMeal(plan.price, plan.meals))}/bowl · {plan.meals} bowls</div>
        </div>
        <a href="#subscribe" className="tap rounded-full bg-leaf-700 px-5 py-3 text-sm font-semibold text-cream-50">Start plan</a>
      </MobileBuyBar>
      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-24 sm:px-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="font-display text-2xl font-medium">What&apos;s included</h2>
          <ul className="mt-5 space-y-3">
            {plan.features.map((f) => (
              <li key={f} className="flex gap-3 text-ink/75"><span className="text-leaf-600">✓</span>{f}</li>
            ))}
          </ul>
          <h2 className="mt-12 font-display text-2xl font-medium">Bowls in this plan</h2>
          <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {bowls.map((b) => (
              <li key={b.id} className="text-center">
                <DishImage id={b.id} src={b.imageUrl} alt={b.name} className="mx-auto w-24" />
                <a href={`/menu/${b.slug}`} className="mt-2 block text-sm font-medium hover:underline">{b.name}</a>
              </li>
            ))}
          </ul>
          {plan.faqs?.length ? (
            <>
              <h2 className="mt-12 font-display text-2xl font-medium">Questions</h2>
              <div className="mt-4 divide-y divide-ink/10">
                {plan.faqs.map((f) => (
                  <details key={f.q} className="group py-4">
                    <summary className="flex cursor-pointer list-none justify-between gap-4 font-medium">
                      {f.q}<span className="text-leaf-600 transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-2 text-ink/70">{f.a}</p>
                  </details>
                ))}
              </div>
            </>
          ) : null}
        </div>
        <div id="subscribe" className="scroll-mt-20 lg:sticky lg:top-28 lg:self-start">
          <SubscribeForm plan={plan} acceptsOnline={!!menu.razorpayKeyId} razorpayKeyId={menu.razorpayKeyId} gstRate={menu.gstRate} />
        </div>
      </section>
    </main>
  );
}
