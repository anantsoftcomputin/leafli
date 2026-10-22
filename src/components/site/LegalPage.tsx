import { renderMarkdown } from "@/lib/markdown";
import { getPublicSettings } from "@/lib/server/content";
import { PageHero } from "./PageShell";

/** Policy page: markdown with {{legalName}}, {{email}}, {{phone}}, {{address}} filled from Settings. */
export async function LegalPage({ title, path, updated, body }: { title: string; path: string; updated: string; body: string }) {
  const s = await getPublicSettings().catch(() => null);
  const a = s?.address;
  const filled = body
    .replaceAll("{{legalName}}", s?.legalName || "Leafli")
    .replaceAll("{{email}}", s?.email || "our support email")
    .replaceAll("{{phone}}", s?.phone || "our support number")
    .replaceAll("{{address}}", a?.line1 ? [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ") : "our registered address");
  const { html } = renderMarkdown(filled);
  return (
    <main>
      <PageHero crumbs={[{ name: title, path }]} title={title} intro={<span className="text-base">Last updated {updated}</span>} />
      <div className="prose-leafli mx-auto max-w-3xl px-5 pb-24 sm:px-8" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
