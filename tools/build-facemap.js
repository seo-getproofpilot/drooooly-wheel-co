#!/usr/bin/env node
/* ============================================================
   DROOOLY — wheel face calibration

   Every wheel PNG is a manufacturer render at a shallow yaw, with the barrel
   hanging off to the LEFT of the face and a different amount of padding in
   every brand's art. To mount a wheel on a hub we need to know, per image,
   where the face actually is and how big it is — not where the bounding box is.

   The right-hand side of the alpha silhouette is a clean trace of the outer
   flange, because the barrel only ever intrudes on the left. So: take the
   rightmost opaque pixel of each row, fit a circle to those points, and reject
   outliers (drop shadows, lug-cap bleed) by iteratively dropping the worst
   residuals and refitting.

   Writes wheel-faces.js -> window.WHEEL_FACES = { "path": [cx, cy, r], ... }
   with values normalised 0..1 against image width/height so they survive any
   later re-encode at a different resolution.

     node tools/build-facemap.js            build
     node tools/build-facemap.js --report   list poor fits only
     node tools/build-facemap.js --sheet    contact sheet for eyeball QA
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const REPORT = process.argv.includes("--report");
const SHEET = process.argv.includes("--sheet");

const PY = `
from PIL import Image, ImageDraw
import os, glob, sys, json, math

root, want_sheet = sys.argv[1], sys.argv[2] == '1'
ALPHA = 110          # ignore soft drop shadows
TRIM  = 0.20         # drop this fraction of worst points, iteratively

def fit_circle(pts):
    """Kasa algebraic fit: minimise sum (x^2+y^2 + Dx + Ey + F)^2."""
    n = len(pts)
    if n < 12: return None
    Sx=Sy=Sxx=Syy=Sxy=Sz=Szx=Szy=0.0
    for x, y in pts:
        z = x*x + y*y
        Sx+=x; Sy+=y; Sxx+=x*x; Syy+=y*y; Sxy+=x*y; Sz+=z; Szx+=z*x; Szy+=z*y
    # solve the 3x3 normal equations for D, E, F
    A = [[Sxx, Sxy, Sx], [Sxy, Syy, Sy], [Sx, Sy, float(n)]]
    b = [-Szx, -Szy, -Sz]
    # gaussian elimination with partial pivoting
    for i in range(3):
        p = max(range(i, 3), key=lambda r: abs(A[r][i]))
        if abs(A[p][i]) < 1e-12: return None
        A[i], A[p] = A[p], A[i]; b[i], b[p] = b[p], b[i]
        for r in range(i+1, 3):
            f = A[r][i]/A[i][i]
            for c in range(i, 3): A[r][c] -= f*A[i][c]
            b[r] -= f*b[i]
    sol=[0.0]*3
    for i in (2,1,0):
        s = b[i] - sum(A[i][c]*sol[c] for c in range(i+1,3))
        sol[i] = s/A[i][i]
    D,E,F = sol
    cx, cy = -D/2.0, -E/2.0
    v = cx*cx + cy*cy - F
    if v <= 0: return None
    return cx, cy, math.sqrt(v)

def right_edge(im):
    """Rightmost opaque pixel per row — traces the outer flange."""
    a = im.getchannel('A'); w, h = im.size
    px = a.load(); pts = []
    for y in range(0, h):
        for x in range(w-1, -1, -1):
            if px[x, y] >= ALPHA:
                pts.append((float(x), float(y))); break
    return pts

def robust_fit(pts):
    cur = pts[:]
    best = None
    for _ in range(6):
        f = fit_circle(cur)
        if not f: break
        cx, cy, r = f
        res = [(abs(math.hypot(x-cx, y-cy) - r), (x, y)) for x, y in cur]
        res.sort(key=lambda t: t[0])
        med = res[len(res)//2][0]
        best = (cx, cy, r, med)
        keep = int(len(res) * (1.0 - TRIM))
        if keep < 12: break
        cur = [p for _, p in res[:keep]]
    return best

out, poor = {}, []
files = sorted(glob.glob(os.path.join(root, 'assets/wheels/*/*.png')))
files = [f for f in files if os.sep + '_originals' + os.sep not in f]

