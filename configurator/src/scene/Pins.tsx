/* The callout pin: a dark card anchored in 3D to the driver's front wheel
   centre (fit.corners FL), with a short leader line from a dot on the wheel
   centre up to the card. The card sits up and to the right of the wheel, and
   flips to the left whenever the wheel projects into the right half of the
   stage, so it is never pushed off a 390px phone stage. Its width also
   shrinks to the room left on that side (never under MIN_W).

   Layout is applied straight to the DOM from the frame loop: the anchor moves
   every frame while the turntable runs, and a React render per frame would
   be wasted work. Strings come in as props; this file adds no copy. */
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Vector3 } from "three";
import type { FitResult } from "../fitment/fitment3d";

export interface PinsProps {
  fit: FitResult;
  /** e.g. "26x14 -76", set in Michroma */
  headline: string;
  /** e.g. "JTX Silencer, polished" */
  line2?: string;
  /** the stance sentence */
  line3?: string;
  visible?: boolean;
}

export const PIN_MAX_W = 240;
const MIN_W = 150;
const GAP = 10; // clear space kept between the card and the stage edge

const DOT: React.CSSProperties = {
  position: "absolute", left: -5, top: -5, width: 10, height: 10, borderRadius: "50%",
  background: "#ffffff", boxShadow: "0 0 0 3px rgba(255,255,255,0.22), 0 0 10px rgba(255,255,255,0.45)",
};
const CARD: React.CSSProperties = {
  position: "absolute", boxSizing: "border-box", width: "max-content", maxWidth: PIN_MAX_W,
  padding: "10px 12px 11px", borderRadius: 8,
  background: "rgba(14,14,16,0.88)", border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
  backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
  color: "#e7e8ea", font: "400 13px/1.4 Inter, system-ui, sans-serif", textAlign: "left",
};
const HEAD: React.CSSProperties = { font: "400 15px/1.25 Michroma, Inter, sans-serif", letterSpacing: "0.02em", color: "#ffffff", whiteSpace: "nowrap" };
const L2: React.CSSProperties = { marginTop: 4, color: "#d2d4d8", fontWeight: 500 };
const L3: React.CSSProperties = { marginTop: 4, color: "#a2a5ac" };

/* Leader length in px, shorter on a phone stage. */
const leader = (w: number) => (w < 600 ? { dx: 26, dy: 34 } : { dx: 38, dy: 50 });

export function Pins({ fit, headline, line2, line3, visible = true }: PinsProps) {
  const fl = fit.corners.find((c) => c.name === "FL");
  const anchor = useMemo(() => new Vector3(), []);
  const card = useRef<HTMLDivElement>(null);
  const line = useRef<SVGSVGElement>(null);
  const last = useRef("");
  const size = useThree((s) => s.size);

  useFrame(({ camera }) => {
    if (!fl || !card.current || !line.current) return;
    anchor.set(fl.x, fl.y, fl.z).project(camera);
    const px = (anchor.x * 0.5 + 0.5) * size.width;
    const flip = anchor.x > 0;
    const { dx, dy } = leader(size.width);
    const room = flip ? px - dx - GAP : size.width - px - dx - GAP;
    const maxW = Math.round(Math.max(MIN_W, Math.min(PIN_MAX_W, room)) / 4) * 4;
    const key = `${flip ? 1 : 0}|${maxW}|${dx}`;
    if (key === last.current) return;
    last.current = key;
    const c = card.current.style, l = line.current;
    c.maxWidth = maxW + "px";
    c.bottom = dy + "px";
    c.left = flip ? "" : dx + "px";
    c.right = flip ? dx + "px" : "";
    l.setAttribute("width", String(dx));
    l.setAttribute("height", String(dy));
    l.style.left = flip ? -dx + "px" : "0px";
    l.style.bottom = "0px";
    const seg = l.firstElementChild as SVGLineElement;
    seg.setAttribute("x1", flip ? String(dx) : "0");
    seg.setAttribute("y1", String(dy));
    seg.setAttribute("x2", flip ? "0" : String(dx));
    seg.setAttribute("y2", "0");
    card.current.parentElement!.dataset.flip = flip ? "1" : "0";
  });

  if (!visible || !fl) return null;
  return (
    <Html position={[fl.x, fl.y, fl.z]} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div className="pin" data-pin="FL" data-flip="0" style={{ position: "relative", width: 0, height: 0 }}>
        <svg ref={line} aria-hidden="true" style={{ position: "absolute", overflow: "visible" }} width={0} height={0}>
          <line stroke="rgba(255,255,255,0.75)" strokeWidth={1.25} />
        </svg>
        <span aria-hidden="true" style={DOT} />
        <div ref={card} className="pin__card" style={CARD}>
          <div className="pin__head" style={HEAD}>{headline}</div>
          {line2 && <div className="pin__line2" style={L2}>{line2}</div>}
          {line3 && <div className="pin__line3" style={L3}>{line3}</div>}
        </div>
      </div>
    </Html>
  );
}
