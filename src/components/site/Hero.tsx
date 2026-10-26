"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap, MOTION_OK, SplitText, useGSAP } from "@/lib/gsap";
import { Clock } from "lucide-react";
import { DEFAULT_HOURS, hoursLabel } from "@/lib/hours";
import { DishImage } from "./DishImage";
import { DISH_THEME } from "./DishArt";
import { useSite } from "./SiteContext";
import { Basil, Chilli, Lemon, Mango, Sesame, Tomato } from "./Garnish";

// Mobile positions cluster around the bowl at the top; desktop positions frame the whole hero.
const FLOATERS = [
  { C: Basil, cls: "left-[3%] top-[11%] w-11 lg:left-[4%] lg:top-[18%] lg:w-20", depth: 1.6, rot: -20 },
  { C: Tomato, cls: "right-[6%] top-[9%] w-10 lg:right-auto lg:left-[44%] lg:top-[10%] lg:w-16", depth: 1.1, rot: 15 },
  { C: Lemon, cls: "left-[1%] top-[24%] w-12 lg:left-auto lg:right-[3%] lg:top-[16%] lg:w-24", depth: 2.2, rot: 10 },
  { C: Chilli, cls: "hidden lg:block right-[8%] bottom-[12%] w-24", depth: 1.4, rot: -10 },
  { C: Mango, cls: "left-[4%] top-[38%] w-9 lg:top-auto lg:left-[46%] lg:bottom-[8%] lg:w-14", depth: 2, rot: 20 },
  { C: Sesame, cls: "hidden lg:block left-[10%] bottom-[16%] w-16", depth: 0.8, rot: 0 },
];

const ROTATE_MS = 4500;

