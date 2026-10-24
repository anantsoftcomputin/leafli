import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Outgoing email over SMTP (GoDaddy Workspace: smtpout.secureserver.net:465, SSL).
 * leafli.in publishes SPF "-all" + DMARC p=reject, so mail must leave through
 * GoDaddy's servers as support@leafli.in — any other relay would be rejected.
 *
 * sendEmail never throws: an email problem must never fail an order or payment.
 * Every attempt is logged in `emailLog`; a `key` makes a send idempotent
 * (the verify route and the webhook can both report the same payment).
 */
const HOST = process.env.SMTP_HOST || "smtpout.secureserver.net";
const PORT = Number(process.env.SMTP_PORT || 465);
const USER = process.env.SMTP_USER || "";
const PASS = process.env.SMTP_PASS || "";
export const EMAIL_FROM = process.env.EMAIL_FROM || (USER ? `Leafli <${USER}>` : "");
export const REPLY_TO = process.env.EMAIL_REPLY_TO || USER;

export const emailConfigured = () => Boolean(USER && PASS);
export const staffAlertEmails = () =>
  (process.env.STAFF_ALERT_EMAILS || USER).split(",").map((s) => s.trim()).filter(Boolean);

let transport: Transporter | null = null;
function smtp() {
  transport ??= nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transport;
}

export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "SMTP_USER / SMTP_PASS not set" };
  try {
    await smtp().verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** Template name, for the log. */
  kind: string;
  /** Same key → sent at most once. */
  key?: string;
  /** Order / subscription / user the email is about, for the log. */
  ref?: string;
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export async function sendEmail(m: EmailMessage): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  const to = (Array.isArray(m.to) ? m.to : [m.to]).map((s) => s?.trim()).filter((s): s is string => !!s && isEmail(s));
  if (!to.length) return { sent: false, skipped: "no recipient" };
  if (!emailConfigured()) return { sent: false, skipped: "email not configured" };

  const log = adminDb.collection("emailLog");
  const ref = m.key ? log.doc(m.key.replace(/[^\w-]/g, "_").slice(0, 400)) : log.doc();
  const entry = { kind: m.kind, to, subject: m.subject, ref: m.ref ?? null, status: "sending", at: Date.now() };
  try {
    if (m.key) await ref.create(entry);
    else await ref.set(entry);
  } catch {
    return { sent: false, skipped: "already sent" };
  }

  try {
    const info = await smtp().sendMail({
      from: EMAIL_FROM,
      replyTo: REPLY_TO || undefined,
      to,
      subject: m.subject,
      html: m.html,
      text: m.text,
      headers: { "X-Entity-Ref-ID": ref.id },
    });
    await ref.update({ status: "sent", messageId: info.messageId ?? null }).catch(() => {});
    return { sent: true };
  } catch (e) {
    const error = (e as Error).message;
    // Free the key so a later retry (e.g. the webhook after the verify route) can try again.
    if (m.key) await ref.delete().catch(() => {});
    await log.add({ ...entry, status: "failed", error, key: m.key ?? null }).catch(() => {});
    console.error("email failed", m.kind, error);
    return { sent: false, error };
  }
}
