import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const destination = path.join(root, 'artifacts/packages');
const names = ['core', 'react', 'mcp', 'byok', 'webmcp-experimental'];
type Manifest = { name: string; version: string; exports: string | Record<string, string>; dependencies?: Record<string, string>; peerDependencies?: Record<string, string> };
const manifests = await Promise.all(names.map(async name => JSON.parse(await readFile(`packages/${name}/package.json`, 'utf8')) as Manifest));
const versions = Object.fromEntries(manifests.map(manifest => [manifest.name, manifest.version]));
const sources: string[] = [];
for (const name of names) {
  for (const relative of await readdir(`packages/${name}/src`, { recursive: true })) {
    if (/\.(ts|tsx)$/.test(relative) && !/\.(test|spec)\./.test(relative)) sources.push(path.resolve(`packages/${name}/src`, relative));
  }
}
const extension = (text: string) => text.replace(/(from\s*["']|import\s*["']|import\(["'])(\.[^"']+)(["'])/g, (_match, prefix: string, specifier: string, suffix: string) => `${prefix}${/\.(?:js|json|css)$/.test(specifier) ? specifier : specifier.replace(/\.tsx?$/, '') + '.js'}${suffix}`);
const program = ts.createProgram(sources, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX, strict: true, skipLibCheck: true, esModuleInterop: true, declaration: true, emitDeclarationOnly: true, rootDir: path.join(root, 'packages'), outDir: destination });
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => root, getCanonicalFileName: value => value, getNewLine: () => '\n' }));
const emitted: Promise<void>[] = [];
program.emit(undefined, (file, content) => { emitted.push((async () => { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, extension(content)); })()); });
await Promise.all(emitted);
for (const source of sources) {
  const output = path.join(destination, path.relative(path.join(root, 'packages'), source)).replace(/\.tsx?$/, '.js');
  const result = ts.transpileModule(await readFile(source, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, extension(result.outputText));
}
for (const [index, name] of names.entries()) {
  const manifest = manifests[index]!;
  const declared = { ...(typeof manifest.exports === 'string' ? { '.': manifest.exports } : manifest.exports) };
  if (name === 'react') for (const entry of ['metric', 'table', 'filter', 'ranking', 'trend', 'detail', 'comparison']) if (sources.includes(path.join(root, 'packages/react/src', `${entry}.tsx`))) declared[`./${entry}`] = `./src/${entry}.tsx`;
  const exports = Object.fromEntries(Object.entries(declared).map(([key, value]) => [key, value.endsWith('.css') ? value : { types: value.replace(/\.tsx?$/, '.d.ts'), import: value.replace(/\.tsx?$/, '.js') }]));
  for (const value of Object.values(declared)) if (value.endsWith('.css')) await copyFile(path.join(root, 'packages', name, value), path.join(destination, name, value));
  await writeFile(path.join(destination, name, 'package.json'), JSON.stringify({ name: manifest.name, version: manifest.version, private: true, type: 'module', files: ['src'], exports, sideEffects: ['**/*.css'], ...(manifest.dependencies ? { dependencies: Object.fromEntries(Object.entries(manifest.dependencies).map(([dependency, version]) => [dependency, version.startsWith('workspace:') ? versions[dependency] : version])) } : {}), ...(manifest.peerDependencies ? { peerDependencies: manifest.peerDependencies } : {}) }, null, 2) + '\n');
}
console.log(`Built ${names.length} local-only ESM/declaration packages in ${destination}; publication and OSS licensing remain unapproved.`);
