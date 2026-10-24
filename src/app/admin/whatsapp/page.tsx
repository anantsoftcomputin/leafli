"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, cx, ErrorText, Input, PageHeader } from "@/components/ui";

interface Tpl {
  key: string;
  name: string;
  label: string;
  audience: "customer" | "team";
  preview: string;
  button: string | null;
  status: string | null;
  rejected: string | null;
}
interface Status {
  configured: boolean;
  canManageTemplates: boolean;
  webhookConfigured: boolean;
  webhookUrl: string;
  phone: { display_phone_number?: string; verified_name?: string; quality_rating?: string; name_status?: string; error?: string } | null;
  templatesError: string | null;
  staff: string[];
  optOuts: number;
  templates: Tpl[];
  log: { id: string; template: string; to: string; status: string; error?: string; at: number }[];
  inbox: { id: string; from: string; name: string | null; text: string; at: number; outbound?: boolean; by?: string }[];
}

const TONE: Record<string, "green" | "amber" | "red" | "gray"> = { APPROVED: "green", PENDING: "amber", REJECTED: "red", PAUSED: "red", DISABLED: "red" };
const TICKS: Record<string, string> = { accepted: "✓", sent: "✓", delivered: "✓✓", read: "✓✓ read", failed: "failed", sending: "…" };
const when = (ms: number) => new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** WhatsApp-style formatting for previews: *bold* and _italic_. */
function Bubble({ text, button }: { text: string; button: string | null }) {
  const html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\*([^*\n]+)\*/g, "<b>$1</b>")
    .replace(/_([^_\n]+)_/g, '<span style="color:#667781;font-size:12px">$1</span>');
  return (
    <div className="max-w-sm">
      <div className="rounded-xl rounded-tl-none bg-white px-3 py-2 text-[14px] leading-snug whitespace-pre-wrap text-[#111b21] shadow-sm" dangerouslySetInnerHTML={{ __html: html }} />
      {button && <div className="mt-0.5 rounded-xl bg-white py-2 text-center text-[14px] font-medium text-[#00a5f4] shadow-sm">↗ {button}</div>}
    </div>
  );
}

