/* Types for the storefront's fitment.js, imported as-is through the
   droooly-site-scripts shim in vite.config.ts. */
declare module "@site/fitment.js" {
  export interface Geometry { offsetIn: number; outerFromFace: number; innerFromFace: number; backspacing: number; poke: number; sidewall: number; fenderRadius: number; archGap: number; isDually: boolean }
  export interface OffsetEntry { min?: number | null; max?: number | null; typical?: number | null; src?: string }
  const Fitment: {
    MM_PER_IN: number;
    DUALLY_REAR_WIDTH: number;
    DUAL_MAX_SECTION: number;
    parseSize(s: string): { d: number; w: number | null; widthKnown: boolean } | null;
    parseTireSize(s: string): { od: number; section: number; rim: number } | null;
    offsetFor(offsets: any, role: string, dia: number, width: number): OffsetEntry | null;
    offsetRole(width: number, seriesKey: string): string;
    tiresFor(tires: any, diaIn: number, mode?: string): { size: string; od: number; section: number; rim: number; fitments: string[] }[];
    geometry(cfg: { widthIn: number; offsetMm: number; tireOdIn: number; wheelDiaIn: number; lift?: number; vehicle?: any }): Geometry;
    stance(g: Geometry): { key: string; label: string };
    pokeText(g: Geometry, measured: boolean): string;
  };
  export default Fitment;
}
