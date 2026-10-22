"use client";

import Link from "next/link";
import { useRef } from "react";
import { gsap, MOTION_OK, SplitText, useGSAP } from "@/lib/gsap";
import { rupees as inr } from "@/lib/costing";
import { DietDot } from "@/components/DietDot";
import { DISH_THEME } from "./DishArt";
import { DishImage } from "./DishImage";
import { useSite } from "./SiteContext";
import { AddButton } from "./AddButton";

/**
 * Pinned horizontal gallery: scrolling vertically slides the bowls sideways,
 * each bowl spinning into place as it reaches the centre.
 */
export function BowlsShowcase() {
  const root = useRef<HTMLElement>(null);
  const { menu } = useSite();
  const bowls = menu.items;

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();
      const split = SplitText.create(q("[data-title]"), { type: "words", mask: "words" });

      mm.add(MOTION_OK, () => {
        gsap.from(split.words, {
          yPercent: 110,
          stagger: 0.06,
          duration: 1,
          ease: "expo.out",
          scrollTrigger: { trigger: q("[data-title]")[0], start: "top 85%" },
        });
      });

      // Horizontal pin only where there's room for it.
      mm.add(`${MOTION_OK} and (min-width: 1024px)`, () => {
        const track = q("[data-track]")[0] as HTMLElement;
        const distance = () => track.scrollWidth - window.innerWidth + 64;
        const tween = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: q("[data-pin]")[0],
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.8,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        });
        q("[data-card]").forEach((card) => {
          const art = card.querySelector("[data-art]");
          gsap.fromTo(art, { rotate: -70, scale: 0.8 }, { rotate: 0, scale: 1, ease: "none", scrollTrigger: { trigger: card, containerAnimation: tween, start: "left right", end: "center center", scrub: true } });
          gsap.from(card.querySelectorAll("[data-card-copy] > *"), { y: 30, opacity: 0, stagger: 0.06, scrollTrigger: { trigger: card, containerAnimation: tween, start: "left 75%" } });
        });
        gsap.to(q("[data-progress]"), { scaleX: 1, ease: "none", scrollTrigger: { trigger: q("[data-pin]")[0], start: "top top", end: () => `+=${distance()}`, scrub: true } });
      });

      // Mobile: simple per-card reveal in a native swipe carousel.
      mm.add(`${MOTION_OK} and (max-width: 1023px)`, () => {
        q("[data-card]").forEach((card) =>
          gsap.from(card.querySelector("[data-art]"), { rotate: -45, scale: 0.85, duration: 1.2, scrollTrigger: { trigger: card, start: "top 85%" } }),
        );
      });
      return () => {
        mm.revert();
        split.revert();
      };
    },
    { scope: root, dependencies: [bowls.length], revertOnUpdate: true },
  );

  return (
    <section id="bowls" ref={root} className="relative scroll-mt-0 bg-cream-100">
      <div data-pin className="relative overflow-hidden py-20 lg:flex lg:h-[100svh] lg:flex-col lg:justify-center lg:py-0">
        <div className="mx-auto mb-10 flex w-full max-w-7xl items-end justify-between gap-6 px-5 sm:px-8 lg:mb-12">
          <h2 data-title className="max-w-2xl font-display text-[clamp(2.4rem,5.5vw,4.6rem)] leading-[0.95] font-medium tracking-[-0.03em]">
            Six bowls. <em className="text-leaf-600 italic">Zero</em> soggy leaves.
          </h2>
          <p className="hidden max-w-xs text-sm text-ink/60 md:block">Every dressing travels in its own sealed cup. You toss, you taste, it crunches.</p>
        </div>
        <div className="snap-x snap-mandatory overflow-x-auto px-5 pb-4 sm:px-8 lg:overflow-visible lg:pb-0">
          <div data-track className="flex w-max gap-5 lg:gap-8 lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))]">
            {bowls.map((b, i) => {
              const t = DISH_THEME[b.id] ?? DISH_THEME["chicken-caesar"]!;
              return (
                <article
                  key={b.id}
                  data-card
                  className="relative flex w-[82vw] shrink-0 snap-center flex-col overflow-hidden rounded-[2rem] p-6 sm:w-[24rem] lg:h-[34rem] lg:w-[30rem] lg:p-8"
                  style={{ background: t.bg, color: t.fg }}
                >
                  <div className="flex items-center justify-between text-xs font-semibold tracking-wider uppercase opacity-70">
                    <span>{String(i + 1).padStart(2, "0")} / {String(bowls.length).padStart(2, "0")}</span>
                    <span className="rounded-full px-2.5 py-1" style={{ background: `${t.fg}14` }}>{t.tag}</span>
                  </div>
                  <div data-art className="mx-auto my-4 w-[78%] lg:my-2 lg:w-[62%]">
                    <DishImage id={b.id} src={b.imageUrl} alt={b.name} className="w-full drop-shadow-[0_24px_30px_rgba(0,0,0,.18)]" />
                  </div>
                  <div data-card-copy className="mt-auto">
                    <div className="flex items-start gap-2">
                      <DietDot diet={b.diet} />
                      <h3 className="font-display text-2xl leading-tight font-medium tracking-tight lg:text-3xl">
                        {b.slug ? <Link href={`/menu/${b.slug}`} className="hover:underline">{b.name}</Link> : b.name}
                      </h3>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm opacity-75">{b.description}</p>
                    <div className="mt-5 flex items-center justify-between">
                      <span className="font-display text-2xl font-semibold">{inr(b.price)}</span>
                      <AddButton item={b} accent={t.fg} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <div className="mx-auto mt-10 hidden h-1 w-full max-w-7xl px-8 lg:block">
          <div className="h-full overflow-hidden rounded-full bg-ink/10">
            <div data-progress className="h-full origin-left scale-x-0 rounded-full bg-leaf-600" />
          </div>
        </div>
      </div>
    </section>
  );
}
