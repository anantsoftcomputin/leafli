import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { BowlsShowcase } from "@/components/site/BowlsShowcase";
import { ClosingCta } from "@/components/site/Footer";
import { Hero } from "@/components/site/Hero";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Intro } from "@/components/site/Intro";
import { Marquee } from "@/components/site/Marquee";
import { AreasServed } from "@/components/site/AreasServed";
import { MenuSection } from "@/components/site/MenuSection";
import { PlanCards } from "@/components/site/PlanCards";
import { PostCards } from "@/components/site/PostCards";
import { PromiseSection } from "@/components/site/Promise";
import { Testimonials } from "@/components/site/Testimonials";
import { graph, organization, restaurant, website } from "@/lib/jsonld";
import { getPlans, getPublicMenu, getPublicSettings, getPublishedPosts, getTestimonials } from "@/lib/server/content";
import { SITE_DESCRIPTION } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Healthy Salads & Salad Delivery in Vadodara | Leafli" },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

export default async function Home() {
  const [menu, settings, plans, posts, testimonials] = await Promise.all([
    getPublicMenu().catch(() => null),
    getPublicSettings().catch(() => null),
    getPlans().catch(() => []),
    getPublishedPosts().catch(() => []),
    getTestimonials().catch(() => []),
  ]);

  return (
    <main>
      {settings && menu && <JsonLd data={graph(organization(settings), website(), restaurant(settings, menu.items))} />}
      <Intro />
      <Hero />
      <Marquee />
      {/* Social proof is the highlight — straight after the hero */}
      <Testimonials items={testimonials} googleUrl={settings?.googleReviewUrl} zomatoUrl={settings?.zomatoUrl} />
      <BowlsShowcase />
      <PromiseSection />

      {plans.length > 0 && (
        <section className="bg-lime-400 py-24 md:py-32" aria-labelledby="plans-h">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="mb-4 text-sm font-semibold tracking-[0.2em] text-leaf-800 uppercase">Subscribe & save</p>
                <h2 id="plans-h" className="max-w-2xl font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.95] font-medium tracking-[-0.03em] text-leaf-900">
                  Lunch, sorted for the month.
                </h2>
              </div>
              <Link href="/plans" className="rounded-full bg-leaf-800 px-6 py-3 font-semibold text-cream-50 transition-colors hover:bg-leaf-900">
                Compare all plans →
              </Link>
            </div>
            <PlanCards plans={plans} />
          </div>
        </section>
      )}

      <HowItWorks />
      <MenuSection />
      <AreasServed />

      {posts.length > 0 && (
        <section className="bg-cream-50 py-24 md:py-32" aria-labelledby="blog-h">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="mb-4 text-sm font-semibold tracking-[0.2em] text-leaf-600 uppercase">From the Leafli kitchen</p>
                <h2 id="blog-h" className="font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.95] font-medium tracking-[-0.03em]">Eat well, read well.</h2>
              </div>
              <Link href="/blog" className="font-semibold text-leaf-700 hover:underline">All articles →</Link>
            </div>
            <PostCards posts={posts.slice(0, 3)} />
          </div>
        </section>
      )}
      <ClosingCta />
    </main>
  );
}
