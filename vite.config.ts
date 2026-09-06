import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

function bundleEvidence(): Plugin {
  return {
    name: "aeliqo-bundle-evidence",
    generateBundle(_options, bundle) {
      const modules = Object.values(bundle).flatMap((chunk) =>
        chunk.type === "chunk" ? Object.keys(chunk.modules) : [],
      );
      if (
        modules.some(
          (id) =>
            id.includes("@modelcontextprotocol/sdk") || id.includes("packages/byok/") || id.includes("apps/companion/") ||
            /packages\/mcp\/src\/(server|bridge|cli)\./.test(id),
        )
      )
        throw new Error("Node MCP server code entered browser bundle");
      const dependencies = [
        ...new Set(
          modules.flatMap((id) => {
            const match = id.match(
              /node_modules\/(d3-[^/]+|react-dom|react|zod)\//,
            );
            return match ? [match[1]] : [];
          }),
        ),
      ].sort();
      this.emitFile({
        type: "asset",
        fileName: "bundle-report.json",
        source: JSON.stringify(
          {
            browserDependencies: dependencies,
            mcpServerIncluded: false,
            chunks: Object.values(bundle)
              .filter((chunk) => chunk.type === "chunk")
              .map((chunk) => ({
                file: chunk.fileName,
                entry: chunk.isEntry,
                dynamicEntry: chunk.isDynamicEntry,
              })),
          },
          null,
          2,
        ),
      });
    },
  };
}
export default defineConfig({
  root: "apps/playground",
  plugins: [react(), bundleEvidence()],
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "apps/playground/index.html"),
        performance: resolve(import.meta.dirname, "apps/playground/performance.html"),
      },
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
