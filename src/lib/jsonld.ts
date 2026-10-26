// schema.org builders (https://developers.google.com/search/docs/appearance/structured-data)
import { absoluteUrl, LOCAL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "./site";
import type { Plan, Post } from "./types";
import type { PublicDish, PublicSettings } from "./server/content";

const LOGO = absoluteUrl("/brand/leafli-logo.png");

const CITY = { "@type": "City", name: LOCAL.city, alternateName: LOCAL.altName, containedInPlace: { "@type": "State", name: LOCAL.region } };
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function organization(s: PublicSettings) {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    legalName: s.legalName || undefined,
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: LOGO, width: 600, height: 600 },
    sameAs: ["https://www.instagram.com/leafli.in", s.zomatoUrl, s.googleReviewUrl].filter(Boolean),
    areaServed: CITY,
    ...(s.email || s.phone ? { contactPoint: { "@type": "ContactPoint", contactType: "customer service", email: s.email || undefined, telephone: s.phone ? `+91${s.phone.replace(/\D/g, "").slice(-10)}` : undefined, areaServed: CITY, availableLanguage: ["en", "hi", "gu"] } } : {}),
  };
}

/** Restaurant (LocalBusiness) — no self-hosted review ratings, per Google's review-snippet policy. */
export function restaurant(s: PublicSettings, dishes: PublicDish[]) {
  const a = s.address;
  return {
    "@type": "Restaurant",
    "@id": `${SITE_URL}/#restaurant`,
    name: SITE_NAME,
    alternateName: `${SITE_NAME} ${LOCAL.city}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    image: dishes.map((d) => d.photoUrl || d.imageUrl).filter(Boolean).slice(0, 6),
    logo: LOGO,
    servesCuisine: ["Salads", "Healthy food", "Salad bowls", "Vegetarian", "Continental", "Indian"],
    keywords: `salad delivery ${LOCAL.city}, healthy food ${LOCAL.city}, salads in ${LOCAL.altName}, high protein salads, salad subscription`,
    priceRange: "₹₹",
    currenciesAccepted: "INR",
    paymentAccepted: "UPI, Credit card, Debit card, Net banking, Cash",
    hasMenu: absoluteUrl("/menu"),
    acceptsReservations: false,
    telephone: s.phone ? `+91${s.phone.replace(/\D/g, "").slice(-10)}` : undefined,
    email: s.email || undefined,
    address: {
      "@type": "PostalAddress",
      ...(a?.line1 ? { streetAddress: [a.line1, a.line2].filter(Boolean).join(", ") } : {}),
      addressLocality: LOCAL.city,
      addressRegion: LOCAL.region,
      ...(a?.pincode ? { postalCode: a.pincode } : {}),
      addressCountry: "IN",
    },
    ...(a?.lat != null ? { geo: { "@type": "GeoCoordinates", latitude: a.lat, longitude: a.lng }, hasMap: `https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}` } : {}),
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: DAYS, opens: s.orderingHours?.opens || LOCAL.opens, closes: s.orderingHours?.closes || LOCAL.closes }],
    areaServed: [CITY, ...LOCAL.areas.map((n) => ({ "@type": "Place", name: `${n}, ${LOCAL.city}` }))],
    potentialAction: {
      "@type": "OrderAction",
      target: { "@type": "EntryPoint", urlTemplate: absoluteUrl("/menu"), inLanguage: "en-IN", actionPlatform: ["https://schema.org/DesktopWebPlatform", "https://schema.org/MobileWebPlatform"] },
      deliveryMethod: ["http://purl.org/goodrelations/v1#DeliveryModeOwnFleet"],
    },
    parentOrganization: { "@id": `${SITE_URL}/#organization` },
  };
}

export function website() {
  return { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: SITE_NAME, alternateName: `${SITE_NAME} — salads in ${LOCAL.city}`, inLanguage: "en-IN", publisher: { "@id": `${SITE_URL}/#organization` } };
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
    offers: { "@type": "Offer", price: d.price, priceCurrency: "INR", availability: d.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: absoluteUrl(`/menu/${d.slug}`), areaServed: CITY },
  };
}

export function menu(dishes: PublicDish[]) {
  const cats = [...new Set(dishes.map((d) => d.category))];
  return {
    "@type": "Menu",
    "@id": absoluteUrl("/menu#menu"),
    name: `Leafli menu — salads and healthy bowls in ${LOCAL.city}`,
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
    name: `${p.name} — Leafli salad subscription, ${LOCAL.city}`,
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
      areaServed: CITY,
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
