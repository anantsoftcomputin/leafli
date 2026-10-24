import "server-only";
import { SITE_URL } from "@/lib/site";

/**
 * Email building blocks. Plain table-based HTML with inline styles — the only thing
 * that renders the same in Gmail, Outlook, Apple Mail and phone clients.
 * Brand: forest #255F30 on chartreuse #BFCD30, cream paper, Plus Jakarta Sans.
 */
export const C = {
  leaf: "#255f30",
  leafDark: "#1b4824",
  leafSoft: "#eff5ef",
  lime: "#bfcd30",
  limeSoft: "#f4f7d6",
  cream: "#f9f6ea",
  paper: "#fffdf6",
  ink: "#10231a",
  muted: "#5d6b63",
  line: "#e8e3cf",
  tomato: "#ef5b3c",
  tomatoSoft: "#fdece8",
  mango: "#ffb43a",
  mangoSoft: "#fff4e0",
};

const FONT = "'Plus Jakarta Sans', 'Segoe UI', Helvetica, Arial, sans-serif";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

export const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path}`);

export interface Brand {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
}

// ── blocks ──────────────────────────────────────────────

export function hero(a: { eyebrow?: string; title: string; text?: string; emoji?: string }) {
  return `
<tr><td style="padding:40px 40px 8px 40px;" class="px">
  ${a.emoji ? `<div style="font-size:40px;line-height:1;margin:0 0 16px 0;">${a.emoji}</div>` : ""}
  ${a.eyebrow ? `<p style="margin:0 0 10px 0;font:700 12px/1.4 ${FONT};letter-spacing:2px;text-transform:uppercase;color:${C.leaf};">${esc(a.eyebrow)}</p>` : ""}
  <h1 style="margin:0;font:800 30px/1.2 ${FONT};letter-spacing:-0.5px;color:${C.ink};" class="h1">${esc(a.title)}</h1>
  ${a.text ? `<p style="margin:14px 0 0 0;font:400 16px/1.6 ${FONT};color:${C.muted};">${a.text}</p>` : ""}
</td></tr>`;
}

export function para(html: string) {
  return `<tr><td style="padding:16px 40px 0 40px;font:400 15px/1.65 ${FONT};color:${C.ink};" class="px">${html}</td></tr>`;
}

export function button(label: string, url: string, tone: "leaf" | "lime" = "leaf") {
  const bg = tone === "leaf" ? C.leaf : C.lime;
  const fg = tone === "leaf" ? "#ffffff" : C.leafDark;
  return `
<tr><td style="padding:28px 40px 4px 40px;" class="px">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
    <td style="border-radius:999px;background:${bg};" bgcolor="${bg}">
      <a href="${esc(abs(url))}" target="_blank" style="display:inline-block;padding:15px 30px;font:700 15px/1 ${FONT};color:${fg};text-decoration:none;border-radius:999px;">${esc(label)} &rarr;</a>
    </td>
  </tr></table>
</td></tr>`;
}

/** Tinted call-out box. */
export function note(html: string, tone: "leaf" | "lime" | "mango" | "tomato" = "leaf") {
  const bg = { leaf: C.leafSoft, lime: C.limeSoft, mango: C.mangoSoft, tomato: C.tomatoSoft }[tone];
  const bar = { leaf: C.leaf, lime: C.lime, mango: C.mango, tomato: C.tomato }[tone];
  return `
<tr><td style="padding:24px 40px 0 40px;" class="px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
    <td style="background:${bg};border-left:4px solid ${bar};border-radius:12px;padding:16px 20px;font:400 14px/1.6 ${FONT};color:${C.ink};">${html}</td>
  </tr></table>