sheet_cells = []
for p in files:
    rel = os.path.relpath(p, root)
    try:
        im = Image.open(p).convert('RGBA')
    except Exception as e:
        poor.append((rel, 'unreadable: %s' % e)); continue
    w, h = im.size
    fit = robust_fit(right_edge(im))
    if not fit:
        poor.append((rel, 'no fit')); continue
    cx, cy, r, med = fit
    # sanity: the circle must sit inside a plausible envelope
    if not (0.15*w < cx < 1.15*w and 0.15*h < cy < 1.15*h and 0.2*min(w,h) < r < 1.2*max(w,h)):
        poor.append((rel, 'implausible cx=%.0f cy=%.0f r=%.0f' % (cx, cy, r)))
    elif med > 1.5:
        poor.append((rel, 'residual %.2fpx' % med))
    out[rel] = [round(cx/w, 5), round(cy/h, 5), round(r/w, 5), round(med, 2)]
    if want_sheet and len(sheet_cells) < 60:
        th = im.copy(); d = ImageDraw.Draw(th)
        d.ellipse([cx-r, cy-r, cx+r, cy+r], outline=(255,60,60,255), width=5)
        d.ellipse([cx-6, cy-6, cx+6, cy+6], fill=(60,160,255,255))
        th.thumbnail((200,200)); sheet_cells.append((th, os.path.basename(rel)))

if want_sheet and sheet_cells:
    cols = 6; cw = ch = 210
    rows = (len(sheet_cells)+cols-1)//cols
    sheet = Image.new('RGB', (cols*cw, rows*ch), (16,18,22))
    for i,(th,_) in enumerate(sheet_cells):
        sheet.paste(th, ((i%cols)*cw+5, (i//cols)*ch+5), th)
    dest = os.environ.get('SHEET_OUT', '/tmp/drooly-facemap-sheet.png')
    sheet.save(dest); print('SHEET:'+dest)

print('JSON:' + json.dumps({'faces': out, 'poor': poor, 'total': len(files)}))
`;

const raw = execFileSync("python3", ["-c", PY, ROOT, SHEET ? "1" : "0"], {
  encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
});
raw.split("\n").filter((l) => l.startsWith("SHEET:")).forEach((l) => console.log("contact sheet →", l.slice(6)));
const line = raw.split("\n").find((l) => l.startsWith("JSON:"));
const { faces, poor, total } = JSON.parse(line.slice(5));

// hand corrections for images the fit can't recover
const OVR = path.join(ROOT, "data/specs/face-overrides.json");
let overrides = {};
if (fs.existsSync(OVR)) {
  overrides = JSON.parse(fs.readFileSync(OVR, "utf8"));
  Object.keys(overrides).forEach((k) => { faces[k] = overrides[k]; });
}

if (REPORT) {
  console.log(`\n${poor.length} of ${total} need attention:\n`);
  poor.forEach(([f, why]) => console.log(`  ${f.padEnd(52)} ${why}`));
  console.log(`\n${Object.keys(overrides).length} hand overrides applied.`);
} else {
  const body = Object.keys(faces).sort().map((k) =>
    `  ${JSON.stringify(k)}:[${faces[k][0]},${faces[k][1]},${faces[k][2]}]`).join(",\n");
  fs.writeFileSync(path.join(ROOT, "wheel-faces.js"),
`/* ============================================================
   DROOOLY — wheel face calibration  (GENERATED by tools/build-facemap.js)
   "path": [cx, cy, r]  — normalised: cx/r against image WIDTH, cy against HEIGHT.
   Mount with:  scale = targetRadiusPx / (r * imgW)
   ============================================================ */
window.WHEEL_FACES = {
${body}
};
`);
  const sz = (fs.statSync(path.join(ROOT, "wheel-faces.js")).size / 1024).toFixed(1);
  console.log(`wheel-faces.js written — ${Object.keys(faces).length} of ${total} calibrated, ${sz} KB`);
  console.log(`${poor.length} flagged (run --report to list, add fixes to data/specs/face-overrides.json)`);
}
