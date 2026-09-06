import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, mkdtemp, realpath } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'vite';

const root = process.cwd();
const artifacts = path.join(root, 'artifacts/packages');
const packed = path.join(root, 'artifacts/tarballs');
await mkdir(packed, { recursive: true });
const dependencies: Record<string, string> = {};
const contents: Record<string, string[]> = {};
const overrides: Record<string, string> = {};
for (const name of ['core', 'react', 'mcp', 'byok', 'webmcp-experimental']) {
  const result = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', packed], { cwd: path.join(artifacts, name), encoding: 'utf8' })) as { name: string; filename: string; files: { path: string }[] }[];
  const pack = result[0]!;
  dependencies[pack.name] = `file:${path.join(packed, pack.filename)}`;
  contents[pack.name] = pack.files.map(file => file.path);
  const manifest = JSON.parse(await readFile(path.join(artifacts, name, 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> };
  for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })) if (!dependency.startsWith('@aeliqo/')) overrides[dependency] = `link:${await realpath(path.join(root, 'packages', name, 'node_modules', dependency))}`;
  if (contents[pack.name]!.some(file => !/^(package.json|src\/.*\.(js|d\.ts|css))$/.test(file) || /\.(test|spec)\./.test(file))) throw new Error(`Unintended package contents: ${pack.name}`);
}
const consumer = await mkdtemp(path.join(tmpdir(), 'aeliqo-consumer-'));
const packageManager = (JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as { packageManager: string }).packageManager;
await writeFile(path.join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module', packageManager, dependencies: { ...dependencies, react: overrides.react, 'react-dom': overrides['react-dom'], '@types/react': `link:${await realpath(path.join(root, 'node_modules/@types/react'))}`, '@types/react-dom': `link:${await realpath(path.join(root, 'node_modules/@types/react-dom'))}` } }));
await writeFile(path.join(consumer, 'pnpm-workspace.yaml'), JSON.stringify({ packages: ['.'], overrides: { ...overrides, ...dependencies } }));
execFileSync('pnpm', ['install', '--offline', '--ignore-scripts'], { cwd: consumer, stdio: 'inherit' });
const fixture = await readFile(path.join(root, 'tests/packaging/consumer.tsx'), 'utf8');
await writeFile(path.join(consumer, 'consumer.tsx'), fixture);
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', '--jsx', 'react-jsx', '--typeRoots', path.join(root, 'node_modules/@types'), path.join(consumer, 'consumer.tsx')], { cwd: consumer, stdio: 'inherit' });
const imported = execFileSync(process.execPath, ['--input-type=module', '-e', "import { createElement } from 'react'; import { renderToString } from 'react-dom/server'; import { Metric } from '@aeliqo/react/metric'; import { defineDataset } from '@aeliqo/core'; for(const entry of ['@aeliqo/react','@aeliqo/react/table','@aeliqo/mcp','@aeliqo/mcp/browser','@aeliqo/byok','@aeliqo/byok/openai','@aeliqo/webmcp-experimental']) await import(entry); const html=renderToString(createElement(Metric,{value:42,label:'Active records'})); if(!html.includes('42')||typeof defineDataset!=='function') throw Error('SSR/import failure'); console.log(html);"], { cwd: consumer, encoding: 'utf8' });
const modules: string[] = [];
const foundationSsr = execFileSync(process.execPath, ['--input-type=module', '-e', `
import { createElement } from 'react'; import { renderToString } from 'react-dom/server';
const dataset = {id:'fixture',entity:'Record',label:'Fixture',identity:'id',labelField:'name',dimensions:[{key:'name',label:'Name'}],metrics:[{key:'value',label:'Value',aggregation:'sum'}],timeFields:[{key:'month',label:'Month',temporal:'month'}]};
const snapshot = {status:'ready',records:[{id:'a',name:'First',value:1,month:'2026-01'},{id:'b',name:'Second',value:2,month:'2026-02'}]};
for (const name of ['Metric','Table','Filter','Ranking','Trend','Detail','Comparison','Delta','RecordList','SelectionSummary','Overview']) {
 const entry=name.replace(/[A-Z]/g,(letter,index)=>(index?'-':'')+letter.toLowerCase());
 const module=await import('@aeliqo/react/'+entry);
 const props=name==='Metric'?{value:42,label:'Example'}:name==='Delta'?{value:2,baseline:1,label:'Change',baselineLabel:'Prior'}:{dataset,snapshot,metric:'value',metrics:['value'],selectedIds:['a','b'],timeField:'month',selectedId:'a',filters:[],onChange:()=>{}};
 const html=renderToString(createElement(module[name],props)); if(!html.length)throw Error(name+' SSR failed'); console.log(name+': '+html.length+' HTML bytes');
}`], { cwd: consumer, encoding: 'utf8' });
const retainedExports: string[] = [];
let bundleBytes = 0;
await build({ configFile: false, root: consumer, logLevel: 'warn', plugins: [{ name: 'consumer-evidence', generateBundle(_options, bundle) { for (const output of Object.values(bundle)) if (output.type === 'chunk') { bundleBytes += Buffer.byteLength(output.code); for (const [name, module] of Object.entries(output.modules)) if (module.renderedLength > 0) { modules.push(name); retainedExports.push(...module.renderedExports); } } } }], build: { outDir: path.join(consumer, 'dist'), lib: { entry: path.join(consumer, 'consumer.tsx'), formats: ['es'], fileName: 'consumer' }, rollupOptions: { external: ['react', 'react/jsx-runtime', 'react-dom/server'] }, minify: true } });
const unwanted = [...modules.filter(module => /(?:d3-|\/mcp\/|\/byok\/|modelcontextprotocol|\/workspace\.)/.test(module)), ...retainedExports.filter(name => ['Workspace', 'createWorkspace', 'createAeliqoServer', 'createOpenAIProvider'].includes(name))];
const report = { consumer, contents, ssr: imported.trim(), foundationSsr: foundationSsr.trim(), moduleCount: modules.length, bundleBytes, modules, retainedExports, unwanted, license: 'Unselected: private local artifacts only', scope: 'Real tarball installation with existing third-party dependencies linked offline. Node ESM import, NodeNext types, React SSR of eleven direct components, Vite standalone Metric consumer graph. Not a Next.js framework build or fresh registry install.' };
await writeFile(path.join(root, 'artifacts/package-evidence.json'), JSON.stringify(report, null, 2));
if (unwanted.length) throw new Error(`Standalone import isolation failed: ${unwanted.join(', ')}`);
console.log(JSON.stringify(report, null, 2));
