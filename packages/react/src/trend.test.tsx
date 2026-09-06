// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  createWorkspace,
  defineDataset,
  type DataSnapshot,
} from "@aeliqo/core";
import { Trend } from "./index";

afterEach(cleanup);

function renderTrend(values: (number | null)[], seriesBy?: string) {
  const dataset = defineDataset({
    id: "daily",
    entity: "Observation",
    label: "Daily observations",
    identity: "id",
    labelField: "group",
    dimensions: [{ key: "group", label: "Group" }],
    metrics: [{ key: "value", label: "Value", aggregation: "mean" }],
    timeFields: [{ key: "day", label: "Day" }],
  });
  const snapshot: DataSnapshot = {
    status: "ready",
    records: values.map((value, index) => ({
      id: String(index),
      group: "A",
      day: `2026-01-0${index + 1}`,
      value,
    })),
  };
  const store = createWorkspace({
    dataPort: {
      listDatasets: () => [dataset],
      getDataset: () => dataset,
      getSnapshot: () => snapshot,
      subscribe: () => () => {},
    },
  });
  return render(
    <Trend
      store={store}
      node={{
        id: "trend",
        component: "Trend",
        datasetId: "daily",
        metric: "value",
        timeField: "day",
        seriesBy,
      }}
    />,
  );
}

describe("Trend missing observations", () => {
  it("bounds 50k-point geometry while keeping exact extrema, latest value, and gaps in the accessible summary", () => {
    const dataset = defineDataset({
      id: "scale-trend",
      entity: "Observation",
      label: "Scale observations",
      identity: "id",
      labelField: "id",
      dimensions: [{ key: "id", label: "ID" }],
      metrics: [{ key: "value", label: "Value", aggregation: "mean" }],
      timeFields: [{ key: "time", label: "Time", temporal: "instant" }],
    });
    const records = Array.from({ length: 50_000 }, (_, index) => ({
      id: String(index),
      time: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString(),
      value: index === 12_345 ? -999 : index === 40_000 ? 999 : index % 997 === 0 ? null : index % 101,
    }));
    const view = render(
      <Trend
        dataset={dataset}
        snapshot={{ status: "ready", records }}
        metric="value"
        timeField="time"
      />,
    );
    expect(screen.getByText(/Exact summary for 50000 aggregated points:/).textContent).toContain(
      "minimum -999, maximum 999, latest 4, and 51 missing measurements",
    );
    const disclosure = screen.getByRole("status", { name: "" }).textContent ?? "";
    expect(disclosure).toMatch(/^Visual sample: \d+ of 50000 aggregated points drawn\. Exact summaries use all points\.$/);
    expect(Number(disclosure.match(/\d+/)?.[0])).toBeLessThanOrEqual(800);
    expect(view.container.querySelectorAll("path.aeliqo-trend-line")).toHaveLength(1);
    expect(view.container.querySelector("path.aeliqo-trend-line")?.getAttribute("d")?.length).toBeLessThan(50_000);
    expect(view.container.querySelectorAll("circle").length).toBeLessThanOrEqual(800);
  });

  it("omits a sampled line instead of falsely joining more gaps than the geometry budget can preserve", () => {
    const dataset = defineDataset({
      id: "gap-scale",
      entity: "Observation",
      label: "Gap scale",
      identity: "id",
      labelField: "id",
      dimensions: [{ key: "id", label: "ID" }],
      metrics: [{ key: "value", label: "Value", aggregation: "mean" }],
      timeFields: [{ key: "time", label: "Time", temporal: "instant" }],
    });
    const records = Array.from({ length: 1_000 }, (_, index) => ({
      id: String(index),
      time: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString(),
      value: index % 2 ? index : null,
    }));
    const view = render(<Trend dataset={dataset} snapshot={{ status: "ready", records }} metric="value" timeField="time" />);
    expect(screen.getByText(/Visual line omitted because preserving every data gap/)).toBeTruthy();
    expect(view.container.querySelector("path.aeliqo-trend-line")?.getAttribute("d")).toBe("");
    expect(screen.getByText(/Exact summary for 1000 aggregated points:/).textContent).toContain("500 missing measurements");
  });

  it("normalizes equivalent explicit-offset instants before grouping", () => {
    const dataset = defineDataset({ id: "instants", entity: "Observation", label: "Instants", identity: "id", labelField: "id", dimensions: [{ key: "id", label: "ID" }], metrics: [{ key: "value", label: "Value", aggregation: "sum" }], timeFields: [{ key: "time", label: "Time", temporal: "instant" }] });
    const snapshot: DataSnapshot = { status: "ready", records: [{ id: "a", time: "2026-01-01T00:00:00Z", value: 2 }, { id: "b", time: "2025-12-31T19:00:00-05:00", value: 3 }] };
    const store = createWorkspace({ dataPort: { listDatasets: () => [dataset], getDataset: () => dataset, getSnapshot: () => snapshot, subscribe: () => () => {} } });
    render(<Trend store={store} node={{ id: "trend", component: "Trend", datasetId: dataset.id, metric: "value", timeField: "time" }} />);
    expect(screen.getByText("1 snapshot · no historical trend · Latest: 5")).toBeTruthy();
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("2026-01-01T00:00:00.000Z");
  });
  it("breaks the line at unknown measurements and draws isolated valid points", () => {
    const view = renderTrend([10, null, 20]);
    const path = view.container
      .querySelector(".aeliqo-trend-line")
      ?.getAttribute("d");
    expect(path?.match(/M/g)).toHaveLength(2);
    expect(path).not.toContain("L");
    expect(view.container.querySelectorAll("circle")).toHaveLength(2);
    expect(screen.getByText("3 periods · Latest: 20")).toBeTruthy();
  });

  it("retains missing endpoints in the time domain and latest summary", () => {
    const view = renderTrend([null, 10, null]);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "Value from 2026-01-01 to 2026-01-03",
    );
    expect(view.container.querySelector("circle")?.getAttribute("cx")).toBe(
      "281",
    );
    expect(screen.getByText("3 periods · Latest: Not available")).toBeTruthy();
  });

  it("reports a missing latest series value instead of an earlier known value", () => {
    renderTrend([10, null], "group");
    expect(screen.getByText("A · Not available")).toBeTruthy();
  });

  it("distinguishes all missing measurements from no records", () => {
    renderTrend([null, null]);
    expect(screen.getByRole("status").textContent).toBe(
      "No measurements available for these periods.",
    );
    expect(screen.getByText("2 periods · Latest: Not available")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("keeps zero as a measured value", () => {
    const view = renderTrend([0, 10]);
    expect(
      view.container.querySelector(".aeliqo-trend-line")?.getAttribute("d"),
    ).toContain("L");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