export function Hero() {
  const root = useRef<HTMLElement>(null);
  const { menu } = useSite();
  // Every available bowl with a photo; the Chicken Caesar comes last so the hero opens on a veg bowl.
  const dishes = useMemo(() => {
    const list = menu.items.filter((d) => d.available && d.imageUrl);
    const caesar = list.findIndex((d) => d.id === "chicken-caesar");
    if (caesar >= 0 && caesar < list.length - 1) list.push(...list.splice(caesar, 1));
    return list.length ? list : menu.items.slice(0, 1);
  }, [menu.items]);
  const [active, setActive] = useState(0);
  const [label, setLabel] = useState(0); // swaps mid-transition so text and bowl change together
  const [paused, setPaused] = useState(false);
  const busy = useRef(false);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.set(q("[data-reveal]"), { visibility: "visible" });
        const split = SplitText.create(q("[data-headline]"), { type: "lines,words", mask: "lines", linesClass: "split-line" });
        let introPlaying = false;
        try {
          introPlaying = !sessionStorage.getItem("leafli-intro-played");
          sessionStorage.setItem("leafli-intro-played", "1");
        } catch {}

        // Starts while the intro curtain is lifting, so there's no dead time.
        const tl = gsap.timeline({ delay: introPlaying ? 1.55 : 0.05 });
        tl.from(split.words, { yPercent: 115, rotate: 4, stagger: 0.05, duration: 0.9, ease: "expo.out" })
          .from(q("[data-underline]"), { drawSVG: "0%", duration: 0.7, ease: "power2.inOut" }, 0.45)
          .from(q("[data-sub]"), { y: 24, opacity: 0, duration: 0.7 }, 0.3)
          .fromTo(q("[data-cta] > *"), { y: 20, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.06, duration: 0.6 }, 0.42)
          .from(q("[data-chip]"), { y: 16, opacity: 0, stagger: 0.04, duration: 0.5 }, 0.5)
          .from(q("[data-blob]"), { scale: 0.4, opacity: 0, duration: 1.3, ease: "elastic.out(1, 0.6)" }, 0)
          .from(q("[data-hero-bowl]"), { scale: 0.6, rotate: -90, opacity: 0, duration: 1.2, ease: "expo.out" }, 0.05)
          .from(q("[data-floater]"), { scale: 0, opacity: 0, stagger: 0.06, duration: 0.8, ease: "back.out(1.7)" }, 0.45);

        // Bowl keeps turning slowly — like it's on a lazy susan.
        gsap.to(q("[data-spin]"), { rotate: 360, duration: 90, repeat: -1, ease: "none" });
        // Floaters bob gently.
        q("[data-floater]").forEach((el, i) =>
          gsap.to(el, { y: "+=14", rotate: `+=${i % 2 ? 8 : -8}`, duration: 2.6 + i * 0.3, repeat: -1, yoyo: true, ease: "sine.inOut" }),
        );

        // Scroll: bowl drifts down & grows; copy lifts away.
        gsap.to(q("[data-hero-bowl]"), { yPercent: 18, scale: 1.08, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } });
        gsap.to(q("[data-copy]"), { yPercent: -12, opacity: 0.2, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } });
        q("[data-floater]").forEach((el) => {
          const d = Number(el.dataset.depth);
          gsap.to(el, { yPercent: -60 * d, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } });
        });
      });

      // Pointer parallax (desktop, fine pointer only).
      mm.add(`${MOTION_OK} and (pointer: fine)`, () => {
        const items = q("[data-parallax]").map((el) => ({
          d: Number(el.dataset.depth),
          x: gsap.quickTo(el, "x", { duration: 0.9, ease: "power3" }),
          y: gsap.quickTo(el, "y", { duration: 0.9, ease: "power3" }),
        }));
        const move = (e: PointerEvent) => {
          const nx = e.clientX / window.innerWidth - 0.5;
          const ny = e.clientY / window.innerHeight - 0.5;
          items.forEach((it) => {
            it.x(nx * 30 * it.d);
            it.y(ny * 30 * it.d);
          });
        };
        window.addEventListener("pointermove", move);
        return () => window.removeEventListener("pointermove", move);
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  /** Spin the current bowl out and the next one in; label flips at the midpoint. */
  const goTo = useCallback(
    (next: number) => {
      if (busy.current || next === active || !root.current) return;
      const slides = root.current.querySelectorAll<HTMLElement>("[data-slide]");
      const out = slides[active];
      const inn = slides[next];
      const labelEl = root.current.querySelector("[data-hero-label]");
      const blob = root.current.querySelector("[data-blob-tint]");
      if (!out || !inn) return;
      busy.current = true;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const tint = DISH_THEME[dishes[next]!.id]?.bg ?? "#dfe98a";
      const tl = gsap.timeline({
        onComplete: () => {
          busy.current = false;
          setActive(next);
        },
      });
      if (reduce) {
        tl.to(out, { opacity: 0, duration: 0.5 }).fromTo(inn, { opacity: 0, scale: 1, rotate: 0 }, { opacity: 1, duration: 0.5 }, 0).call(() => setLabel(next), [], 0.25);
        return;
      }
      tl.to(out, { scale: 0.72, rotate: "+=70", opacity: 0, duration: 0.55, ease: "power2.in" })
        .fromTo(inn, { scale: 0.55, rotate: -110, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 1.1, ease: "expo.out" }, 0.32)
        .to(blob, { backgroundColor: tint, duration: 0.9, ease: "power2.inOut" }, 0.2)
        .fromTo(blob, { scale: 0.94 }, { scale: 1, duration: 1.2, ease: "elastic.out(1, 0.5)" }, 0.35)
        .to(labelEl, { y: -12, opacity: 0, duration: 0.25, ease: "power2.in" }, 0.15)
        .call(() => setLabel(next), [], 0.42)
        .fromTo(labelEl, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "back.out(2)" }, 0.45);
    },
    [active, dishes],
  );

  useEffect(() => {
    if (dishes.length < 2 || paused) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") goTo((active + 1) % dishes.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [active, dishes.length, paused, goTo]);

  const current = dishes[label] ?? dishes[0];

  return (
    <section ref={root} className="grain relative overflow-hidden pt-20 pb-12 md:pt-32 lg:min-h-[100svh] lg:pb-24">
      <div className="mx-auto grid max-w-7xl items-center gap-4 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div data-copy className="relative z-10 min-w-0">
          <p data-reveal data-chip className="inline-flex items-center gap-2 rounded-full border border-leaf-700/15 bg-white/60 px-3 py-1.5 text-xs font-semibold tracking-wide text-leaf-700 uppercase backdrop-blur">
            <span className="size-1.5 animate-pulse rounded-full bg-lime-500" /> Vadodara cloud kitchen · Made fresh today
          </p>
          <p data-reveal data-chip className="mt-2 mb-5 flex items-center gap-1.5 pl-1 text-sm font-medium text-ink/60 lg:mb-6">
            <Clock className="size-4 text-leaf-600" aria-hidden /> Orders open daily · {hoursLabel(menu.orderingHours ?? DEFAULT_HOURS)}
          </p>
          <h1 data-headline className="font-display text-[clamp(3.4rem,15vw,7.5rem)] leading-[0.9] font-medium tracking-[-0.035em] text-ink">
            Fresh <em className="font-normal text-leaf-600 italic">bowls.</em>
            <br />
            Happy{" "}
            <span className="relative inline-block">
              moods.
              <svg data-reveal className="absolute -bottom-[0.12em] left-0 w-full overflow-visible" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden>
                <path data-underline d="M4 16C60 6 140 4 296 12" stroke="#c9e665" strokeWidth="10" strokeLinecap="round" fill="none" />
              </svg>
            </span>
          </h1>
          <p data-reveal data-sub className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-ink/70 lg:mt-7 lg:text-lg">
            Chef-made salads and healthy bowls in Vadodara — crisp greens, dressings packed on the side, every portion weighed to the gram and delivered cold.
          </p>
          <div data-reveal data-cta className="mt-7 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 lg:mt-9">
            <Link
              href="#menu"
              className="tap group inline-flex items-center justify-between gap-3 rounded-full bg-leaf-700 py-3.5 pr-3.5 pl-7 text-base font-semibold text-cream-50 shadow-xl shadow-leaf-900/20 transition-colors hover:bg-leaf-800 sm:justify-start sm:py-4 sm:pr-4"
            >
              Order a bowl
              <span className="grid size-8 place-items-center rounded-full bg-lime-400 text-leaf-900 transition-transform duration-300 group-hover:translate-x-1 group-hover:-rotate-45">→</span>
            </Link>
            <Link href="/plans" className="tap rounded-full px-6 py-3.5 text-center text-base font-semibold text-leaf-700 ring-1 ring-leaf-700/20 transition-colors hover:bg-leaf-700/5 sm:py-4 sm:ring-0">
              Subscribe &amp; save 22%
            </Link>
          </div>
          <ul className="no-scrollbar -mx-5 mt-7 flex gap-2 overflow-x-auto px-5 text-sm whitespace-nowrap text-ink/70 lg:mx-0 lg:mt-10 lg:flex-wrap lg:overflow-visible lg:px-0">
            {["Dressings on the side", "Weighed to the gram", "Kept below 4°C", "Allergens labelled"].map((t) => (
              <li data-reveal data-chip key={t} className="shrink-0 rounded-full bg-white/70 px-3.5 py-1.5 ring-1 ring-ink/5">
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="relative order-first mx-auto aspect-square w-[min(94vw,27rem)] lg:order-none lg:w-full lg:max-w-[34rem]"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
        >
          <div data-reveal data-blob data-parallax data-depth="0.4" className="absolute -inset-[3%] translate-x-[4%] -translate-y-[2%]">
            <div data-blob-tint className="size-full rounded-[46%_54%_58%_42%/48%_42%_58%_52%] bg-lime-300" />
          </div>
          <div data-reveal data-blob data-parallax data-depth="0.7" className="absolute inset-[16%] translate-x-[8%] rounded-[58%_42%_44%_56%/52%_58%_42%_48%] bg-leaf-700/10" />
          <div data-reveal data-hero-bowl data-parallax data-depth="1" className="absolute inset-[4%] drop-shadow-2xl">
            <div data-spin className="relative size-full">
              {dishes.map((d, i) => (
                <div key={d.id} data-slide className="absolute inset-0" style={{ opacity: i === 0 ? 1 : 0 }} aria-hidden={i !== active}>
                  <DishImage id={d.id} src={d.imageUrl} className="size-full" alt={`${d.name}, top view`} priority={i === 0} />
                </div>
              ))}
            </div>
          </div>
          {dishes.length > 1 && (
            <div data-reveal className="absolute bottom-[3%] left-[4%] z-10 flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-2 shadow-sm backdrop-blur" role="tablist" aria-label="Featured bowls">
              {dishes.map((d, i) => (
                <button
                  key={d.id}
                  role="tab"
                  aria-selected={i === active}
                  aria-label={`Show ${d.name}`}
                  onClick={() => goTo(i)}
                  className={`relative h-1.5 overflow-hidden rounded-full transition-all duration-300 ${i === active ? "w-6 bg-leaf-700/20" : "w-1.5 bg-ink/20 hover:bg-ink/40"}`}
                >
                  {i === active && (
                    <span
                      key={`${active}-${paused}`}
                      className="absolute inset-y-0 left-0 rounded-full bg-leaf-700"
                      style={{ animation: paused ? "none" : `hero-progress ${ROTATE_MS}ms linear forwards`, width: paused ? "100%" : undefined }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
          <div data-reveal data-parallax data-depth="1.3" className="absolute right-0 bottom-[6%] max-w-[62%] rotate-6 rounded-2xl bg-white px-3 py-2 shadow-xl lg:-right-2 lg:bottom-[10%] lg:max-w-[70%] lg:px-4 lg:py-3">
            <div data-hero-label>
              <div className="text-[10px] font-semibold tracking-wide text-ink/50 uppercase lg:text-[11px]">{label === 0 ? "Today’s favourite" : "Also on the menu"}</div>
              {current?.slug ? (
                <Link href={`/menu/${current.slug}`} className="font-display text-base font-medium hover:underline lg:text-lg">{current.name}</Link>
              ) : (
                <div className="font-display text-base font-medium lg:text-lg">{current?.name}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {FLOATERS.map(({ C, cls, depth, rot }, i) => (
        <div key={i} data-reveal data-floater data-parallax data-depth={depth} className={`pointer-events-none absolute z-[1] ${cls}`} style={{ rotate: `${rot}deg` }}>
          <C className="w-full drop-shadow-lg" />
        </div>
      ))}
    </section>
  );
}
