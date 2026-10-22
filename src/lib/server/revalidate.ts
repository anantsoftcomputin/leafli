import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { TAGS } from "./content";

/** Refresh public pages after an admin edit (ISR). */
export function refreshPublic(kind: keyof typeof TAGS, paths: string[] = []) {
  revalidateTag(TAGS[kind]);
  for (const p of ["/", "/sitemap.xml", ...paths]) revalidatePath(p);
}
