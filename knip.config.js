import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(repositoryRoot, 'packages');

function exportTargets(value, targets = []) {
  if (typeof value === 'string') {
    if (value.startsWith('./dist/')) targets.push(value);
    return targets;
  }
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) exportTargets(item, targets);
  }
  return targets;
}

function sourceEntry(target, packageDirectory) {
  const declaration = target.endsWith('.d.ts');
  const javascript = target.endsWith('.js');
  if (!declaration && !javascript) return undefined;

  const stem = target.slice('./dist/'.length, declaration ? -'.d.ts'.length : -'.js'.length);
  const candidates = ['.ts', '.tsx', '.mts', '.js', '.mjs'].map((extension) => `src/${stem}${extension}`);
  const source = candidates.find((candidate) => existsSync(join(packageDirectory, candidate)));
  if (source === undefined) throw new Error(`Public export ${target} has no source file in ${packageDirectory}.`);
  return source;
}

function packageWorkspace(directoryName) {
  const directory = join(packageRoot, directoryName);
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  const targets = exportTargets(manifest.exports);
  const entry = [...new Set(targets.map((target) => sourceEntry(target, directory)).filter(Boolean))];
  return [relative(repositoryRoot, directory), { entry, project: ['src/**/*.{ts,tsx,js,mjs}'] }];
}

const packageWorkspaces = Object.fromEntries(
  readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(packageRoot, entry.name, 'package.json')))
    .map((entry) => packageWorkspace(entry.name)),
);

const examplesRoot = join(repositoryRoot, 'examples');
const exampleWorkspaces = Object.fromEntries(
  readdirSync(examplesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(examplesRoot, entry.name, 'package.json')))
    .map((entry) => [
      `examples/${entry.name}`,
      {
        entry: ['src/main.ts', 'src/index.ts', 'verify.mjs'],
        project: ['src/**/*.{ts,tsx,mjs}', 'app/**/*.{ts,tsx}', '*.mjs'],
      },
    ]),
);

export default {
  treatConfigHintsAsErrors: false,
  ignoreBinaries: ['go', 'build'],
  ignoreFiles: [
    '**/dist/**',
    '**/artifacts/**',
    '**/*.generated.*',
    'packages/core/schemas/**',
    '**/fixtures/**',
    '**/*.fixture.*',
    'examples/catalog/fixture.ts',
  ],
  ignoreIssues: {
    'tests/**/fixtures/**': ['exports', 'types'],
    'tests/**/fixtures.{ts,tsx,js,mjs}': ['exports', 'types'],
    'tests/**/fixture.{ts,tsx,js,mjs}': ['exports', 'types'],
    'tests/**/*-fixture.{ts,tsx,js,mjs}': ['exports', 'types'],
    'tests/**/*fixture.{ts,tsx,js,mjs}': ['exports', 'types'],
    'fixtures/**/*.ts': ['exports', 'types'],
  },
  workspaces: {
    '.': {
      entry: [
        'scripts/source-digest.mjs',
        'examples/framework-recipes.ts',
        'examples/quickstart.mjs',
        'tests/**/browser.ts',
        'tests/vertical-slice/web/app-lifecycle.ts',
        'tests/**/semantic-browser.ts',
        'tests/**/cartesian-browser.ts',
        'tests/**/temporal-browser.ts',
        'tests/**/negative-types.ts',
        'tests/**/vitest.config.mjs',
        'tests/**/playwright.config.mjs',
        'tests/**/*.playwright.config.mjs',
        'tests/**/vite.config.mjs',
        'tests/**/*.vite.config.mjs',
        'tests/**/server.mjs',
        'tests/**/*-child.mjs',
        'tests/agent-evaluation/run.mjs',
        'tests/agent-evaluation/runner.ts',
        'tests/agent-evaluation/ui-development/host.ts',
        'tests/performance/adverse-visualization.ts',
        'tests/performance/perceived-input.ts',
        'tests/performance/standalone.ts',
        'tests/protocol-webmcp/native-probe.mjs',
        'tests/security/testkit-consumer.mjs',
        'tests/visual/catalog.ts',
        'tests/consumers/public-package-notices.mjs',
        'tests/**/*.spec.{ts,tsx,js,mjs}',
        'tests/**/*.test.{ts,tsx,js,mjs}',
      ],
      project: [
        'scripts/**/*.{mjs,js,ts}',
        'tests/**/*.{ts,tsx,mjs}',
        'docs/public-site/**/*.mjs',
        'examples/framework-recipes.ts',
        'examples/quickstart.mjs',
      ],
    },
    ...packageWorkspaces,
    ...exampleWorkspaces,
    'apps/site': {
      entry: [
        'generate-pages.mjs',
        'runner/server.mjs',
        'runner/mcp-stdio.mjs',
        'src/site.ts',
        'src/playground/playground.ts',
        'tests/**/*.spec.{ts,tsx,js,mjs}',
        'tests/**/*.test.{ts,tsx,js,mjs}',
        'tests/**/*.playwright.config.mjs',
        'tests/**/vitest.config.mjs',
      ],
      project: [
        'generate-pages.mjs',
        'runner/**/*.{mjs,js}',
        'src/**/*.{ts,tsx}',
        'tests/**/*.{ts,tsx,mjs}',
        'vite.config.mjs',
      ],
    },
    'examples/catalog': {
      entry: ['index.ts'],
      project: ['**/*.ts'],
    },
    'examples/platform': {
      entry: ['src/main.ts', 'src/design.ts', 'src/react.tsx', 'src/vue.ts', 'src/hydrate.ts'],
      project: ['src/**/*.{ts,tsx}', '*.mjs'],
    },
    'examples/quickstart': {
      entry: ['src/app.ts'],
      project: ['src/**/*.ts', '*.mjs'],
    },
    'examples/vertical-slice': {
      entry: ['src/main.ts', 'src/ssr.ts', 'src/ssr-client.ts'],
      project: ['src/**/*.{ts,tsx,mjs}', '*.mjs'],
    },
    'examples/next-platform': {
      entry: ['app/page.tsx', 'app/adaptive-people.tsx', 'app/hydrate.tsx'],
      project: ['app/**/*.{ts,tsx}', '*.mjs'],
    },
  },
};
