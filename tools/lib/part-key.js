'use strict';
/* ============================================================
   DROOOLY — is this the same wheel as that one?

   THREE TOOLS NEED THE SAME ANSWER and they must not disagree:

     tools/build-featured.js   decides whether a featured entry is a model we
                               already carry or a new card to add
     tools/wire-wheel-sizes.js matches our models to a manufacturer's parts,
                               and collapses two of ours onto one part
     tools/qc-catalog.js       fails the build when one wheel is listed twice

   THE RULE IS NARROW, AND IT HAS TO BE. Two near-misses, both real:

     TOO LOOSE. Keying on the part NUMBER alone calls JTX's D-200 and SS-200
     the same wheel. They are the dually and the super single — different
     parts, different widths. The same mistake merged Method's "305 NV" with
     "305 NV HD", "412 UTV Forged Bead Grip" with "412 UTV Forged Beadlock",
     and Raceline's "A14 Alpha" with "A14 Alpha Beadlock". Measured: it would
     have collapsed 24 distinct wheels.

     TOO TIGHT. build-featured.js matched on /\b[A-Z]{1,4}\d{2,4}\b/, which
     requires the letters to touch the digits. "TIS 547" has a space, so it
     keyed on nothing — and so did the bare "547" we already carried. The two
     never grouped and TIS shipped with six wheels listed twice.

   So: strip the brand's own name, strip a TRAILING configuration word, and
   keep everything else. "HD", "Beadlock", "Bead Grip" and an "-R" suffix all
   name a different part and all survive.

       "TIS 547"          -> 547          "D-200"   -> D200
       "547"              -> 547          "SS-200"  -> SS200
       "Summit Dually"    -> SUMMIT       "305 NV"  -> 305NV
       "Summit"           -> SUMMIT       "305 NV HD" -> 305NVHD

   collapseNumbered() handles the last real case separately, because it is
   the one place a looser rule is justified: a model carried both WITH and
   WITHOUT its leading part number, which is how Vision ended up listing
   "56 Midway" and "Midway" as two wheels.
   ============================================================ */

function reFor(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '[ -]?');
}

/* The identity of a part within its brand. `brand` is {slug, name}. */
function partKey(brand, name) {
  const slugRe = reFor((brand || {}).slug);
  const nameRe = reFor((brand || {}).name);
  const alts = [slugRe, nameRe].filter(Boolean).join('|');
  let t = String(name || '').toUpperCase();
  if (alts) t = t.replace(new RegExp('\\b(' + alts + ')\\b', 'g'), ' ');
  t = t.replace(/\b(DUALLY|DRW|SUPER\s*SINGLE)\s*$/, ' ')
       .replace(/[^A-Z0-9]+/g, '');
  return t || null;
}

/* Given {key: [things]}, fold a key that is another key plus a leading part
   number into that other key. "56MIDWAY" -> "MIDWAY". Only when what remains
   starts with a letter, so "404" does not fold into "". */
function collapseNumbered(groups) {
  Object.keys(groups).forEach(function (k) {
    const stripped = k.replace(/^\d+/, '');
    if (stripped && stripped !== k && /^[A-Z]/.test(stripped) && groups[stripped]) {
      groups[stripped] = groups[stripped].concat(groups[k]);
      delete groups[k];
    }
  });
  return groups;
}

/* THE PART NUMBER, for matching our listing to a MANUFACTURER's part.

   A different job from partKey() and it needs a looser answer. partKey keeps
   every distinguishing word, because within our own catalogue "A14 Alpha" and
   "A14 Alpha Beadlock" must stay two wheels. But Vision list part 181 and we
   call it "181 Hauler Dually", so matching needs the 181.

   IT RETURNS CANDIDATES, MOST SPECIFIC FIRST, rather than one guess. The
   first version returned a single key from /^(\d{2,4}[A-Z]{0,2})/ — meant to
   keep a real suffix like Vision's "181NR" — and because partKey has already
   removed the spaces, it ate the first two letters of the next WORD instead:
   "181 Hauler Dually" came back as "181HA", matched nothing, and three Vision
   models were reported unresolved while their data sat right there under 181.
   Specific-first ordering is what keeps 181NR from falling through to 181.

   Only ever used to look a part UP. Never to decide that two of our own
   entries are the same wheel — that is partKey's job, and using a number for
   it is exactly how D-200 and SS-200 got merged. */
function numberKeys(brand, name) {
  const k = partKey(brand, name);
  if (!k) return [];
  const out = [];
  if (/^[A-Z]{0,4}\d{2,4}[A-Z]*$/.test(k)) out.push(k);   // the whole key is code-like
  const lead = /^([A-Z]{1,4}\d{2,4})/.exec(k);            // "DC08" out of DC08KRYPTIKDC
  if (lead) out.push(lead[1]);
  const dig = /^(\d{2,4})([A-Z]*)/.exec(k);
  if (dig) {
    /* A real suffix like Vision's "181NR" is one or two letters riding on the
       number; "181HAULER" is a number and then a WORD. Nothing in the string
       distinguishes them, so offer both and let the caller try the longest
       first: 181NR, 181N, 181 — and for 181HAULER, 181HA and 181H simply
       miss and 181 hits. Guessing one of these was the bug. */
    for (let n = Math.min(2, dig[2].length); n >= 0; n--) out.push(dig[1] + dig[2].slice(0, n));
  }
  return out.filter((v, i) => out.indexOf(v) === i);
}

/* Kept for callers that want one answer: the most specific candidate. */
function numberKey(brand, name) {
  const ks = numberKeys(brand, name);
  return ks.length ? ks[0] : null;
}

module.exports = { partKey, collapseNumbered, numberKey, numberKeys };
