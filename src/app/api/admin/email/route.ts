import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { MANAGERS, requireUser, route } from "@/lib/server/http";
import { brand } from "@/lib/server/email/notify";
import { SAMPLES } from "@/lib/server/email/samples";
import { EMAIL_FROM, emailConfigured, sendEmail, staffAlertEmails, verifySmtp } from "@/lib/server/email/send";

/** Email status, recent sends and the template list (Admin → Emails). */
export const GET = route(async (req: NextRequest) => {
  await requireUser(req, MANAGERS);
  const [smtp, log] = await Promise.all([
    verifySmtp(),
    adminDb.collection("emailLog").orderBy("at", "desc").limit(40).get(),
  ]);
  return {
    configured: emailConfigured(),
    smtp,
    from: EMAIL_FROM,
    staff: staffAlertEmails(),
    templates: Object.entries(SAMPLES).map(([id, t]) => ({ id, label: t.label, group: t.group })),
    log: log.docs.map((d) => {
      const x = d.data();
      return { id: d.id, kind: x.kind, to: x.to, subject: x.subject, status: x.status, error: x.error ?? null, at: x.at, ref: x.ref ?? null };
    }),
  };
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview"), template: z.string() }),
  z.object({ action: z.literal("send"), template: z.string(), to: z.email() }),
]);

/** Render a template with sample data, or send it to an address as a test. */
export const POST = route(async (req: NextRequest) => {
  await requireUser(req, MANAGERS);
  const b = schema.parse(await req.json());
  const t = SAMPLES[b.template] ?? SAMPLES.test!;
  const menu = await adminDb.collection("menuItems").get();
  const imgs = Object.fromEntries(menu.docs.map((d) => [d.id, (d.get("imageUrl") as string | null) ?? null]));
  const email = t.build(await brand(), imgs);
  if (b.action === "preview") return { subject: email.subject, preheader: email.preheader, html: email.html };
  const r = await sendEmail({ to: b.to, subject: `[Test] ${email.subject}`, html: email.html, text: email.text, kind: `test_${b.template}` });
  if (!r.sent) return Response.json({ error: r.error || r.skipped || "Not sent" }, { status: 502 });
  return { ok: true };
});
