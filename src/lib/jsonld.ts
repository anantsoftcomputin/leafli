// schema.org builders (https://developers.google.com/search/docs/appearance/structured-data)
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "./site";
import type { Plan, Post } from "./types";
import type { PublicDish, PublicSettings } from "./server/content";

const LOGO = absoluteUrl("/brand/leafli-logo.png");

export function organization(s: PublicSettings) {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    legalName: s.legalName || undefined,
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: LOGO, width: 600, height: 600 },
    sameAs: ["https://www.instagram.com/leafli.in"],
    ...(s.email || s.phone ? { contactPoint: { "@type": "ContactPoint", contactType: "customer service", email: s.email || undefined, telephone: s.phone || undefined, areaServed: "IN", availableLanguage: ["en", "hi"] } } : {}),
  };
}

/** Restaurant (LocalBusiness) — no self-hosted review ratings, per Google's review-snippet policy. */
export function restaurant(s: PublicSettings, dishes: PublicDish[]) {
  const a = s.address;
  return {
    "@type": "Restaurant",
    "@id": `${SITE_URL}/#restaurant`,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    image: dishes.map((d) => d.photoUrl || d.imageUrl).filter(Boolean).slice(0, 6),
    logo: LOGO,
    servesCuisine: ["Salads", "Healthy", "Continental", "Indian"],
    priceRange: "₹₹",
    hasMenu: absoluteUrl("/menu"),
    acceptsReservations: false,
    telephone: s.phone || undefined,
    email: s.email || undefined,
    ...(a?.line1
      ? {
          address: { "@type": "PostalAddress", streetAddress: [a.line1, a.line2].filter(Boolean).join(", "), addressLocality: a.city, addressRegion: a.state, postalCode: a.pincode, addressCountry: "IN" },
        }
      : {}),
    ...(a?.lat != null ? { geo: { "@type": "GeoCoordinates", latitude: a.lat, longitude: a.lng } } : {}),
    parentOrganization: { "@id": `${SITE_URL}/#organization` },
  };
}

export function website() {
  return { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: SITE_NAME, inLanguage: "en-IN", publisher: { "@id": `${SITE_URL}/#organization` } };
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

const DIET: Record<PublicDish["diet"], string | undefined> = {
  veg: "https://schema.org/VegetarianDiet",
  egg: undefined,
  nonveg: undefined,
};

export function menuItem(d: PublicDish) {
  return {
    "@type": "MenuItem",
    "@id": absoluteUrl(`/menu/${d.slug}#item`),
    name: d.name,
    description: d.description,
    url: absoluteUrl(`/menu/${d.slug}`),
    image: d.photoUrl || d.imageUrl || undefined,
    suitableForDiet: DIET[d.diet],
    ...(d.nutrition?.calories ? { nutrition: { "@type": "NutritionInformation", calories: `${d.nutrition.calories} calories`, ...(d.nutrition.protein ? { proteinContent: `${d.nutrition.protein} g` } : {}) } } : {}),
    offers: { "@type": "Offer", price: d.price, priceCurrency: "INR", availability: d.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: absoluteUrl(`/menu/${d.slug}`) },
  };
}

export function menu(dishes: PublicDish[]) {
  const cats = [...new Set(dishes.map((d) => d.category))];
  return {
    "@type": "Menu",
    "@id": absoluteUrl("/menu#menu"),
    name: "Leafli menu",
    url: absoluteUrl("/menu"),
    inLanguage: "en-IN",
    hasMenuSection: cats.map((c) => ({ "@type": "MenuSection", name: c, hasMenuItem: dishes.filter((d) => d.category === c).map(menuItem) })),
  };
}

export function faqPage(faqs: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function planProduct(p: Plan) {
  return {
    "@type": "Product",
    "@id": absoluteUrl(`/plans/${p.slug}#product`),
    name: `${p.name} — Leafli salad subscription`,
    description: p.description,
    brand: { "@type": "Brand", name: SITE_NAME },
    category: "Meal subscription",
    image: LOGO,
    offers: {
      "@type": "Offer",
      price: p.price,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: absoluteUrl(`/plans/${p.slug}`),
      seller: { "@id": `${SITE_URL}/#organization` },
    },
  };
}

export function blogPosting(p: Post, html: { wordCount: number }) {
  return {
    "@type": p.schemaType || "BlogPosting",
    "@id": absoluteUrl(`/blog/${p.slug}#article`),
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(`/blog/${p.slug}`) },
    headline: (p.metaTitle || p.title).slice(0, 110),
    description: p.metaDescription || p.excerpt,
    image: [p.coverImage || p.ogImage || absoluteUrl("/opengraph-image")],
    datePublished: new Date(p.publishedAt ?? p.createdAt).toISOString(),
    dateModified: new Date(p.updatedAt).toISOString(),
    author: { "@type": "Person", name: p.authorName, ...(p.authorBio ? { description: p.authorBio } : {}), url: absoluteUrl("/about") },
    publisher: { "@id": `${SITE_URL}/#organization` },
    articleSection: p.category,
    keywords: [p.focusKeyword, ...(p.secondaryKeywords ?? []), ...p.tags].filter(Boolean).join(", "),
    wordCount: html.wordCount,
    inLanguage: "en-IN",
  };
}

export const graph = (...nodes: Record<string, unknown>[]) => ({ "@context": "https://schema.org", "@graph": nodes });
