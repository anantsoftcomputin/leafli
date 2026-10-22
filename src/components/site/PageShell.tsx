import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbs, graph } from "@/lib/jsonld";

export interface Crumb {
  name: string;
  path: string;
}

/** Visible breadcrumb trail + BreadcrumbList structured data. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all = [{ name: "Home", path: "/" }, ...items];
  return (
    <>
      <JsonLd data={graph(breadcrumbs(all))} />
      <nav aria-label="Breadcrumb" className="text-sm text-ink/50">
        <ol className="flex flex-wrap items-center gap-1.5">
          {all.map((c, i) => (
            <li key={c.path} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>/</span>}
              {i === all.length - 1 ? (
                <span aria-current="page" className="text-ink/70">{c.name}</span>
              ) : (
                <Link href={c.path} className="hover:text-leaf-700">{c.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

export function PageHero({
  eyebrow,
  title,
  intro,
  crumbs,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  crumbs: Crumb[];
  children?: React.ReactNode;
}) {
  return (
    <header className="grain relative overflow-hidden bg-cream-100 pt-32 pb-14 md:pt-40 md:pb-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Breadcrumbs items={crumbs} />
        {eyebrow && <p className="mt-8 text-sm font-semibold tracking-[0.2em] text-leaf-600 uppercase">{eyebrow}</p>}
        <h1 className="mt-3 max-w-4xl font-display text-[clamp(2.6rem,6.5vw,5.5rem)] leading-[0.95] font-medium tracking-[-0.035em] text-ink">{title}</h1>
        {intro && <div className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/65">{intro}</div>}
        {children}
      </div>
    </header>
  );
}
