import {defineConfig} from "vite";
import {resolve} from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../..");

export default defineConfig({
  root: repositoryRoot,
  base: "/",
  build: {
    outDir: resolve(repositoryRoot, "artifacts/performance-standalone-dist"),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: resolve(repositoryRoot, "tests/performance/standalone.html"),
    },
  },
  preview: {host: "127.0.0.1"},
});
