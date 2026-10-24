// Render every email template with sample data to a folder: tsx --conditions=react-server scripts/render-emails.ts <outDir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SAMPLES } from "../src/lib/server/email/samples";

const out = process.argv[2] || "email-previews";
mkdirSync(out, { recursive: true });
const brand = { name: "Leafli", phone: "+91 98765 43210", email: "support@leafli.in", address: "Pune, Maharashtra 411001" };
for (const [id, t] of Object.entries(SAMPLES)) {
  const e = t.build(brand);
  writeFileSync(join(out, `${id}.html`), e.html);
  writeFileSync(join(out, `${id}.txt`), `Subject: ${e.subject}\n\n${e.text}`);
}
console.log(`Rendered ${Object.keys(SAMPLES).length} templates to ${out}`);
