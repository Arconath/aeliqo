import { Profiler, useLayoutEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  compareMetricRecords,
  defineDataset,
  filterRecords,
  type DataRecord,
  type DataSnapshot,
} from "@aeliqo/core";
import { Table } from "@aeliqo/react/table";
import { Trend } from "@aeliqo/react/trend";
import "@aeliqo/react/styles.css";

const preparationStarted = performance.now();
const dimensions = Array.from({ length: 19 }, (_, index) => ({
  key: `field${index}`,
  label: `Field ${index}`,
}));
const tableDataset = defineDataset({
  id: "artifact-table",
  entity: "Service observation",
  label: "100k service observations",
  identity: "id",
  labelField: "field0",
  dimensions,
  metrics: [{ key: "score", label: "Score", aggregation: "mean" }],
  timeFields: [],
});
const tableRecords: readonly DataRecord[] = Array.from(
  { length: 100_000 },
  (_, row) =>
    Object.fromEntries([
      ["id", `row-${row}`],
      ...dimensions.map((field, column) => [
        field.key,
        column === 0 ? `Service ${row}` : (row + column) % 10_000,
      ]),
      ["score", row % 100],
    ]),
);
const queryStarted = performance.now();
const queriedRecords = [
  ...filterRecords(
    tableRecords,
    [{ field: "score", operator: "gte", value: 0 }],
    tableDataset,
  ),
].sort((left, right) =>
  compareMetricRecords(left, right, tableDataset.metrics[0]!, "desc"),
);
const dataQueryMs = performance.now() - queryStarted;
if (queriedRecords.length !== 100_000 || queriedRecords[0]?.score !== 99)
  throw new Error("The artifact scale query changed semantics");
const tableSnapshot: DataSnapshot = { status: "ready", records: queriedRecords };

const trendDataset = defineDataset({
  id: "artifact-trend",
  entity: "Daily observation",
  label: "50k daily observations",
  identity: "id",
  labelField: "id",
  dimensions: [{ key: "id", label: "ID" }],
  metrics: [{ key: "value", label: "Value", aggregation: "mean" }],
  timeFields: [{ key: "time", label: "Time", temporal: "instant" }],
});
const trendRecords: readonly DataRecord[] = Array.from(
  { length: 50_000 },
  (_, index) => ({
    id: String(index),
    time: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString(),
    value:
      index === 12_345
        ? -999
        : index === 40_000
          ? 999
          : index % 997 === 0
            ? null
            : index % 101,
  }),
);
const trendSnapshot: DataSnapshot = { status: "ready", records: trendRecords };
const dataPreparationMs = performance.now() - preparationStarted;

const container = document.getElementById("root")!;
const root = createRoot(container);
let sequence = 0;

function afterObservableUpdate(callback: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

function ObservableCommit({ children, onCommit }: { children: ReactNode; onCommit: () => void }) {
  useLayoutEffect(() => afterObservableUpdate(onCommit));
  return children;
}

async function render(kind: "table" | "trend") {
  const started = performance.now();
  let reactActualDuration: number | null = null;
  await new Promise<void>((resolve) => {
    sequence += 1;
    root.render(
      <main className="aeliqo-theme" data-aeliqo-theme="artifact-scale">
        <Profiler
          id={kind}
          onRender={(_id, _phase, actualDuration) => {
            reactActualDuration = (reactActualDuration ?? 0) + actualDuration;
          }}
        >
          <ObservableCommit key={`${kind}-${sequence}`} onCommit={resolve}>
            {kind === "table" ? (
              <Table
                dataset={tableDataset}
                snapshot={tableSnapshot}
                columns={[...dimensions.map((field) => field.key), "score"]}
                title="Artifact 100k table"
                onSelect={() => undefined}
              />
            ) : (
              <Trend
                dataset={trendDataset}
                snapshot={trendSnapshot}
                metric="value"
                timeField="time"
                title="Artifact 50k trend"
              />
            )}
          </ObservableCommit>
        </Profiler>
      </main>,
    );
  });
  return {
    observableMs: performance.now() - started,
    reactActualDurationMs: reactActualDuration,
    elements: container.querySelectorAll("*").length,
    renderedRows: container.querySelectorAll("tbody tr").length,
    columns: container.querySelectorAll("th").length,
    paths: container.querySelectorAll("path.aeliqo-trend-line").length,
    circles: container.querySelectorAll("circle").length,
    disclosure:
      container.querySelector(".aeliqo-hint[role='status']")?.textContent ?? null,
    summary:
      [...container.querySelectorAll(".aeliqo-sr-only")]
        .map((element) => element.textContent)
        .find((text) => text?.includes("Exact summary")) ?? null,
  };
}

async function clear() {
  root.render(null);
  await new Promise<void>((resolve) => afterObservableUpdate(resolve));
  return container.querySelectorAll("*").length;
}

declare global {
  interface Window {
    __AELIQO_ARTIFACT_SCALE__: {
      dataPreparationMs: number;
      dataQueryMs: number;
      render: typeof render;
      clear: typeof clear;
    };
  }
}

window.__AELIQO_ARTIFACT_SCALE__ = {
  dataPreparationMs,
  dataQueryMs,
  render,
  clear,
};
container.textContent = "Tarball artifact scale fixture ready";
