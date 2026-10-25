import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { MenuSection } from "@/components/site/MenuSection";
import { PageHero } from "@/components/site/PageShell";
import { graph, menu as menuLd } from "@/lib/jsonld";
import { getPublicMenu } from "@/lib/server/content";

export const metadata: Metadata = {
  title: { absolute: "Salad Menu Vadodara — Healthy Bowls Delivered | Leafli" },
  description:
    "Order salads online in Vadodara: Chicken Caesar, Salad Caprese, Asian Noodle Salad and more, with calories, allergens and prices. Delivered fresh, 11 am–11 pm.",
  alternates: { canonical: "/menu" },
};

export default async function MenuPage() {
  const menu = await getPublicMenu();
  return (
    <main>
      <JsonLd data={graph(menuLd(menu.items))} />
      <PageHero
        crumbs={[{ name: "Menu", path: "/menu" }]}
        eyebrow="Salads & healthy bowls in Vadodara"
        title={<>Bowls worth <em className="text-leaf-600 italic">craving.</em></>}
        intro="Every bowl is assembled to order in our Akota kitchen from small-batch prep, weighed to the gram, with dressings sealed on the side so nothing goes soggy on the way to you anywhere in Vadodara."
      />
      <MenuSection hideHeading />
    </main>
  );
}
