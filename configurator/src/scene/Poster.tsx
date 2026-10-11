/* What the customer sees when 3D cannot run: no WebGL, or the context was
   lost (iOS drops it under memory pressure). The steps keep working beside it. */
import type { Vehicle } from "../data/types";
import { copy } from "../ui/copy";

export const posterUrl = (v: Vehicle) => import.meta.env.BASE_URL + "poster/" + v.id + ".jpg";

export function Poster({ vehicle }: { vehicle: Vehicle }) {
  return (
    <figure className="poster">
      <img src={posterUrl(vehicle)} alt={vehicle.make + " " + vehicle.models[0] + " in the DROOOLY visualizer"} width={1200} height={750} />
      <figcaption>{copy.posterCaption}</figcaption>
    </figure>
  );
}
