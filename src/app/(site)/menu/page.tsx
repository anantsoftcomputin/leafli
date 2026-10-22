import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { MenuSection } from "@/components/site/MenuSection";
import { PageHero } from "@/components/site/PageShell";
import { graph, menu as menuLd } from "@/lib/jsonld";
import { getPublicMenu } from "@/lib/server/content";

export const metadata: Metadata = {
  title: "Menu — Fresh Salads & Healthy Bowls",
  description:
    "Browse the Leafli menu — Chicken Caesar, Salad Caprese, Asian Noodle Salad and more, with calories, allergens and prices for every bowl. Order online.",
  alternates: { canonical: "/menu" },
};

export default async function MenuPage() {
  const menu = await getPublicMenu();
  return (
    <main>
      <JsonLd data={graph(menuLd(menu.items))} />
      <PageHero
        crumbs={[{ name: "Menu", path: "/menu" }]}
        eyebrow="The Leafli menu"
        title={<>Bowls worth <em className="text-leaf-600 italic">craving.</em></>}
        intro="Every bowl is assembled to order from small-batch prep, weighed to the gram, with dressings sealed on the side so nothing goes soggy on the way to you."
      />
      <MenuSection hideHeading />
    </main>
  );
}
