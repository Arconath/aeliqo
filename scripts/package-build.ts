import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const destination = path.join(root, "artifacts/packages");
const publicRelease = process.env.AELIQO_PUBLIC_RELEASE === "1";
const publicPackageDirectories = [
  "core",
  "react",
  "mcp",
  "byok",
  "webmcp-experimental",
] as const;

type Repository = { type: string; url: string; directory?: string };
type Manifest = {
  name: string;
  version: string;
  private: boolean;
  license?: string;
  description: string;
  keywords: string[];
  homepage: string;
  repository: Repository;
  bugs: { url: string };
  engines: Record<string, string>;
  exports: string | Record<string, string>;
  bin?: Record<string, string>;
  sideEffects?: false | string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const manifests = await Promise.all(
  publicPackageDirectories.map(
    async (directory) =>
      JSON.parse(
        await readFile(`packages/${directory}/package.json`, "utf8"),
      ) as Manifest,
  ),
);
const versions = Object.fromEntries(
  manifests.map((manifest) => [manifest.name, manifest.version]),
);
const licenseText = await readFile(path.join(root, "LICENSE"), "utf8");
const noticeText = await readFile(path.join(root, "NOTICE"), "utf8");
if (
  !licenseText.includes("Apache License") ||
  !licenseText.includes("Version 2.0")
)
  throw new Error("The approved Apache-2.0 LICENSE is missing or malformed");
if (!noticeText.includes("Aeliqo contributors"))
  throw new Error("The Aeliqo NOTICE attribution is missing or malformed");
for (const manifest of manifests) {
  if (manifest.private !== true)
    throw new Error(
      `${manifest.name} source manifest must stay private; only the explicit release build may remove the guard`,
    );
  if (manifest.license !== "Apache-2.0")
    throw new Error(
      `${manifest.name} must declare the owner-approved Apache-2.0 license`,
    );
}
const approvedLicense = "Apache-2.0";
const packageGuides: Record<string, string> = {
  "@aeliqo/core": `Install with \`npm install @aeliqo/core\`. Define application-owned datasets with \`defineDataset\`, expose them through a \`DataPort\`, and create a workspace with \`createWorkspace\`. The core has no React, browser, provider, or Node runtime dependency.`,
  "@aeliqo/react": `Install with \`npm install @aeliqo/core @aeliqo/react react react-dom\`, then import \`@aeliqo/react/styles.css\`. Components support direct props, semantic store/node bindings, and the same renderer inside \`Workspace\`. React 18.3 and React 19 are tested.`,
  "@aeliqo/mcp": `Install with \`npm install @aeliqo/core @aeliqo/mcp\` or let an MCP client launch it with \`npx --yes @aeliqo/mcp\`.

For Codex, create one explicit process per workspace:

\`\`\`sh
codex mcp add aeliqo-operations --env AELIQO_WORKSPACE_ID=operations --env AELIQO_RENDERER_ID=operations-main -- npx --yes @aeliqo/mcp
\`\`\`

The process prints a pairing URL. Open it in the intended Aeliqo workspace and verify the displayed workspace, renderer, and connection state before allowing mutations. Treat the fragment credential as a local secret: keep it out of logs and screenshots. Stop or revoke the process to invalidate it. One companion controls one explicitly paired workspace; it never selects the most recently connected tab.`,
  "@aeliqo/byok": `Install on a trusted backend with \`npm install @aeliqo/core @aeliqo/byok\`. Provider keys belong only in the backend process environment. \`createOpenAIProvider\` uses the Responses API; \`runAgent\` executes the same bounded Aeliqo capability contracts used by MCP. Do not ship provider keys in browser bundles, localStorage, request JSON, or workspace documents.`,
  "@aeliqo/webmcp-experimental": `Install with \`npm install @aeliqo/core @aeliqo/webmcp-experimental\`. This optional adapter feature-detects the experimental browser host and exposes the same four Aeliqo capabilities. Adapter tests do not imply native support in every browser.`,
};

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

const availableSources = new Set<string>();
for (const directory of publicPackageDirectories) {
  for (const relative of await readdir(`packages/${directory}/src`, {
    recursive: true,
  })) {
    if (/\.(ts|tsx)$/.test(relative) && !/\.(test|spec)\./.test(relative))
      availableSources.add(path.resolve(`packages/${directory}/src`, relative));
  }
}

const resolveRelativeSource = (source: string, specifier: string) => {
  if (!specifier.startsWith(".")) return undefined;
  const base = path.resolve(
    path.dirname(source),
    specifier.replace(/\.js$/, ""),
  );
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ].find((candidate) => availableSources.has(candidate));
};
const reachableSources = new Set<string>();
const visit = async (source: string): Promise<void> => {
  if (reachableSources.has(source)) return;
  assertSource(source);
  reachableSources.add(source);
  const text = await readFile(source, "utf8");
  for (const imported of ts.preProcessFile(text, true, true).importedFiles) {
    const dependency = resolveRelativeSource(source, imported.fileName);
    if (dependency) await visit(dependency);
  }
};
function assertSource(source: string): void {
  if (!availableSources.has(source))
    throw new Error(`Public export points to missing source: ${source}`);
}
for (const [index, directory] of publicPackageDirectories.entries()) {
  const exports = manifests[index]!.exports;
  const entries =
    typeof exports === "string" ? [exports] : Object.values(exports);
  entries.push(...Object.values(manifests[index]!.bin ?? {}));
  for (const entry of entries) {
    if (/\.tsx?$/.test(entry))
      await visit(path.resolve("packages", directory, entry));
  }
}
const sources = [...reachableSources].sort();