export default function WhatsAppAdmin() {
  const { profile } = useAuth();
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sel, setSel] = useState("order_confirmed");
  const [to, setTo] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const load = () => api<Status>("/api/admin/whatsapp").then(setS).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (profile?.phone && !to) setTo(profile.phone);
  }, [profile, to]);

  async function run(key: string, body: unknown, done: (r: Record<string, unknown>) => string) {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      const r = await api<Record<string, unknown>>("/api/admin/whatsapp", body);
      setMsg(done(r));
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const t = s?.templates.find((x) => x.key === sel);
  const missing = s?.templates.filter((x) => !x.status).length ?? 0;
  const approved = s?.templates.filter((x) => x.status === "APPROVED").length ?? 0;

  return (
    <>
      <PageHeader title="WhatsApp" sub="Order, payment and plan updates through the official WhatsApp Cloud API. Customers opt in at checkout and can reply STOP." />
      <ErrorText>{err}</ErrorText>
      {msg && <p className="mb-3 text-sm text-leaf-700">{msg}</p>}

      {s && !s.configured && (
        <Card title="Finish connecting WhatsApp" className="mb-5">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-stone-700">
            <li>Verify your business in Meta Business Suite (business.facebook.com → Settings → Business info).</li>
            <li>developers.facebook.com → Create app → <b>Business</b> → add the <b>WhatsApp</b> product, then add and verify your business phone number.</li>
            <li>Business settings → System users → add an admin system user → <b>Generate token</b> with <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code> (never expires).</li>
            <li>Set <code>WHATSAPP_PHONE_NUMBER_ID</code>, <code>WHATSAPP_BUSINESS_ACCOUNT_ID</code>, <code>WHATSAPP_ACCESS_TOKEN</code>, <code>WHATSAPP_APP_SECRET</code>, <code>WHATSAPP_VERIFY_TOKEN</code> and <code>STAFF_WHATSAPP_NUMBERS</code> on Netlify and redeploy.</li>
            <li>Come back here → <b>Submit templates to Meta</b>, and add the webhook below in the app&apos;s WhatsApp → Configuration.</li>
          </ol>
        </Card>
      )}

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card title="Business number">
          {!s ? (
            <p className="text-sm text-stone-500">Checking…</p>
          ) : s.phone && !s.phone.error ? (
            <div className="space-y-1 text-sm">
              <div className="text-lg font-semibold">{s.phone.display_phone_number}</div>
              <div className="text-stone-600">{s.phone.verified_name}</div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {s.phone.name_status && <Badge tone={s.phone.name_status === "APPROVED" ? "green" : "amber"}>name {s.phone.name_status.toLowerCase().replace(/_/g, " ")}</Badge>}
                {s.phone.quality_rating && <Badge tone={s.phone.quality_rating === "GREEN" ? "green" : s.phone.quality_rating === "YELLOW" ? "amber" : "red"}>quality {s.phone.quality_rating.toLowerCase()}</Badge>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-red-600">{s.phone?.error ?? "Not connected yet"}</p>
          )}
        </Card>
        <Card title="Webhook">
          <div className="space-y-1 text-sm">
            <Badge tone={s?.webhookConfigured ? "green" : "amber"}>{s?.webhookConfigured ? "configured" : "not configured"}</Badge>
            <code className="block break-all rounded bg-stone-100 p-1 text-[11px]">{s?.webhookUrl}</code>
            <p className="text-xs text-stone-500">Verify token = WHATSAPP_VERIFY_TOKEN · subscribe to the <b>messages</b> field</p>
          </div>
        </Card>
        <Card title="Audience">
          <div className="space-y-1 text-sm">
            <div>Team alerts to: {s?.staff.length ? s.staff.map((n) => `+${n}`).join(", ") : <span className="text-stone-500">none (STAFF_WHATSAPP_NUMBERS)</span>}</div>
            <div className="text-stone-600">{s?.optOuts ?? 0} number(s) replied STOP</div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card
          title={`Message templates · ${approved}/${s?.templates.length ?? 0} approved`}
          actions={
            s?.canManageTemplates && missing > 0 ? (
              <Button size="sm" loading={busy === "submit"} onClick={() => run("submit", { action: "submit" }, (r) => `Submitted ${(r.submitted as unknown[]).length} template(s). Meta usually reviews within minutes.`)}>
                Submit {missing} to Meta
              </Button>
            ) : undefined
          }
        >
          {s?.templatesError && <p className="mb-2 text-xs text-red-600">{s.templatesError}</p>}
          <ul className="divide-y divide-stone-100 text-sm">
            {s?.templates.map((x) => (
              <li key={x.key}>
                <button onClick={() => setSel(x.key)} className={cx("flex w-full items-center gap-3 px-2 py-2 text-left", sel === x.key && "bg-leaf-50")}>
                  <span className="flex-1">
                    <span className="font-medium">{x.label}</span> <span className="text-xs text-stone-400">{x.name}</span>
                    {x.rejected && <span className="block text-xs text-red-600">Rejected: {x.rejected}</span>}
                  </span>
                  {x.audience === "team" && <Badge tone="violet">team</Badge>}
                  <Badge tone={x.status ? (TONE[x.status] ?? "gray") : "gray"}>{x.status?.toLowerCase() ?? "not submitted"}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t ? t.label : "Preview"}>
          <div className="rounded-xl bg-[#efeae2] p-4">{t && <Bubble text={t.preview} button={t.button} />}</div>
          <p className="mt-2 text-xs text-stone-500">Shown with sample values. Real messages use the order&apos;s details.</p>
          <div className="mt-3 flex gap-2">
            <Input placeholder="+91 98765 43210" value={to} onChange={(e) => setTo(e.target.value)} className="w-full" />
            <Button
              loading={busy === "test"}
              disabled={!s?.configured || t?.status !== "APPROVED"}
              onClick={() => run("test", { action: "test", template: sel, to }, () => `Test sent to ${to}`)}
            >
              Send test
            </Button>
          </div>
          {t && t.status !== "APPROVED" && <p className="mt-1 text-xs text-stone-500">Tests work once Meta approves this template.</p>}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Recently sent">
          {!s?.log.length ? (
            <p className="text-sm text-stone-500">Nothing sent yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {s.log.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-x-3 py-2">
                  <span className="flex-1 truncate">{l.template.replace(/^leafli_/, "").replace(/_/g, " ")}</span>
                  <span className="text-xs text-stone-500">+{l.to}</span>
                  <span className={cx("text-xs", l.status === "failed" ? "text-red-600" : l.status === "read" ? "text-sky-600" : "text-stone-500")}>{TICKS[l.status] ?? l.status}</span>
                  <span className="text-xs text-stone-400">{when(l.at)}</span>
                  {l.error && <span className="w-full text-xs text-red-600">{l.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Customer replies">
          {!s?.inbox.length ? (
            <p className="text-sm text-stone-500">No replies yet. Messages customers send to your WhatsApp number appear here.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {s.inbox.map((m) => (
                <li key={m.id} className={cx("py-2", m.outbound && "pl-6")}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.outbound ? `↩ You${m.by ? ` (${m.by})` : ""} → +${m.from}` : (m.name ?? `+${m.from}`)}</span>
                    {!m.outbound && <span className="text-xs text-stone-500">+{m.from}</span>}
                    <span className="ml-auto text-xs text-stone-400">{when(m.at)}</span>
                  </div>
                  <p className="text-stone-700">{m.text}</p>
                  {!m.outbound && Date.now() - m.at < 24 * 3600_000 && (
                    <button className="text-xs font-semibold text-leaf-700" onClick={() => setReplyTo(m.from)}>Reply</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {replyTo && (
            <div className="mt-3 space-y-2 rounded-lg bg-stone-50 p-3">
              <p className="text-xs text-stone-600">Reply to +{replyTo} from the business number</p>
              <textarea className="w-full rounded-lg border-0 p-2 text-sm ring-1 ring-stone-200" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" loading={busy === "reply"} disabled={!reply.trim()} onClick={() => run("reply", { action: "reply", to: replyTo, text: reply }, () => { setReply(""); setReplyTo(null); return "Reply sent"; })}>Send</Button>
                <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>Cancel</Button>
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-stone-500">WhatsApp allows free-form replies for 24 hours after the customer&apos;s last message.</p>
        </Card>
      </div>
    </>
  );
}
