import "server-only";
import crypto from "node:crypto";

/**
 * WhatsApp Cloud API (Meta, official). Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *   send      POST /{phone-number-id}/messages           (template messages for business-initiated updates)
 *   templates GET/POST /{waba-id}/message_templates      (submit + check approval)
 *   webhook   GET  verify (hub.challenge), POST events signed with X-Hub-Signature-256 = HMAC_SHA256(body, app secret)
 */
const VERSION = process.env.WHATSAPP_API_VERSION || "v23.0";
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "";
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || "";
export const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "";
export const WHATSAPP_LANG = process.env.WHATSAPP_TEMPLATE_LANG || "en";

export const whatsappConfigured = () => Boolean(PHONE_ID && TOKEN);
export const whatsappCanManageTemplates = () => Boolean(WABA_ID && TOKEN);

export class WhatsAppError extends Error {
  constructor(
    message: string,
    public code?: number,
  ) {
    super(message);
  }
}

async function graph<T>(path: string, body?: unknown): Promise<T> {
  if (!TOKEN) throw new WhatsAppError("WhatsApp is not configured (WHATSAPP_ACCESS_TOKEN)");
  const res = await fetch(`https://graph.facebook.com/${VERSION}${path}`, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Bearer ${TOKEN}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number; error_user_msg?: string } };
  if (!res.ok || data.error) throw new WhatsAppError(`WhatsApp: ${data.error?.error_user_msg || data.error?.message || res.status}`, data.error?.code);
  return data;
}

/** "+91 98765-43210" / "09876543210" / "9876543210" → "919876543210" (E.164 without +). Null if not a mobile. */
export function waNumber(phone?: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  return /^\d{11,15}$/.test(d) ? d : null;
}

export interface TemplateSend {
  name: string;
  body: string[];
  /** Dynamic suffix for the template's single URL button, if it has one. */
  buttonSuffix?: string;
}

export function sendTemplate(to: string, t: TemplateSend) {
  const components: unknown[] = [];
  if (t.body.length) components.push({ type: "body", parameters: t.body.map((text) => ({ type: "text", text: clean(text) })) });
  if (t.buttonSuffix != null) components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: t.buttonSuffix }] });
  return graph<{ messages: { id: string }[] }>(`/${PHONE_ID}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: { name: t.name, language: { code: WHATSAPP_LANG }, components },
  });
}

/** Free-form text: only allowed within 24 h of the customer's last message to us. */
export function sendText(to: string, body: string) {
  return graph<{ messages: { id: string }[] }>(`/${PHONE_ID}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: body.slice(0, 4096), preview_url: true },
  });
}

/** Template parameters can't contain newlines, tabs or 4+ spaces, and can't be empty. */
const clean = (s: string) => (s.replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim() || "-").slice(0, 1000);

export function verifySignature(rawBody: string, header: string) {
  if (!APP_SECRET || !header.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header.slice(7));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const webhookConfigured = () => Boolean(APP_SECRET && WHATSAPP_VERIFY_TOKEN);

export function phoneInfo() {
  return graph<{ display_phone_number: string; verified_name: string; quality_rating?: string; name_status?: string; code_verification_status?: string }>(
    `/${PHONE_ID}?fields=display_phone_number,verified_name,quality_rating,name_status,code_verification_status`,
  );
}

export interface RemoteTemplate {
  id: string;
  name: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED" | string;
  category: string;
  language: string;
  rejected_reason?: string;
}

export async function listTemplates(): Promise<RemoteTemplate[]> {
  if (!WABA_ID) throw new WhatsAppError("WHATSAPP_BUSINESS_ACCOUNT_ID is not set");
  const r = await graph<{ data: RemoteTemplate[] }>(`/${WABA_ID}/message_templates?fields=id,name,status,category,language,rejected_reason&limit=200`);
  return r.data;
}

export function createTemplate(def: unknown) {
  if (!WABA_ID) throw new WhatsAppError("WHATSAPP_BUSINESS_ACCOUNT_ID is not set");
  return graph<{ id: string; status: string; category: string }>(`/${WABA_ID}/message_templates`, def);
}
