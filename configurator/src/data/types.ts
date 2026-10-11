/* Shapes of configurator/src/data/catalog.json, written by tools/export-catalog.js
   from the site's own data files. */
export interface VehicleModel { file: string; wheelbaseIn: number; trackIn: number; stockTireOdIn: number; stockWheelDiaIn: number; cab: string; }
export interface Vehicle { id: string; make: string; models: string[]; years: [number, number]; config: "srw" | "drw"; hd: boolean; bolt: string; stockOffsetMm: number; stockWidthIn?: number; fenderRadiusIn: number; faceToFenderIn: number; measured: boolean; model?: VehicleModel; }
export interface WheelModel { model: string; configs: string[]; sizes: string[]; finishes: string[]; img?: string | null; }
export interface Brand { slug: string; name: string; kind: string; bolts: string[]; pricing?: string | null; models: WheelModel[]; }
export interface TireModel { model: string; tread: string; sizes: string[]; img?: string | null; priceFrom?: number | null; }
export interface TireBrand { slug: string; name: string; models: TireModel[]; }
export interface Catalog { generated: string; vehicles: Vehicle[]; paints: { name: string; hex: string }[]; brands: Brand[]; tires: TireBrand[]; offsets: any; f450: any; finishes: any; }
