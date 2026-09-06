import { performance } from "node:perf_hooks";
import {
  createWorkspace,
  type WorkspaceNode,
} from "../packages/core/src/index";
import { dataPort } from "../apps/playground/src/data";
const nodes: WorkspaceNode[] = Array.from({ length: 50 }, (_, i) => ({
  id: `metric-${i}`,
  component: "Metric",
  datasetId: "models",
  metric: "outputPrice",
}));
const store = createWorkspace({ dataPort, nodes });
let targeted = 0,
  unrelated = 0;
const cleanup = [
  store.subscribeNode("metric-0", () => targeted++),
  ...nodes
    .slice(1)
    .map((node) => store.subscribeNode(node.id, () => unrelated++)),
];
const timings: number[] = [];
for (let i = 0; i < 1100; i++) {
  const start = performance.now();
  const result = store.apply({
    version: 1,
    baseRevision: store.getState().revision,
    operations: [
      { type: "configure", id: "metric-0", patch: { title: `Volume ${i}` } },
    ],
  });
  if (!result.ok) throw new Error(result.error);
  if (i >= 100) timings.push(performance.now() - start);
}
cleanup.forEach((stop) => stop());
timings.sort((a, b) => a - b);
if (unrelated !== 0 || targeted !== 1100)
  throw new Error("Subscription isolation failed");
console.log(
  JSON.stringify(
    {
      environment: "Node core operation benchmark; not browser rendering",
      nodes: 50,
      measuredPatches: 1000,
      warmupPatches: 100,
      p50Ms: timings[500],
      p95Ms: timings[950],
      maxMs: timings.at(-1),
      targetedNotifications: targeted,
      unrelatedNotifications: unrelated,
    },
    null,
    2,
  ),
);
