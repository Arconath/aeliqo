/**
 * Node-side production-package workload probe.
 *
 * Run after building core/runtime/web. Timing is opt-in because concurrent
 * builds make a noisy baseline. The JSON report keeps cold/warm raw samples
 * and the environment beside the derived p50/p95 values.
 */
import {mkdir, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {coldWarm, environmentSnapshot, runMediumPlanner, runTargetedReducer} from './workloads.mjs';

const root = resolve(import.meta.dirname, '../..');
const timingEnabled = process.env.AELIQO_RUN_PERFORMANCE === '1';
const sourceCommit = (() => {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(); } catch { return 'unknown'; }
})();

const medium = timingEnabled
  ? await coldWarm('medium-planner', async () => { runMediumPlanner(); }, {coldCount: 2, warmCount: 5})
  : {label: 'medium-planner', skipped: true};
const reducer = timingEnabled
  ? await coldWarm('targeted-reducer', async () => { await runTargetedReducer(100); }, {coldCount: 2, warmCount: 5})
  : {label: 'targeted-reducer', skipped: true};
const functionalMedium = runMediumPlanner();
const functionalReducer = await runTargetedReducer(100);
const report = {
  sourceCommit,
  timingEnabled,
  environment: environmentSnapshot(),
  workloads: {
    medium: {functional: functionalMedium, observations: medium, budgetMsP95: 16},
    targetedReducer: {functional: {...functionalReducer, rawMs: undefined}, observations: reducer, budgetMsP95: 4},
  },
  notes: [
    'Node probe exercises production package exports after the package builds.',
    'Browser standalone controls, DOM geometry, layout/paint trace and 100 mount/dispose cycles are in browser.spec.ts.',
    'A skipped timing section is not a pass; run with AELIQO_RUN_PERFORMANCE=1 on an isolated runner for measurements.',
  ],
};
const outputDirectory = process.env.AELIQO_PERFORMANCE_OUTPUT ?? join(root, 'artifacts/performance-workloads');
await mkdir(outputDirectory, {recursive: true});
const output = join(outputDirectory, `runtime-${Date.now()}.json`);
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({output, sourceCommit, timingEnabled, medium: functionalMedium, reducer: {
  iterations: functionalReducer.iterations, successful: functionalReducer.successful, unrelatedRoutes: functionalReducer.unrelatedRoutes,
  p50Ms: functionalReducer.p50Ms, p95Ms: functionalReducer.p95Ms,
}}, null, 2));
