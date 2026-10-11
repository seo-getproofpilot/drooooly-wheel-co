import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

const SITE = path.resolve(__dirname, "..");

/* The storefront's data and logic files (fitment.js and friends) are classic
   scripts: an IIFE that sets window.X and, under node, module.exports. Vite
   serves them as ES modules, where `module` does not exist, so they would
   import as nothing. This shim gives them a local `module` and re-exports
   what they assign, so `import Fitment from "@site/fitment.js"` gets the same
   object the site and tools/test-fitment.js use, with no fork of the file. */
function siteScripts(): Plugin {
  const files = new Set([path.join(SITE, "fitment.js")]);
  return {
    name: "droooly-site-scripts",
    enforce: "pre",
    transform(code, id) {
      const file = id.split("?")[0];
      if (!files.has(file)) return null;
      return { code: `const module = { exports: {} };\n${code}\nexport default module.exports;\n`, map: null };
    },
  };
}

/* The built app is served from the site root, so /assets/... (logo, wheel
   renders) resolve there. vite dev and preview only serve /visualize/, so this
   hands /assets/* to the repo's assets folder in those two servers. Nothing
   from assets/ is copied into the build. */
function siteAssets(): Plugin {
  const serve = (server: { middlewares: any }) => {
    server.middlewares.use((req: any, res: any, next: any) => {
      const url = (req.url || "").split("?")[0];
      if (!url.startsWith("/assets/")) return next();
      const file = path.join(SITE, decodeURIComponent(url));
      if (!file.startsWith(path.join(SITE, "assets")) || !fs.existsSync(file)) return next();
      const type: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };
      res.setHeader("Content-Type", type[path.extname(file)] || "application/octet-stream");
      fs.createReadStream(file).pipe(res);
    });
  };
  return { name: "droooly-site-assets", configureServer: serve, configurePreviewServer: serve };
}

export default defineConfig({
  plugins: [siteScripts(), siteAssets(), react()],
  base: "/visualize/",
  build: { outDir: path.resolve(__dirname, "../visualize"), emptyOutDir: true },
  resolve: { alias: { "@site": SITE } },
  server: { fs: { allow: [SITE] } },
});
