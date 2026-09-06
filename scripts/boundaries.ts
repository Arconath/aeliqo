import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const rules: Record<string, readonly string[]> = {
  core: ["zod", "zod-to-json-schema"],
  byok: ["@aeliqo/core", "zod"],
  "webmcp-experimental": ["@aeliqo/core"],
  react: ["@aeliqo/core", "react", "d3-scale", "d3-shape"],
  mcp: ["@aeliqo/core", "@modelcontextprotocol/sdk", "zod", "ws"],
};
for (const [pkg, allowed] of Object.entries(rules)) {
  const directory = `packages/${pkg}/src`;
  for (const file of readdirSync(directory).filter(
    (name) => /\.tsx?$/.test(name) && !name.includes(".test."),
  )) {
    const source = readFileSync(join(directory, file), "utf8");
    for (const match of source.matchAll(
      /(?:from\s*|import\s*)["']([^"']+)["']/g,
    )) {
      const name = match[1]!;
      if (
        name.startsWith(".") ||
        (["mcp", "byok"].includes(pkg) && name.startsWith("node:"))
      )
        continue;
      if (
        !allowed.some(
          (dependency) =>
            name === dependency || name.startsWith(`${dependency}/`),
        )
      )
        throw new Error(`${pkg}/${file}: forbidden dependency ${name}`);
    }
  }
  console.log(`${pkg}: dependency boundary verified`);
}
