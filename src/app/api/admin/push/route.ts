import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, MANAGERS, requireUser, route } from "@/lib/server/http";
import { broadcast, pushConfigured, pushStats } from "@/lib/server/push";

export const GET = route(async (req: NextRequest) => {
  await requireUser(req, MANAGERS);
  return { configured: pushConfigured(), ...(await pushStats()) };
});

/** Announcement to customers, staff or everyone with notifications on. */
export const POST = route(async (req: NextRequest) => {
  await requireUser(req, ["admin"]);
  if (!pushConfigured()) throw new HttpError(503, "Push isn't configured on the server (VAPID keys)");
  const b = z
    .object({
      audience: z.enum(["customers", "staff", "everyone"]),
      title: z.string().min(2).max(60),
      body: z.string().min(2).max(160),
      url: z.string().max(200).default("/"),
    })
    .parse(await req.json());
  if (!b.url.startsWith("/")) throw new HttpError(400, "Link must be a page on this site, e.g. /menu");
  return broadcast(b.audience, { title: b.title, body: b.body, url: b.url, tag: `promo-${Date.now()}` });
});
