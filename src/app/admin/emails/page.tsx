"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, cx, ErrorText, Input, PageHeader } from "@/components/ui";

interface Status {
  configured: boolean;
  smtp: { ok: boolean; error?: string };
  from: string;
  staff: string[];
  templates: { id: string; label: string; group: "Customer" | "Team" }[];
  log: { id: string; kind: string; to: string[]; subject: string; status: string; error: string | null; at: number; ref: string | null }[];
}

export default function EmailsAdmin() {
  const { profile } = useAuth();
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tpl, setTpl] = useState("order_received_paid");
  const [preview, setPreview] = useState<{ subject: string; preheader: string; html: string } | null>(null);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [width, setWidth] = useState<"desktop" | "phone">("desktop");

  const load = () => api<Status>("/api/admin/email").then(setS).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (profile?.email && !to) setTo(profile.email);
  }, [profile, to]);
  useEffect(() => {
    setPreview(null);
    api<{ subject: string; preheader: string; html: string }>("/api/admin/email", { action: "preview", template: tpl })
      .then(setPreview)
      .catch((e) => setErr(e.message));
  }, [tpl]);

  async function send() {
    setBusy("send");
    setErr(null);
    setMsg(null);
    try {
      await api("/api/admin/email", { action: "send", template: tpl, to });
      setMsg(`Sent to ${to}. Check the inbox (and spam, the first time).`);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const groups = ["Customer", "Team"] as const;
  return (
    <>
      <PageHeader title="Emails" sub="Every email customers and the team receive. Preview them, send yourself a test, and see what went out." />

      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm">
        {s ? (
          <>
            <Badge tone={s.smtp.ok ? "green" : "red"} dot>{s.smtp.ok ? "SMTP connected" : "SMTP not working"}</Badge>
            <span className="text-stone-600">From <b>{s.from || "—"}</b></span>
            <span className="text-stone-500">· Team alerts to {s.staff.join(", ") || "—"}</span>
            {!s.smtp.ok && s.smtp.error && <span className="text-xs text-red-600">{s.smtp.error}</span>}
          </>
        ) : (
          <span className="text-stone-500">Checking email connection…</span>
        )}
      </div>
      <ErrorText>{err}</ErrorText>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <Card title="Templates">
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-1 text-[11px] font-semibold tracking-wider text-stone-500 uppercase">{g === "Team" ? "Team alerts" : "To customers"}</p>
                <ul className="space-y-0.5">
                  {s?.templates.filter((t) => t.group === g).map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => setTpl(t.id)}
                        className={cx("w-full rounded-lg px-2.5 py-1.5 text-left text-sm", tpl === t.id ? "bg-leaf-50 font-semibold text-leaf-800" : "text-stone-700 hover:bg-stone-50")}
                      >
                        {t.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          <Card
            title={preview ? preview.subject : "Loading preview…"}
            actions={
              <div className="flex gap-1">
                <Button size="sm" variant={width === "desktop" ? "secondary" : "ghost"} onClick={() => setWidth("desktop")}>Desktop</Button>
                <Button size="sm" variant={width === "phone" ? "secondary" : "ghost"} onClick={() => setWidth("phone")}>Phone</Button>
              </div>
            }
          >
            {preview && <p className="-mt-1 mb-3 text-xs text-stone-500">Preview text: {preview.preheader}</p>}
            <div className="flex justify-center rounded-xl bg-stone-100 p-3">
              {preview ? (
                <iframe title="Email preview" srcDoc={preview.html} sandbox="" className="h-[720px] rounded-lg bg-white shadow-sm" style={{ width: width === "phone" ? 380 : "100%", maxWidth: 680 }} />
              ) : (
                <div className="h-[720px]" />
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Input type="email" placeholder="you@example.com" value={to} onChange={(e) => setTo(e.target.value)} className="w-72" />
              <Button onClick={send} loading={busy === "send"} disabled={!to || !s?.smtp.ok}>Send test</Button>
              {msg && <span className="text-sm text-leaf-700">{msg}</span>}
            </div>
            <p className="mt-2 text-xs text-stone-500">Previews use sample data. Real emails use the order, plan and business details from Settings.</p>
          </Card>

          <Card title="Recently sent">
            {!s?.log.length ? (
              <p className="text-sm text-stone-500">No emails yet.</p>
            ) : (
              <ul className="divide-y divide-stone-100 text-sm">
                {s.log.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <Badge tone={l.status === "sent" ? "green" : l.status === "failed" ? "red" : "amber"}>{l.status}</Badge>
                    <span className="min-w-0 flex-1 truncate">{l.subject}</span>
                    <span className="text-xs text-stone-500">{l.to?.join(", ")}</span>
                    <span className="text-xs text-stone-400">{new Date(l.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                    {l.error && <span className="w-full text-xs text-red-600">{l.error}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
