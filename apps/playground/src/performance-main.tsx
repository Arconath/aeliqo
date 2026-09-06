import React, { useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  compareMetricRecords,
  createWorkspace,
  defineDataset,
  filterRecords,
  type DataRecord,
  type DataSnapshot,
} from "@aeliqo/core";
import { Table, Trend } from "@aeliqo/react";
import "@aeliqo/react/styles.css";

const preparationStart = performance.now();
const tableDimensions = Array.from({ length: 19 }, (_, index) => ({
  key: `field${index}`,
  label: `Field ${index}`,
}));
const tableDataset = defineDataset({
  id: "scale-table",
  entity: "Scale row",
  label: "100k logical rows",
  identity: "id",
  labelField: "field0",
  dimensions: tableDimensions,
  metrics: [{ key: "score", label: "Score", aggregation: "mean" }],
  timeFields: [],
});
const tableRecords: readonly DataRecord[] = Array.from(
  { length: 100_000 },
  (_, row) =>
    Object.fromEntries([
      ["id", `row-${row}`],
      ...tableDimensions.map((field, column) => [
        field.key,
        column === 0 ? `Record ${row}` : (row + column) % 10_000,
      ]),
      ["score", row % 100],
    ]),
);
const tableSnapshot: DataSnapshot = { status: "ready", records: tableRecords };
const queryStart = performance.now();
const queryRecords = [
  ...filterRecords(
    tableRecords,
    [{ field: "score", operator: "gte", value: 0 }],
    tableDataset,
  ),
].sort((left, right) =>
  compareMetricRecords(left, right, tableDataset.metrics[0]!, "desc"),
);
const queryMs = performance.now() - queryStart;
if (queryRecords.length !== 100_000 || queryRecords[0]?.score !== 99)
  throw new Error("Scale query changed semantics");
const tableStore = createWorkspace({
  dataPort: {
    listDatasets: () => [tableDataset],
    getDataset: () => tableDataset,
    getSnapshot: () => tableSnapshot,
    subscribe: () => () => {},
  },
  nodes: [
    {
      id: "scale-table",
      component: "Table",
      datasetId: tableDataset.id,
      columns: [...tableDimensions.map((field) => field.key), "score"],
      filters: [{ field: "score", operator: "gte", value: 0 }],
      metric: "score",
      direction: "desc",
      density: "compact",
      height: 420,
    },
  ],
});

const trendDataset = defineDataset({
  id: "scale-trend",
  entity: "Observation",
  label: "50k raw observations",
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
const preparationMs = performance.now() - preparationStart;

function afterPaint(callback: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

function Commit({ children, onCommit }: { children: React.ReactNode; onCommit: () => void }) {
  useLayoutEffect(() => afterPaint(onCommit));
  return children;
}

const container = document.getElementById("root")!;
const root = createRoot(container);
let cycle = 0;

async function renderScale(kind: "table" | "trend") {
  const started = performance.now();
  await new Promise<void>((resolve) => {
    cycle += 1;
    root.render(
      <main className="aeliqo-theme" data-aeliqo-theme="light">
        <Commit key={`${kind}-${cycle}`} onCommit={resolve}>
          {kind === "table" ? (
            <Table store={tableStore} node={tableStore.getNode("scale-table")!} />
          ) : (
            <Trend
              dataset={trendDataset}
              snapshot={trendSnapshot}
              metric="value"
              timeField="time"
              title="50k-point trend"
            />
          )}
        </Commit>
      </main>,
    );
  });
  return {
    observableMs: performance.now() - started,
    elements: container.querySelectorAll("*").length,
    renderedRows: container.querySelectorAll("tbody tr").length,
    paths: container.querySelectorAll("path.aeliqo-trend-line").length,
    circles: container.querySelectorAll("circle").length,
    disclosure:
      container.querySelector(".aeliqo-hint[role='status']")?.textContent ?? null,
  };
}

async function unmountScale() {
  root.render(null);
  await new Promise<void>((resolve) => afterPaint(resolve));
  return container.querySelectorAll("*").length;
}

declare global {
  interface Window {
    __AELIQO_SCALE__: {
      preparationMs: number;
      queryMs: number;
      render: typeof renderScale;
      unmount: typeof unmountScale;
    };
  }
}

window.__AELIQO_SCALE__ = { preparationMs, queryMs, render: renderScale, unmount: unmountScale };
container.textContent = "Scale fixture ready";
