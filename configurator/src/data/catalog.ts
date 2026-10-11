import raw from "./catalog.json";
export type { Catalog, Vehicle, VehicleModel, Brand, WheelModel, TireBrand, TireModel } from "./types";
import type { Catalog } from "./types";
export function loadCatalog(): Catalog { return raw as unknown as Catalog; }
