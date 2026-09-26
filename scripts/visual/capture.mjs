import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execute } from './process.mjs';

export function selection() {
  return {
    project: process.env.AELIQO_VISUAL_PROJECT ?? null,
    batch: process.env.AELIQO_VISUAL_BATCH ?? null,
    grep: process.env.AELIQO_VISUAL_GREP ?? null,
  };
}

export async function capture(root, destination, project) {
  await mkdir(destination, { recursive: true });
  const args = ['exec', 'playwright', 'test', '--config', 'tests/visual/regression.capture.playwright.config.mjs'];
  if (project) args.push('--project', project);
  const selected = selection();
  if (selected.batch) args.push(`tests/visual/${selected.batch}.spec.ts`);
  if (selected.grep) args.push('--grep', selected.grep);
  execute(root, 'pnpm', args, { AELIQO_VISUAL_CAPTURE: destination });
  return destination;
}

export function compare(root, baseline, candidate, destination) {
  execute(
    root,
    'pnpm',
    ['exec', 'playwright', 'test', '--config', 'tests/visual/regression.compare.playwright.config.mjs'],
    {
      AELIQO_VISUAL_BASELINE: baseline,
      AELIQO_VISUAL_CANDIDATE: candidate,
      AELIQO_VISUAL_DIFF: join(destination, 'diff'),
    },
  );
}
