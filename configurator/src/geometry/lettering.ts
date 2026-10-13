/* Canvas helpers shared by the tire sidewall, the wheel lip engraving and the
   centre cap logo. Everything draws into a 2D canvas (OffscreenCanvas where
   the browser has it) and becomes a CanvasTexture or a DataTexture, never a
   blob: URL, so it passes Railway's CSP. Without a 2D canvas (jsdom under
   vitest) every helper returns null and the caller leaves its decal out. */
import { CanvasTexture, DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, SRGBColorSpace } from "three";

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export function canvas2d(w: number, h = w): { canvas: AnyCanvas; ctx: Ctx } | null {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const c = new OffscreenCanvas(w, h);
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (ctx) return { canvas: c, ctx };
    }
    if (typeof document === "undefined" || /jsdom/i.test(navigator.userAgent)) return null;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    return ctx ? { canvas: c, ctx } : null;
  } catch { return null; }
}

/** The face the brand marks are set in: a wide technical sans, Arial Black when it has not loaded. */
export const MARK_FONT = `Michroma, "Arial Black", Arial, sans-serif`;

export function colourTexture(c: AnyCanvas, name: string): CanvasTexture {
  const tex = new CanvasTexture(c as HTMLCanvasElement);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  tex.name = name;
  return tex;
}

/* Text written around a circle, letter tops pointing away from the centre.
   centres are the angles (canvas space, y down) each copy is centred on. */
export function ringText(ctx: Ctx, size: number, label: string, rPx: number, hPx: number, centres: number[], weight = 700) {
  ctx.font = `${weight} ${Math.round(hPx)}px ${MARK_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const track = hPx * 0.18;
  const widths = [...label].map((ch) => ctx.measureText(ch).width + track);
  const total = widths.reduce((a, b) => a + b, 0);
  for (const centre of centres) {
    let acc = -total / 2;
    for (let i = 0; i < label.length; i++) {
      const a = centre + (acc + widths[i] / 2) / rPx;
      acc += widths[i];
      ctx.save();
      ctx.translate(size / 2 + rPx * Math.cos(a), size / 2 + rPx * Math.sin(a));
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(label[i], 0, 0);
      ctx.restore();
    }
  }
}

/* A tangent-space normal map from a height field drawn in a canvas (any
   channel: the alpha channel when alpha is true, else red). Row y of the
   canvas becomes row y of the texture, so a canvas drawn with y = v * height
   lines up with the geometry's v. flipY instead matches a CanvasTexture of
   the same canvas (canvas top at v = 1), for a normal map paired with one. */
export function heightToNormal(ctx: Ctx, w: number, h: number, strength: number, opts: { alpha?: boolean; wrapX?: boolean; flipY?: boolean; name?: string } = {}): DataTexture {
  const src = ctx.getImageData(0, 0, w, h).data;
  const ch = opts.alpha ? 3 : 0;
  const H = (x: number, y: number) => {
    if (opts.wrapX) x = (x + w) % w; else x = Math.min(w - 1, Math.max(0, x));
    y = Math.min(h - 1, Math.max(0, y));
    return src[(y * w + x) * 4 + ch] / 255;
  };
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
      let nx = -dx * strength, ny = (opts.flipY ? dy : -dy) * strength;
      const l = Math.hypot(nx, ny, 1);
      nx /= l; ny /= l;
      const i = ((opts.flipY ? h - 1 - y : y) * w + x) * 4;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((0.5 / l + 0.5) * 255);
      out[i + 3] = 255;
    }
  }
  const tex = new DataTexture(out, w, h, RGBAFormat);
  if (opts.wrapX) tex.wrapS = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  tex.name = opts.name ?? "height-normal";
  return tex;
}

/* A texture for a mirrored corner: same image, u reversed, so text reads the
   right way round under the corner's scale-x -1. */
export function mirroredCopy<T extends CanvasTexture | DataTexture>(tex: T): T {
  const m = tex.clone() as T;
  m.repeat.x = -tex.repeat.x;
  m.offset.x = tex.repeat.x > 0 ? 1 - tex.offset.x : tex.offset.x;
  m.needsUpdate = true;
  return m;
}