const addJavaScriptExtension = (text: string) =>
  text.replace(
    /(from\s*["']|import\s*["']|import\(["'])(\.[^"']+)(["'])/g,
    (_match, prefix: string, specifier: string, suffix: string) =>
      `${prefix}${/\.(?:js|json|css)$/.test(specifier) ? specifier : specifier.replace(/\.tsx?$/, "") + ".js"}${suffix}`,
  );

const program = ts.createProgram(sources, {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  skipLibCheck: true,
  esModuleInterop: true,
  declaration: true,
  emitDeclarationOnly: true,
  rootDir: path.join(root, "packages"),
  outDir: destination,
});
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length)
  throw new Error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => root,
      getCanonicalFileName: (value) => value,
      getNewLine: () => "\n",
    }),
  );
const emitted: Promise<void>[] = [];
program.emit(undefined, (file, content) => {
  emitted.push(
    (async () => {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, addJavaScriptExtension(content));
    })(),
  );
});
await Promise.all(emitted);

for (const source of sources) {
  const output = path
    .join(destination, path.relative(path.join(root, "packages"), source))
    .replace(/\.tsx?$/, ".js");
  const result = ts.transpileModule(await readFile(source, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, addJavaScriptExtension(result.outputText));
}

for (const [index, directory] of publicPackageDirectories.entries()) {
  const manifest = manifests[index]!;
  const declared =
    typeof manifest.exports === "string"
      ? { ".": manifest.exports }
      : manifest.exports;
  const exports = Object.fromEntries(
    Object.entries(declared).map(([key, value]) => [
      key,
      value.endsWith(".css")
        ? value
        : {
            types: value.replace(/\.tsx?$/, ".d.ts"),
            import: value.replace(/\.tsx?$/, ".js"),
          },
    ]),
  );
  for (const value of Object.values(declared)) {
    if (!value.endsWith(".css")) continue;
    const source = path.join(root, "packages", directory, value);
    const target = path.join(destination, directory, value);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  const dependencies = manifest.dependencies
    ? Object.fromEntries(
        Object.entries(manifest.dependencies).map(([dependency, version]) => {
          if (!version.startsWith("workspace:")) return [dependency, version];
          const internalVersion = versions[dependency];
          if (!internalVersion)
            throw new Error(`Unknown internal dependency ${dependency}`);
          return [dependency, internalVersion];
        }),
      )
    : undefined;
  const artifact = {
    name: manifest.name,
    version: manifest.version,
    private: publicRelease ? false : true,
    license: approvedLicense,
    description: manifest.description,
    keywords: manifest.keywords,
    homepage: manifest.homepage,
    repository: manifest.repository,
    bugs: manifest.bugs,
    type: "module",
    files: ["src", "README.md", "LICENSE", "NOTICE"],
    exports,
    ...(manifest.bin
      ? {
          bin: Object.fromEntries(
            Object.entries(manifest.bin).map(([name, value]) => [
              name,
              value.replace(/\.tsx?$/, ".js"),
            ]),
          ),
        }
      : {}),
    sideEffects: manifest.sideEffects ?? false,
    engines: manifest.engines,
    ...(dependencies ? { dependencies } : {}),
    ...(manifest.peerDependencies
      ? { peerDependencies: manifest.peerDependencies }
      : {}),
  };
  const packageRoot = path.join(destination, directory);
  await writeFile(
    path.join(packageRoot, "package.json"),
    JSON.stringify(artifact, null, 2) + "\n",
  );
  await writeFile(
    path.join(packageRoot, "README.md"),
    `# ${manifest.name}\n\n${manifest.description}\n\n${packageGuides[manifest.name] ?? "See the Aeliqo documentation for installation and usage."}\n\nFull documentation: [aeliqo.com/docs](https://aeliqo.com/docs/). Source: [Aeliqo on GitHub](${manifest.homepage}). Licensed under Apache-2.0.\n`,
  );
  await copyFile(path.join(root, "LICENSE"), path.join(packageRoot, "LICENSE"));
  await copyFile(path.join(root, "NOTICE"), path.join(packageRoot, "NOTICE"));
  for (const value of Object.values(manifest.bin ?? {}))
    await chmod(path.join(packageRoot, value.replace(/\.tsx?$/, ".js")), 0o755);
}

console.log(
  publicRelease
    ? `Built ${publicPackageDirectories.length} owner-approved Apache-2.0 public ESM/declaration packages in ${destination}; publication was not performed.`
    : `Built ${publicPackageDirectories.length} clean Apache-2.0 ESM/declaration packages with the private publication guard in ${destination}.`,
);
