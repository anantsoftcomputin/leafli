import Link from "next/link";
import { LOCAL } from "@/lib/site";

/** Where we deliver in Vadodara — real, crawlable copy for local search and for customers checking coverage. */
export function AreasServed({ headingLevel = "h2" }: { headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  return (
    <section className="bg-cream-50 py-20 md:py-28" aria-labelledby="areas-h">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        <div>
          <p className="mb-4 text-sm font-semibold tracking-[0.2em] text-leaf-600 uppercase">Delivering across {LOCAL.city}</p>
          <H id="areas-h" className="font-display text-[clamp(2.2rem,4.6vw,3.8rem)] leading-[0.98] font-medium tracking-[-0.03em]">
            Fresh salads &amp; healthy food, all over {LOCAL.city}.
          </H>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink/70">
            Leafli is a {LOCAL.city} cloud kitchen in {LOCAL.kitchenArea}. We make chef-made salads, high-protein bowls and fruit bowls to order and deliver them chilled across {LOCAL.altName}. Dressings
            come on the side, so your bowl arrives as crisp as it left our kitchen.
          </p>
          <dl className="mt-8 grid max-w-md grid-cols-2 gap-4 text-sm">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
              <dt className="font-semibold text-leaf-700">Open</dt>
              <dd className="mt-1 text-ink/70">{LOCAL.hoursLabel}</dd>
            </div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
              <dt className="font-semibold text-leaf-700">Kitchen</dt>
              <dd className="mt-1 text-ink/70">{LOCAL.kitchenArea}, {LOCAL.city}</dd>
            </div>
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/menu" className="rounded-full bg-leaf-700 px-6 py-3 font-semibold text-cream-50 hover:bg-leaf-800">See the menu</Link>
            <Link href="/plans" className="rounded-full px-6 py-3 font-semibold text-leaf-700 ring-1 ring-leaf-700/20 hover:bg-leaf-700/5">Salad subscriptions</Link>
          </div>
        </div>
        <div>
          <H className="text-sm font-semibold tracking-[0.2em] text-ink/50 uppercase">Areas we deliver to</H>
          <ul className="mt-4 flex flex-wrap gap-2">
            {LOCAL.areas.map((a) => (
              <li key={a} className="rounded-full bg-white px-3.5 py-1.5 text-sm text-ink/80 ring-1 ring-ink/5">
                {a}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-ink/60">
            …and the rest of {LOCAL.city} city. Enter your address at checkout to see delivery for your street, or read our <Link href="/delivery-policy" className="font-semibold text-leaf-700 hover:underline">delivery policy</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}
