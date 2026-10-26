"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Flip, gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { rupees as inr } from "@/lib/costing";
import { DietDot } from "@/components/DietDot";
import { AddButton } from "./AddButton";
import { DISH_THEME } from "./DishArt";
import { DishImage } from "./DishImage";
import { useSite } from "./SiteContext";

const FILTERS = [
  { key: "all", label: "Everything" },
  { key: "veg", label: "Veg" },
  { key: "egg", label: "With egg" },
  { key: "nonveg", label: "Non-veg" },
  { key: "Desserts", label: "Sweet" },
] as const;

export function MenuSection({ hideHeading }: { hideHeading?: boolean } = {}) {
  const root = useRef<HTMLElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const flipState = useRef<Flip.FlipState | null>(null);
  const { menu, kitchen, live } = useSite();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const match = (i: (typeof menu.items)[number]) =>
    filter === "all" ? true : filter === "Desserts" ? i.category === "Desserts" : i.diet === filter;

  function choose(f: typeof filter) {
    if (grid.current) flipState.current = Flip.getState(grid.current.querySelectorAll("[data-menu-card]"));
    setFilter(f);
  }

  // Animate the layout change between filters.
  useGSAP(
    () => {
      if (!flipState.current) return;
      Flip.from(flipState.current, {
        duration: 0.7,
        ease: "power3.inOut",
        absolute: true,
        scale: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.6 }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.4 }),
      });
      flipState.current = null;
    },
    { dependencies: [filter], scope: grid },
  );

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(q("[data-menu-head] > *"), { y: 40, opacity: 0, stagger: 0.1, duration: 1, ease: "expo.out", scrollTrigger: { trigger: root.current, start: "top 75%" } });
        gsap.from(q("[data-menu-card]"), { y: 60, opacity: 0, stagger: 0.08, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: grid.current, start: "top 85%" } });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section id="menu" ref={root} className={`scroll-mt-20 bg-cream-100 ${hideHeading ? "pb-24" : "py-24 md:py-32"}`}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div data-menu-head className="flex flex-wrap items-end justify-between gap-6">
          <div>
            {!hideHeading && (
              <>
                <p className="mb-4 text-sm font-semibold tracking-[0.2em] text-leaf-600 uppercase">The menu</p>
                <h2 className="font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.95] font-medium tracking-[-0.03em]">What are you craving?</h2>
              </>
            )}
          </div>
        </div>
        <div className="no-scrollbar sticky top-16 z-20 lg:top-18 mt-4 lg:mt-8 -mx-5 flex w-[calc(100%+2.5rem)] gap-2 overflow-x-auto bg-cream-100/90 px-5 py-3 backdrop-blur sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:bg-transparent sm:p-0 sm:backdrop-blur-none" role="tablist" aria-label="Filter menu">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => choose(f.key)}
              className={`tap shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${filter === f.key ? "bg-leaf-700 text-cream-50 shadow-lg shadow-leaf-900/15" : "bg-white text-ink/70 ring-1 ring-ink/10 hover:ring-ink/25"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {!live && <p className="mt-6 text-sm text-ink/50">Showing our signature bowls — live availability loads when ordering opens.</p>}
        {live && !kitchen.open && (
          <p role="status" className="mt-6 rounded-2xl bg-mango/20 px-4 py-3 text-sm font-medium text-ink/80">🕘 {kitchen.message}</p>
        )}

        <div ref={grid} className="mt-6 grid gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {menu.items.filter(match).map((i) => {
            const t = DISH_THEME[i.id] ?? { bg: "#e9f1d8", fg: "#1f4d33" };
            const open = openId === i.id;
            return (
              <article
                key={i.id}
                data-menu-card
                data-flip-id={i.id}
                className={`group relative flex gap-4 overflow-hidden rounded-[1.5rem] bg-white p-3 ring-1 ring-ink/5 transition-shadow duration-500 hover:shadow-2xl hover:shadow-leaf-900/10 sm:flex-col sm:gap-0 sm:rounded-[1.75rem] sm:p-5 ${!i.available ? "opacity-60" : ""}`}
              >
                {/* Phones: compact row (photo left). Larger screens: tall card. */}
                <div className="relative grid size-28 shrink-0 place-items-center overflow-hidden rounded-[1.1rem] sm:mb-5 sm:aspect-[4/3] sm:size-auto sm:rounded-[1.25rem]" style={{ background: t.bg }}>
                  <DishImage id={i.id} src={i.imageUrl} alt={i.name} className="w-[88%] drop-shadow-[0_12px_18px_rgba(0,0,0,.16)] transition-transform duration-[1.2s] ease-[var(--ease-spring)] group-hover:scale-110 group-hover:rotate-[25deg] sm:w-[74%]" />
                  {!i.available && <span className="absolute top-2 left-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white sm:top-3 sm:left-3 sm:px-3 sm:py-1 sm:text-xs">Sold out</span>}
                </div>
                <div className="flex min-w-0 flex-1 flex-col py-1 sm:py-0">
                  <div className="flex items-start gap-2">
                    <DietDot diet={i.diet} />
                    <h3 className="font-display text-[1.05rem] leading-tight font-medium tracking-tight sm:text-xl">
                      {i.slug ? <Link href={`/menu/${i.slug}`} className="hover:text-leaf-700 hover:underline">{i.name}</Link> : i.name}
                    </h3>
                  </div>
                  {i.nutrition && (i.nutrition.calories || i.nutrition.protein) ? (
                    <div className="mt-1.5 flex gap-1.5 text-[10px] font-semibold text-leaf-700 sm:mt-2 sm:text-[11px]">
                      {i.nutrition.calories ? <span className="rounded-full bg-lime-300/60 px-2 py-0.5">{i.nutrition.calories} kcal</span> : null}
                      {i.nutrition.protein ? <span className="rounded-full bg-lime-300/60 px-2 py-0.5">{i.nutrition.protein} g protein</span> : null}
                    </div>
                  ) : null}
                  <p className={`mt-1.5 text-[13px] leading-snug text-ink/60 sm:mt-2 sm:text-sm sm:leading-relaxed ${open ? "" : "line-clamp-2"}`}>{i.description}</p>
                  <button className="mt-1 hidden self-start text-xs font-semibold text-leaf-600 hover:underline sm:block" onClick={() => setOpenId(open ? null : i.id)} aria-expanded={open}>
                    {open ? "Less" : "Allergens & details"}
                  </button>
                  {open && (
                    <p className="mt-2 rounded-xl bg-cream-100 px-3 py-2 text-xs text-ink/70">
                      <b>Contains:</b> {i.allergens.length ? i.allergens.join(", ") : "No major allergens listed"}. Made in a kitchen that handles nuts, sesame, soy, gluten, egg and dairy.
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2 sm:pt-5">
                    <span className="font-display text-lg font-semibold sm:text-2xl">{inr(i.price)}</span>
                    <AddButton item={i} accent="#1f4d33" size="sm" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
