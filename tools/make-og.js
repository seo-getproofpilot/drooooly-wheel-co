#!/usr/bin/env node
'use strict';
/*
  make-og.js — regenerate the link-preview image from whatever the hero is.

  WHY THIS EXISTS. The share card (iMessage, Facebook, WhatsApp, Slack,
  LinkedIn, X) does not read the page. It reads one meta tag, og:image, which
  points at a single flat file. So the hero can change and the card will keep
  showing whatever that file held the day it was made — which is exactly what
  happened: the hero became the C10 and every link anyone sent still showed
  the F-250.

  The hero is going to change about once a month as customer trucks get
  featured, so this is a command rather than a note in a checklist:

      node tools/make-og.js

  It reads the hero straight out of index.html, so it cannot drift from what
  the page actually shows. Then it crops to the 1.91:1 the platforms want,
  resizes to 1200x630, writes assets/og-share.jpg, copies the hero's alt text
  onto the share tags, and bumps the site's ?v= stamp.

  THE ?v= BUMP IS NOT OPTIONAL HOUSEKEEPING. Every platform caches the
  preview against the image URL. Replacing the bytes at the same URL changes
  nothing for anyone who has already seen it — the old F-250 card would keep
  coming back. Changing the URL is what forces a re-scrape. Pass --no-bump
  only if you are bumping the stamp yourself in the same commit.

  Flags:
    --src=assets/foo.jpg   use this image instead of the hero in index.html
    --bias=0.55            share of the trimmed height taken off the TOP
                           (0 = trim all from the bottom, 1 = all from the top)
    --no-bump              leave the ?v= stamp alone
*/

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = 'assets/og-share.jpg';
const W = 1200, H = 630;              // what the platforms ask for
const RATIO = W / H;                  // 1.9047…

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const bias = Math.min(1, Math.max(0, parseFloat(flag('bias', '0.55'))));
const bump = !args.includes('--no-bump');

const die = m => { console.error(`make-og: ${m}`); process.exit(1); };
const sips = a => execFileSync('sips', a, { encoding: 'utf8' });
const dims = f => {
  const t = sips(['-g', 'pixelWidth', '-g', 'pixelHeight', f]);
  const w = +(/pixelWidth:\s*(\d+)/.exec(t) || [])[1];
  const h = +(/pixelHeight:\s*(\d+)/.exec(t) || [])[1];
  if (!w || !h) die(`could not read the size of ${f}`);
  return { w, h };
};

/* ---------- 1. where is the hero? --------------------------------------- */
const indexPath = path.join(ROOT, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');

// The hero is three blurred plates plus one sharp frame inside .cine__bg; the
// sharp one is the <picture>, and that is the one worth sharing.
const bgBlock = /<div class="cine__bg">([\s\S]*?)<\/div>/.exec(html);
if (!bgBlock) die('could not find .cine__bg in index.html — did the hero markup change?');
const pic = /<picture>[\s\S]*?<img[^>]*src="([^"?]+)[^"]*"[^>]*>/.exec(bgBlock[1]);
if (!pic) die('found .cine__bg but no <picture><img> inside it');

let src = flag('src', pic[1]);
const alt = (/<picture>[\s\S]*?\balt="([^"]*)"/.exec(bgBlock[1]) || [, ''])[1];

const srcAbs = path.join(ROOT, src);
if (!fs.existsSync(srcAbs)) die(`${src} is referenced by the hero but is not on disk`);

/* ---------- 2. crop to 1.91:1, then resize ------------------------------ */
const { w: sw, h: sh } = dims(srcAbs);
let cw, ch, top = 0, left = 0;
if (sw / sh > RATIO) {                 // too wide: trim the sides, centred
  ch = sh; cw = Math.round(sh * RATIO); left = Math.round((sw - cw) / 2);
} else {                               // too tall: trim top/bottom by `bias`
  cw = sw; ch = Math.round(sw / RATIO); top = Math.round((sh - ch) * bias);
}

const tmp = path.join(require('os').tmpdir(), `og-${process.pid}.jpg`);
fs.copyFileSync(srcAbs, tmp);
sips(['-c', String(ch), String(cw), '--cropOffset', String(top), String(left), tmp]);
sips(['--resampleHeightWidth', String(H), String(W), tmp]);
sips(['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', tmp, '--out', path.join(ROOT, OUT)]);
fs.unlinkSync(tmp);

const got = dims(path.join(ROOT, OUT));
if (got.w !== W || got.h !== H) die(`wrote ${got.w}x${got.h}, expected ${W}x${H}`);
const kb = Math.round(fs.statSync(path.join(ROOT, OUT)).size / 1024);

/* ---------- 3. carry the hero's alt text onto the share tags ------------ */
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
let altPages = 0;
for (const f of pages) {
  const p = path.join(ROOT, f);
  let t = fs.readFileSync(p, 'utf8');
  if (!/og:image"\s+content="[^"]*og-share\.jpg/.test(t)) continue;   // buddy.html etc.
  const before = t;
  if (/property="og:image:alt"/.test(t)) {
    t = t.replace(/(<meta property="og:image:alt" content=")[^"]*(")/, `$1${esc(alt)}$2`);
  } else {
    t = t.replace(/(<meta property="og:image:height"[^>]*>\n)/,
      `$1<meta property="og:image:alt" content="${esc(alt)}" />\n`);
  }
  if (/name="twitter:image:alt"/.test(t)) {
    t = t.replace(/(<meta name="twitter:image:alt" content=")[^"]*(")/, `$1${esc(alt)}$2`);
  } else {
    t = t.replace(/(<meta name="twitter:image"[^>]*>\n)/,
      `$1<meta name="twitter:image:alt" content="${esc(alt)}" />\n`);
  }
  if (t !== before) { fs.writeFileSync(p, t); altPages++; }
}

/* ---------- 4. bump ?v= so the platforms re-scrape ---------------------- */
let from = 0, to = 0;
if (bump) {
  for (const f of pages) {
    for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/\?v=(\d+)/g)) {
      from = Math.max(from, +m[1]);
    }
  }
  if (!from) die('no ?v= stamp found to bump');
  to = from + 1;
  for (const f of pages) {
    const p = path.join(ROOT, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replaceAll(`?v=${from}`, `?v=${to}`));
  }
}

/* ---------- 5. say what happened ---------------------------------------- */
console.log(`  hero    ${src}  (${sw}x${sh})`);
console.log(`  crop    ${cw}x${ch} at +${left},+${top}  →  ${W}x${H}`);
console.log(`  wrote   ${OUT}  ${kb} KB`);
console.log(`  alt     "${alt}"  on ${altPages} page${altPages === 1 ? '' : 's'}`);
console.log(bump ? `  stamp   ?v=${from} → ?v=${to}  (this is what makes the card refresh)`
                 : `  stamp   left alone — bump it yourself or the old card keeps showing`);
console.log(`
  Commit and push, then force the caches that matter:
    Facebook / Instagram   https://developers.facebook.com/tools/debug/  → Scrape Again
    LinkedIn               https://www.linkedin.com/post-inspector/
    X                      re-posting the link is enough
    iMessage               a new ?v= is a new URL, so it fetches fresh`);
