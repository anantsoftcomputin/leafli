import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageShell";
import { getPublicSettings } from "@/lib/server/content";

export const metadata: Metadata = {
  title: "Contact Leafli — Orders, Subscriptions & Catering",
  description: "Get in touch with Leafli for help with an order or subscription, bulk and office lunch orders, or partnerships.",
  alternates: { canonical: "/contact" },
};

export default async function Contact() {
  const s = await getPublicSettings().catch(() => null);
  const a = s?.address;
  const maps = a?.lat != null ? `https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}` : null;
  const cards = [
    s?.phone && { t: "Call or WhatsApp", v: s.phone, href: `tel:${s.phone}` },
    s?.email && { t: "Email", v: s.email, href: `mailto:${s.email}` },
    { t: "Instagram", v: "@leafli.in", href: "https://www.instagram.com/leafli.in" },
  ].filter(Boolean) as { t: string; v: string; href: string }[];
  return (
    <main>
      <PageHero crumbs={[{ name: "Contact", path: "/contact" }]} eyebrow="Say hello" title="We'd love to hear from you." intro="Questions about an order, a subscription, office lunches or bulk orders — reach us any way you like." />
      <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-24 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
        {cards.map((c) => (
          <a key={c.t} href={c.href} className="rounded-[1.75rem] bg-white p-8 ring-1 ring-ink/5 transition-shadow hover:shadow-xl">
            <p className="text-sm font-semibold tracking-wider text-leaf-600 uppercase">{c.t}</p>
            <p className="mt-3 font-display text-2xl break-words">{c.v}</p>
          </a>
        ))}
        {a?.line1 && (
          <div className="rounded-[1.75rem] bg-white p-8 ring-1 ring-ink/5 sm:col-span-2 lg:col-span-3">
            <p className="text-sm font-semibold tracking-wider text-leaf-600 uppercase">Kitchen</p>
            <address className="mt-3 text-lg not-italic">{[a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ")}</address>
            <p className="mt-1 text-sm text-ink/50">Delivery-only cloud kitchen — no dine-in.</p>
            {maps && <a href={maps} target="_blank" rel="noreferrer" className="mt-4 inline-flex font-semibold text-leaf-700 hover:underline">Open in Google Maps ↗</a>}
          </div>
        )}
      </section>
    </main>
  );
}
