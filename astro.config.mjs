import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

// Static HTML with a small progressive-enhancement script for motion and utilities.
// Only site/ is served in development; sibling research/checkouts stay private.
export default defineConfig({
  root: fileURLToPath(new URL("./site/", import.meta.url)),
  outDir: fileURLToPath(new URL("./dist/", import.meta.url)),
  server: { port: 4321, host: "127.0.0.1" },
  vite: { server: { fs: { strict: true } } },
});
