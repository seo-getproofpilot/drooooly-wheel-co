/* The one line between App and the export hook that the production bundle
   carries: App registers a function that swaps the build in place, and the
   lazily loaded export hook (dev/exportScene.ts) calls it, so the render
   service's warm page changes paint, wheels and body without a reload.

   The setter returns the build it applied, encoded the way the page encodes
   it, and the hook waits until the stage has committed that exact build. */

let setter: ((query: string) => string) | null = null;

/** App's side. Returns the unregister. */
export function registerBuildSetter(fn: (query: string) => string): () => void {
  setter = fn;
  return () => { if (setter === fn) setter = null; };
}

/** The hook's side: applies a share query string, returns the encoded build it became. */
export function applyBuild(query: string): string {
  if (!setter) throw new Error("setBuild: the page has no build setter");
  return setter(query);
}

/* The build the stage last committed, written by the export hook from inside
   the Canvas (its effect runs only once the body and wheels for that build
   have loaded and committed, since the hook sits next to them under the same
   Suspense boundary). */
let committed = "";
export function markCommitted(build: string) { committed = build; }
export function committedBuild() { return committed; }
