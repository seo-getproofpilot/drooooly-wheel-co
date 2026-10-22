#!/usr/bin/env node
'use strict';
/* ============================================================
   DROOOLY — a card image per builder, composited from its own layers

   THE PROBLEM. The platform picker showed seven cards and four of them were
   the same photograph, because that is all the stock art we had: one UTV
   beadlock shot standing in for Pro R, Maverick R, Expedition and the sand
   car. A customer scanning that grid cannot tell the platforms apart, which
   is the one job the grid has.

   THE FIX. Every builder already knows what it looks like — its own opening
   state is a layer stack, and that stack is a picture of that exact wheel. So
   rather than hunt for seven photographs, composite the default build the same
   way the page does and write it out. The card then shows the actual wheel the
   builder opens on, and it can never drift from the spec: re-run this whenever
   the specs change.

   It is deliberately the DEFAULT build and not a prettier one. The card is a
   promise about what you get when you click, so it should be the thing you
   land on.

   Resolution: his layers are 1000x1000 on transparency. We flatten onto the
   site's own panel grey rather than white, so the card sits in the grid
   without a bright square around it, and write 760x570 at 4:3 to match
   .bpick__img — the wheel centred with room to breathe.

   RIGHTS: his renders, same as the live stage — LAUNCH-CHECKLIST 1.13.

   Usage:  node tools/make-builder-cards.js [--force]
   Needs:  python3 with Pillow (the same dependency tools/optimize-wheels.js uses)
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRCDIR = path.join(ROOT, 'data/builders');
const OUTDIR = path.join(ROOT, 'assets/wheels/price-designs');
const CACHE = path.join(ROOT, '.cache/pd-layers');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const FORCE = process.argv.includes('--force');

const W = 760, H = 570;            // 4:3, matches .bpick__img
const BG = '#eef1f4';              // var(--panel-2) territory

fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUTDIR, { recursive: true });

/* The visibility rule, shared with the engine so a card can never show a
   state the page could not reach — see builder-logic.js. Gating off: the card
   wants the finished wheel, and there is nobody here to answer a gate. */
const LOGIC = require(path.join(ROOT, 'builder-logic.js'));
const visible = (steps, pick) => LOGIC.visible(steps, pick, { gate: false });

/* Which step is the one that changes what the wheel LOOKS like most — the
   model. Taken as the first visible chips step whose options carry layers and
   where there is more than one of them, which is what "model" means in every
   one of his trees without having to match on the word. */
function styleStep(spec, pick) {
  return visible(spec.steps, pick).steps.filter(st =>
    st.type === 'chips' && (st.options || []).length > 1 &&
    st.options.filter(o => o.layer).length > 1)[0] || null;
}

function plan(spec, nth) {
  /* Open on his defaults, then let complete() answer anything still blank —
     a card wants a finished wheel, not a half-built one. The page asks the
     customer instead; here there is nobody to ask. */
  let pick = Object.assign({}, spec.defaults || {});

  /* `nth` only moves off 0 when this builder's default wheel is pixel-for-pixel
     another builder's default wheel, which happens because he sells the same
     face across platforms that differ only in fitment — Pro R and Expedition
     open on exactly the same render. Two identical cards in a seven-card grid
     is the one thing the grid must not do, so that builder shows a different
     model out of its own range instead. */
  if (nth) {
    const st = styleStep(spec, pick);
    const opts = st ? st.options.filter(o => o.layer) : [];
    if (st && opts.length) pick[st.id] = opts[nth % opts.length].v;
  }

  const v = LOGIC.complete(spec, pick, { gate: false });
  return { layers: LOGIC.layerPlan(spec, v), pick: v.pick };
}

function fetchLayer(spec, file) {
  const dest = path.join(CACHE, file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) return dest;
  const url = /^https?:/.test(file) ? file : spec.layerBase + file;
  execFileSync('curl', ['-sS', '-L', '--max-time', '45', '-A', UA, '-o', dest, url]);
  if (!fs.existsSync(dest) || fs.statSync(dest).size < 1000) throw new Error('layer too small: ' + file);
  return dest;
}

