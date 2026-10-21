#!/usr/bin/env node
/* Renders a DROOOLY promo email from emails/templates/promo.html and a data
   file, and optionally sends it through Resend.

     node tools/email/promo.mjs emails/promo-2026-10-new-combos.json            # writes emails/out/<name>.html
     RESEND_API_KEY=... node tools/email/promo.mjs <data.json> --send to@x.com  # renders, then sends

   The template language is the small subset it uses: {{key}} and {{a.b}}
   (HTML-escaped), and {{#list}}...{{/list}} for arrays (or a truthy value,
   rendered once). No dependencies. Sender is fixed to login's domain,
   drooolywt.com, which is verified in Resend. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const get = (ctx, key) => key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), ctx);

export function render(tpl, ctx) {
  const sections = /\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  let out = tpl.replace(sections, (_, key, inner) => {
    const v = get(ctx, key);
    if (Array.isArray(v)) return v.map((item) => render(inner, { ...ctx, ...item })).join("");
    return v ? render(inner, ctx) : "";
  });
  return out.replace(/\{\{([\w.]+)\}\}/g, (_, key) => esc(get(ctx, key)));
}

/** Plain-text twin for clients that will not show HTML. */
export function toText(d) {
  const lines = [d.eyebrow, d.headline, "", d.intro, "", `${d.hero.cta}: ${d.hero.url}`, "", d.packagesHeading, ""];
  for (const p of d.packages) {
    lines.push(p.name, p.blurb, ...p.specs.map((s) => `${s.k}: ${s.v}`), `${p.cta}: ${p.url}`, "");
  }
  lines.push(d.addonsHeading, ...d.addons.map((a) => `${a.title}. ${a.text}`), "", d.closing, `Call or text ${d.phone}`, "", d.footerLine, d.credit);
  return lines.join("\n");
}

async function main() {
  const [dataPath, flag, to] = process.argv.slice(2);
  if (!dataPath) { console.error("usage: promo.mjs <data.json> [--send to@example.com]"); process.exit(2); }
  const data = JSON.parse(await readFile(path.resolve(dataPath), "utf8"));
  const tpl = await readFile(path.join(ROOT, "emails", "templates", "promo.html"), "utf8");
  const html = render(tpl, data);
  const name = path.basename(dataPath, ".json");
  await mkdir(path.join(ROOT, "emails", "out"), { recursive: true });
  const out = path.join(ROOT, "emails", "out", `${name}.html`);
  await writeFile(out, html);
  console.log(`wrote ${path.relative(ROOT, out)} (${html.length} bytes)`);
  if (flag !== "--send") return;
  if (!to) { console.error("--send needs an address"); process.exit(2); }
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.error("RESEND_API_KEY is not set"); process.exit(2); }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: data.from, to: [to], reply_to: data.replyTo, subject: data.subject, html, text: toText(data), tags: [{ name: "campaign", value: name.replace(/[^\w-]/g, "_") }] }),
  });
  const body = await res.json();
  if (!res.ok) { console.error(`resend ${res.status}: ${body.message ?? JSON.stringify(body)}`); process.exit(1); }
  console.log(`sent to ${to}: ${body.id}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