</td></tr>`;
}

/** Label / value rows inside a soft card. */
export function details(rows: [string, string][], title?: string) {
  const body = rows
    .map(
      ([k, v], i) => `
    <tr>
      <td style="padding:10px 0;${i ? `border-top:1px solid ${C.line};` : ""}font:400 14px/1.4 ${FONT};color:${C.muted};" valign="top">${esc(k)}</td>
      <td style="padding:10px 0;${i ? `border-top:1px solid ${C.line};` : ""}font:600 14px/1.4 ${FONT};color:${C.ink};text-align:right;" valign="top">${v}</td>
    </tr>`,
    )
    .join("");
  return card(`${title ? sectionTitle(title) : ""}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${body}</table>`);
}

export function card(inner: string) {
  return `
<tr><td style="padding:24px 40px 0 40px;" class="px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
    <td style="background:${C.cream};border-radius:18px;padding:20px 24px;" bgcolor="${C.cream}">${inner}</td>
  </tr></table>
</td></tr>`;
}

const sectionTitle = (t: string) =>
  `<p style="margin:0 0 8px 0;font:700 11px/1.4 ${FONT};letter-spacing:1.6px;text-transform:uppercase;color:${C.leaf};">${esc(t)}</p>`;

export interface BillLine {
  name: string;
  qty: number;
  amount: number;
  imageUrl?: string | null;
  note?: string;
}

/** Itemised receipt: dishes with thumbnails, then charges and a bold total. */
export function bill(lines: BillLine[], charges: [string, number][], total: number, footnote?: string, title = "Your order") {
  const items = lines
    .map(
      (l, i) => `
    <tr>
      <td width="56" style="padding:12px 12px 12px 0;${i ? `border-top:1px solid ${C.line};` : ""}" valign="middle">
        ${
          l.imageUrl
            ? `<img src="${esc(l.imageUrl)}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border-radius:999px;background:${C.limeSoft};object-fit:cover;">`
            : `<div style="width:48px;height:48px;border-radius:999px;background:${C.limeSoft};text-align:center;font:24px/48px ${FONT};">🥗</div>`
        }
      </td>
      <td style="padding:12px 0;${i ? `border-top:1px solid ${C.line};` : ""}font:600 15px/1.4 ${FONT};color:${C.ink};" valign="middle">
        ${esc(l.name)}<br><span style="font:400 13px/1.4 ${FONT};color:${C.muted};">Qty ${l.qty}${l.note ? ` · ${esc(l.note)}` : ""}</span>
      </td>
      <td style="padding:12px 0;${i ? `border-top:1px solid ${C.line};` : ""}font:600 15px/1.4 ${FONT};color:${C.ink};text-align:right;white-space:nowrap;" valign="middle">${inr(l.amount)}</td>
    </tr>`,
    )
    .join("");
  const extra = charges
    .filter(([, v]) => v !== 0)
    .map(
      ([k, v]) => `
    <tr>
      <td colspan="2" style="padding:4px 0;font:400 14px/1.5 ${FONT};color:${C.muted};">${esc(k)}</td>
      <td style="padding:4px 0;font:400 14px/1.5 ${FONT};color:${C.muted};text-align:right;white-space:nowrap;">${v < 0 ? `&minus; ${inr(-v)}` : inr(v)}</td>
    </tr>`,
    )
    .join("");
  return card(`
    ${sectionTitle(title)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      ${items}
      <tr><td colspan="3" style="padding:8px 0 0 0;border-top:2px solid ${C.line};"></td></tr>
      ${extra}
      <tr>
        <td colspan="2" style="padding:12px 0 0 0;font:800 18px/1.3 ${FONT};color:${C.ink};">Total</td>
        <td style="padding:12px 0 0 0;font:800 18px/1.3 ${FONT};color:${C.ink};text-align:right;white-space:nowrap;">${inr(total)}</td>
      </tr>
      ${footnote ? `<tr><td colspan="3" style="padding:6px 0 0 0;font:400 12px/1.5 ${FONT};color:${C.muted};">${footnote}</td></tr>` : ""}
    </table>`);
}

/** Order progress tracker: filled dots up to the current step. */
export function progress(steps: string[], current: number) {
  const w = Math.floor(100 / steps.length);
  const cells = steps
    .map((s, i) => {
      const done = i <= current;
      return `
      <td width="${w}%" align="center" valign="top" style="padding:0 2px;">
        <div style="width:28px;height:28px;margin:0 auto;border-radius:999px;background:${done ? C.leaf : C.line};color:#fff;font:700 13px/28px ${FONT};text-align:center;">${done ? "&#10003;" : i + 1}</div>
        <div style="margin-top:8px;font:${i === current ? 700 : 500} 12px/1.3 ${FONT};color:${done ? C.ink : C.muted};">${esc(s)}</div>
      </td>`;
    })
    .join("");
  return `
<tr><td style="padding:28px 40px 0 40px;" class="px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${cells}</tr></table>
</td></tr>`;
}

export const spacer = (h = 8) => `<tr><td style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</td></tr>`;

// ── page ────────────────────────────────────────────────

/** Wraps blocks in the branded shell: chartreuse header, white card, cream page, footer. */
export function layout(a: { preheader: string; blocks: string[]; brand: Brand; audience?: "customer" | "staff" }) {
  const b = a.brand;
  const contact = [b.phone && `<a href="tel:${esc(b.phone)}" style="color:${C.leaf};text-decoration:none;">${esc(b.phone)}</a>`, b.email && `<a href="mailto:${esc(b.email)}" style="color:${C.leaf};text-decoration:none;">${esc(b.email)}</a>`]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(b.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:0;background:${C.cream};-webkit-text-size-adjust:100%;}
  a{color:${C.leaf};}
  img{border:0;outline:none;text-decoration:none;}
  @media (max-width:620px){
    .px{padding-left:24px!important;padding-right:24px!important;}
    .h1{font-size:26px!important;}
    .shell{border-radius:0!important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(a.preheader)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${C.cream};" bgcolor="${C.cream}">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="shell" style="width:100%;max-width:600px;background:#ffffff;border-radius:28px;overflow:hidden;" bgcolor="#ffffff">
    <tr><td align="center" bgcolor="${C.lime}" style="background:${C.lime};padding:26px 24px 22px 24px;">
      <a href="${esc(SITE_URL)}" target="_blank"><img src="${esc(abs("/brand/leafli-wordmark.png"))}" width="118" height="93" alt="${esc(b.name)}" style="display:block;width:118px;height:auto;"></a>
    </td></tr>
    ${a.blocks.join("\n")}
    ${spacer(40)}
  </table>
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
    <tr><td align="center" style="padding:28px 24px 8px 24px;font:400 13px/1.7 ${FONT};color:${C.muted};">
      ${a.audience === "staff" ? "Team alert from your Leafli kitchen system." : `<b style="color:${C.leaf};">Fresh bowls. Happy moods.</b><br>Questions? Just reply to this email — a real person reads it.`}
      ${contact ? `<br>${contact}` : ""}
    </td></tr>
    <tr><td align="center" style="padding:4px 24px 24px 24px;font:400 12px/1.6 ${FONT};color:${C.muted};">
      ${b.address ? `${esc(b.address)}<br>` : ""}
      ${b.gstin ? `GSTIN ${esc(b.gstin)} · ` : ""}<a href="${esc(SITE_URL)}" style="color:${C.muted};">${esc(SITE_URL.replace(/^https?:\/\//, ""))}</a>
      ${a.audience === "staff" ? "" : ` · <a href="${esc(abs("/privacy"))}" style="color:${C.muted};">Privacy</a>`}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

/** Plain-text twin for every email (spam filters and text-only clients like it). */
export function textVersion(parts: (string | false | null | undefined)[], brand: Brand) {
  const footer = [`— ${brand.name} · ${SITE_URL}`, brand.phone && `Call/WhatsApp: ${brand.phone}`].filter(Boolean).join("\n");
  return [...parts.filter(Boolean), footer].join("\n\n");
}