const PY = `
import sys, json
from PIL import Image
spec = json.loads(sys.argv[1])
W, H, BG = spec["w"], spec["h"], spec["bg"]
# JSON has no tuples, so an RGBA background arrives as a list; PIL wants a
# tuple. A hex string passes through untouched.
if isinstance(BG, list):
    BG = tuple(BG)
canvas = Image.new("RGBA", (W, H), BG)
# Composite at the layers' own size, then scale once — scaling each layer
# separately would let rounding drift the ring off the face by a pixel.
stack = None
for p in spec["files"]:
    im = Image.open(p).convert("RGBA")
    if stack is None:
        stack = Image.new("RGBA", im.size, (0, 0, 0, 0))
    if im.size != stack.size:
        im = im.resize(stack.size, Image.LANCZOS)
    stack = Image.alpha_composite(stack, im)
if stack is None:
    sys.exit("no layers")
# Trim the transparent margin so the wheel fills the card, then inset.
bb = stack.getbbox()
if bb:
    stack = stack.crop(bb)
pad = 0.90
sw, sh = stack.size
sc = min(W * pad / sw, H * pad / sh)
stack = stack.resize((max(1, int(sw * sc)), max(1, int(sh * sc))), Image.LANCZOS)
canvas.alpha_composite(stack, ((W - stack.width) // 2, (H - stack.height) // 2))
if spec.get("alpha"):
    # The homepage showcase card floats its wheel on the stage's own gradient
    # and glow, the way all seven other cards do, so it needs the background
    # to stay transparent rather than being flattened onto panel grey.
    canvas.save(spec["out"], "PNG", optimize=True)
else:
    canvas.convert("RGB").save(spec["out"], "JPEG", quality=86, optimize=True, progressive=True)
print(spec["out"])
`;

const files = fs.readdirSync(SRCDIR).filter(f => f.endsWith('.json')).sort();
let made = 0, skipped = 0;
const seen = new Map();          // layer signature -> the builder that claimed it

files.forEach(f => {
  const spec = JSON.parse(fs.readFileSync(path.join(SRCDIR, f), 'utf8'));
  const out = path.join(OUTDIR, spec.id + '-card.jpg');
  process.stdout.write('  ' + spec.id.padEnd(16));
  if (fs.existsSync(out) && !FORCE) { console.log('exists (--force to rebuild)'); skipped++; return; }

  /* Take the default build unless another builder already has that exact
     stack, then step through this builder's own models until the picture is
     its own. */
  let p = null, note = '', nth = 0;
  for (; nth < 8; nth++) {
    p = plan(spec, nth);
    const sig = p.layers.map(L => L.file).join('|');
    if (!p.layers.length || !seen.has(sig)) { if (sig) seen.set(sig, spec.id); break; }
    note = ' (default is ' + seen.get(sig) + '’s wheel — showing another model)';
  }
  if (!p.layers.length) { console.log('NO LAYERS — leaving its image alone'); return; }
  let local;
  try {
    local = p.layers.map(L => fetchLayer(spec, L.file));
  } catch (e) {
    console.log('FAILED ' + String(e.message || e).slice(0, 48));
    return;
  }
  execFileSync('python3', ['-c', PY, JSON.stringify({ files: local, out: out, w: W, h: H, bg: BG })],
    { stdio: ['ignore', 'pipe', 'inherit'] });
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`${p.layers.length} layers -> ${kb}KB  ·  ${Object.keys(p.pick).length} choices${note}`);
  made++;
});

console.log(`\n  ${made} built, ${skipped} already there`);
console.log('  point each spec\'s `image` at assets/wheels/price-designs/<id>-card.jpg');

/* ------------------------------------------------------------------
   THE HOMEPAGE SHOWCASE CARD — a transparent cutout, not a photograph.

   The Price Designs card in "Wheels that hit different" used to be the one
   photograph in a row of seven floating wheel renders: it covered its stage
   edge to edge and switched the stage glow off, so it read as a different
   KIND of tile rather than another wheel. The earlier cutout attempt was
   abandoned because the only transparent art we had was a frame lifted out of
   a marketing GIF, which looked exactly as thin as that sounds.

   His builder layers are the answer that was missing: clean 1000x1000 studio
   renders on transparency, the same thing every other card on that row is.
   So the showcase image is composited from the same default stack as the
   chooser card and written as a PNG with its alpha intact.

   The truck is the one that represents the brand on the homepage — it is the
   flagship by a distance (434 of the 989 orders on his store) and the most
   legible wheel to someone who has not met the brand yet.
   ------------------------------------------------------------------ */
{
  const SHOWCASE = 'pd-truck-17x9';
  const outPng = path.join(OUTDIR, 'showcase.png');
  const specPath = path.join(SRCDIR, SHOWCASE + '.json');
  process.stdout.write('\n  showcase (' + SHOWCASE + ')  ');
  if (fs.existsSync(outPng) && !FORCE) {
    console.log('exists (--force to rebuild)');
  } else if (!fs.existsSync(specPath)) {
    console.log('NO SPEC — skipped');
  } else {
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    const p = plan(spec, 0);
    if (!p.layers.length) { console.log('NO LAYERS — skipped'); }
    else {
      const local = p.layers.map(L => fetchLayer(spec, L.file));
      /* 680x680 on transparency, matching ace.png and the rest of the row. */
      execFileSync('python3', ['-c', PY, JSON.stringify({
        files: local, out: outPng, w: 680, h: 680, bg: [0, 0, 0, 0], alpha: true
      })], { stdio: ['ignore', 'pipe', 'inherit'] });
      console.log(p.layers.length + ' layers -> ' +
        Math.round(fs.statSync(outPng).size / 1024) + 'KB transparent PNG');
    }
  }
}
