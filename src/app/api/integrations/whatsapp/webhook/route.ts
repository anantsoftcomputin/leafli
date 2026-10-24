import type { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifySignature, WHATSAPP_VERIFY_TOKEN } from "@/lib/integrations/whatsapp";
import { HttpError, route } from "@/lib/server/http";
import { notifyStaff } from "@/lib/server/push";

/**
 * WhatsApp Cloud API webhook (Meta App → WhatsApp → Configuration):
 *   Callback URL  https://<your-domain>/api/integrations/whatsapp/webhook
 *   Verify token  WHATSAPP_VERIFY_TOKEN
 *   Fields        messages
 * Receives delivery receipts (sent / delivered / read / failed) and customer replies.
 * Replies of STOP opt the number out; START opts it back in.
 */
export const GET = (req: NextRequest) => {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && WHATSAPP_VERIFY_TOKEN && p.get("hub.verify_token") === WHATSAPP_VERIFY_TOKEN)
    return new Response(p.get("hub.challenge") ?? "", { headers: { "content-type": "text/plain" } });
  return new Response("Forbidden", { status: 403 });
};

interface Change {
  value?: {
    contacts?: { wa_id: string; profile?: { name?: string } }[];
    messages?: { from: string; id: string; timestamp: string; type: string; text?: { body: string }; button?: { text: string }; interactive?: unknown }[];
    statuses?: { id: string; status: string; timestamp: string; recipient_id: string; errors?: { code: number; title: string; message?: string; error_data?: { details?: string } }[] }[];
  };
}

const STOP = /^\s*(stop|unsubscribe|stop all|cancel updates)\s*$/i;
const START = /^\s*(start|subscribe|unstop)\s*$/i;

export const POST = route(async (req: NextRequest) => {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256") ?? "")) throw new HttpError(401, "Bad signature");
  const body = JSON.parse(raw) as { entry?: { changes?: Change[] }[] };

  for (const change of body.entry?.flatMap((e) => e.changes ?? []) ?? []) {
    const v = change.value;
    for (const s of v?.statuses ?? []) {
      const q = await adminDb.collection("whatsappLog").where("wamid", "==", s.id).limit(1).get();
      const err = s.errors?.[0];
      if (!q.empty)
        await q.docs[0]!.ref.update({
          status: s.status,
          [`${s.status}At`]: Number(s.timestamp) * 1000,
          ...(err ? { error: `${err.code}: ${err.error_data?.details || err.message || err.title}` } : {}),
        });
    }
    for (const m of v?.messages ?? []) {
      const name = v?.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? null;
      const text = m.text?.body ?? m.button?.text ?? `[${m.type}]`;
      await adminDb.collection("whatsappInbox").doc(m.id).set({ from: m.from, name, text, type: m.type, at: Number(m.timestamp) * 1000, read: false });
      if (STOP.test(text)) await adminDb.collection("whatsappOptOut").doc(m.from).set({ at: Date.now(), via: "reply" });
      else if (START.test(text)) await adminDb.collection("whatsappOptOut").doc(m.from).delete();
      else
        await notifyStaff(
          { title: `WhatsApp from ${name ?? `+${m.from}`}`, body: text.slice(0, 120), url: "/admin/whatsapp", tag: `wa-${m.from}` },
          ["admin", "manager"],
        ).catch(() => {});
    }
  }
  return { ok: true };
});
