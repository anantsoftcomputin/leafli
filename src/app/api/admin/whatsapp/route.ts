import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import {
  createTemplate,
  listTemplates,
  phoneInfo,
  sendText,
  waNumber,
  webhookConfigured,
  whatsappCanManageTemplates,
  whatsappConfigured,
  type RemoteTemplate,
} from "@/lib/integrations/whatsapp";
import { HttpError, MANAGERS, requireUser, route } from "@/lib/server/http";
import { sendWhatsApp, staffWhatsApp } from "@/lib/server/whatsapp/notify";
import { previewText, toMetaDefinition, WA_TEMPLATES, type WaTemplateKey } from "@/lib/server/whatsapp/templates";

const err = (e: unknown) => (e as Error).message;

/** Status, template approval, recent messages and replies (Admin → WhatsApp). */
export const GET = route(async (req: NextRequest) => {
  await requireUser(req, MANAGERS);
  const [phone, remote, log, inbox, optOuts] = await Promise.all([
    whatsappConfigured() ? phoneInfo().catch((e) => ({ error: err(e) })) : null,
    whatsappCanManageTemplates() ? listTemplates().catch((e) => ({ error: err(e) })) : null,
    adminDb.collection("whatsappLog").orderBy("at", "desc").limit(40).get(),
    adminDb.collection("whatsappInbox").orderBy("at", "desc").limit(30).get(),
    adminDb.collection("whatsappOptOut").count().get(),
  ]);
  const byName = new Map(Array.isArray(remote) ? remote.map((t: RemoteTemplate) => [t.name, t]) : []);
  return {
    configured: whatsappConfigured(),
    canManageTemplates: whatsappCanManageTemplates(),
    webhookConfigured: webhookConfigured(),
    webhookUrl: `${req.nextUrl.origin}/api/integrations/whatsapp/webhook`,
    phone,
    templatesError: remote && !Array.isArray(remote) ? remote.error : null,
    staff: staffWhatsApp(),
    optOuts: optOuts.data().count,
    templates: (Object.entries(WA_TEMPLATES) as [WaTemplateKey, (typeof WA_TEMPLATES)[WaTemplateKey]][]).map(([key, t]) => {
      const r = byName.get(t.name);
      return { key, name: t.name, label: t.label, audience: t.audience, preview: previewText(t), button: "button" in t ? t.button.text : null, status: r?.status ?? null, category: r?.category ?? null, rejected: r?.rejected_reason && r.rejected_reason !== "NONE" ? r.rejected_reason : null };
    }),
    log: log.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })),
    inbox: inbox.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })),
  };
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit") }),
  z.object({ action: z.literal("test"), template: z.string(), to: z.string().min(10) }),
  z.object({ action: z.literal("reply"), to: z.string().regex(/^\d{11,15}$/), text: z.string().trim().min(1).max(4096) }),
]);

export const POST = route(async (req: NextRequest) => {
  const actor = await requireUser(req, MANAGERS);
  const b = schema.parse(await req.json());

  if (b.action === "reply") {
    const thread = await adminDb.collection("whatsappInbox").where("from", "==", b.to).get();
    const at = Math.max(0, ...thread.docs.filter((d) => !d.get("outbound")).map((d) => d.get("at") as number));
    if (Date.now() - at > 24 * 3600_000) throw new HttpError(409, "More than 24 hours since this customer last wrote — WhatsApp only allows template messages now");
    try {
      const r = await sendText(b.to, b.text);
      await adminDb.collection("whatsappInbox").add({ from: b.to, to: b.to, outbound: true, text: b.text, by: actor.name, at: Date.now(), wamid: r.messages?.[0]?.id ?? null });
    } catch (e) {
      throw new HttpError(502, err(e));
    }
    return { ok: true };
  }

  if (b.action === "submit") {
    // Submit every template Meta doesn't have yet. Approved / pending ones are left alone.
    const existing = new Set((await listTemplates()).map((t) => t.name));
    const results: { name: string; status: string }[] = [];
    for (const t of Object.values(WA_TEMPLATES)) {
      if (existing.has(t.name)) continue;
      try {
        const r = await createTemplate(toMetaDefinition(t));
        results.push({ name: t.name, status: r.status });
      } catch (e) {
        results.push({ name: t.name, status: `error: ${err(e)}` });
      }
    }
    return { submitted: results };
  }

  const t = WA_TEMPLATES[b.template as WaTemplateKey];
  if (!t) throw new HttpError(400, "Unknown template");
  const to = waNumber(b.to);
  if (!to) throw new HttpError(400, "Enter a mobile number with country code, e.g. +91 98765 43210");
  const suffix = "button" in t ? t.button.example.slice(t.button.base.length) : undefined;
  const r = await sendWhatsApp(to, b.template as WaTemplateKey, { body: t.example, buttonSuffix: suffix }, { ref: "test" });
  if (!r.sent) throw new HttpError(502, r.error || r.skipped || "Not sent");
  return { ok: true };
});
