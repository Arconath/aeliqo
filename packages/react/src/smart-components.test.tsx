import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCapabilityDispatcher,
  createWorkspace,
  defineDataset,
  type DataSnapshot,
} from "@aeliqo/core";
import {
  Distribution,
  Explorer,
  Matrix,
  Relationship,
  Scatter,
  Trend,
  Workspace,
} from "./index";
import { MetricBreakdown } from "./metric-breakdown";
import { EventTimeline } from "./event-timeline";
import { TimeInvestigation } from "./time-investigation";
import { QualityPanel } from "./quality-panel";

afterEach(cleanup);

const teams = defineDataset({
  id: "teams",
  entity: "Team",
  label: "Service teams",
  identity: "id",
  labelField: "name",
  grain: "team-day",
  dimensions: [
    { key: "id", label: "ID", semanticType: "identifier" as const },
    { key: "name", label: "Team", semanticType: "text" as const },
    { key: "region", label: "Region", semanticType: "category" as const },
    { key: "ownerId", label: "Owner", semanticType: "identifier" as const },
  ],
  metrics: [
    {
      key: "requests",
      label: "Requests",
      aggregation: "sum" as const,
      grain: "team-day",
      goal: "maximize" as const,
    },
    {
      key: "errors",
      label: "Errors",
      aggregation: "sum" as const,
      grain: "team-day",
      goal: "minimize" as const,
    },
    {
      key: "errorRate",
      label: "Error rate",
      aggregation: "ratio-of-sums" as const,
      grain: "team-day",
      format: "percent" as const,
      ratio: {
        numerator: "errors",
        denominator: "requests",
        zeroDenominator: "null" as const,
        missing: "exclude-pair" as const,
      },
    },
    {
      key: "enabled",
      label: "On call",
      aggregation: "sum" as const,
      grain: "team-day",
    },
  ],
  timeFields: [
    { key: "observedAt", label: "Observed", temporal: "date" as const },
  ],
  relationships: [
    {
      id: "owner",
      label: "Owned by",
      field: "ownerId",
      targetDatasetId: "owners",
    },
  ],
  metadata: {
    source: "Operations export",
    sourceDate: "2026-09-01",
    snapshotVersion: "ops-1",
  },
  caveat:
    "Loaded service observations are not an incident root-cause analysis.",
});
const owners = defineDataset({
  id: "owners",
  entity: "Owner",
  label: "Owners",
  identity: "id",
  labelField: "name",
  dimensions: [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
  ],
  metrics: [],
  timeFields: [],
});
const snapshot: DataSnapshot = {
  status: "ready",
  scope: "entire-dataset",
  totalCount: 3,
  stale: false,
  metadata: {
    source: "Operations export",
    sourceDate: "2026-09-01",
    snapshotVersion: "ops-1",
  },
  records: [
    {
      id: "a",
      name: "Payments",
      region: "East",
      ownerId: "o1",
      requests: 100,
      errors: 20,
      errorRate: null,
      enabled: 1,
      observedAt: "2026-08-01",
    },
    {
      id: "b",
      name: "Search",
      region: "West",
      ownerId: "o2",
      requests: 50,
      errors: 10,
      errorRate: null,
      enabled: 0,
      observedAt: "2026-08-03",
    },
    {
      id: "c",
      name: "Ledger",
      region: "East",
      ownerId: "o1",
      requests: 50,
      errors: 20,
      errorRate: null,
      enabled: null,
      observedAt: "2026-08-04",
    },
  ],
};
const ownerSnapshot: DataSnapshot = {
  status: "ready",
  records: [
    { id: "o1", name: "Core" },
    { id: "o2", name: "Discovery" },
  ],
};

describe("standalone semantic catalog", () => {
  it("renders the five promoted components from direct props and preserves controlled identity", () => {
    const select = vi.fn();
    expect(
      renderToString(
        <Scatter
          dataset={teams}
          snapshot={snapshot}
          xMetric="requests"
          metric="errors"
          dimension="name"
        />,
      ),
    ).toContain("Metric trade-offs");
    expect(
      renderToString(
        <Distribution dataset={teams} snapshot={snapshot} metric="requests" />,
      ),
    ).toContain("distribution");
    expect(
      renderToString(
        <Relationship
          dataset={teams}
          snapshot={snapshot}
          relationship="owner"
          targetDataset={owners}
          targetSnapshot={ownerSnapshot}
        />,
      ),
    ).toContain("Declared graph");
    render(
      <Matrix
        dataset={teams}
        snapshot={snapshot}
        columns={["enabled"]}
        selectedId="b"
        onSelect={select}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Payments" }));
    expect(select).toHaveBeenCalledWith("a");
    cleanup();
    expect(
      renderToString(
        <Explorer
          dataset={teams}
          snapshot={snapshot}
          metric="requests"
          selectedId="a"
        />,
      ),
    ).toContain("Collection representation");
  });
});

describe("smart investigation components", () => {
  it("computes ratio-of-sums per declared group and drills into contributing records", () => {
    render(
      <MetricBreakdown
        dataset={teams}
        snapshot={snapshot}
        metric="errorRate"
        dimension="region"
      />,
    );
    expect(screen.getByText("25%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /East/i }));
    expect(screen.getByText("Records in East")).toBeTruthy();
    expect(screen.getByText("Payments")).toBeTruthy();
    expect(screen.getByText("Ledger")).toBeTruthy();
  });

  it("keeps missing, string, and numeric group identities distinct and preserves partial scope", () => {
    const onGroupValueSelect = vi.fn();
    const collisionSnapshot: DataSnapshot = {
      status: "ready",
      scope: "loaded-page",
      totalCount: 10,
      records: [
        { ...snapshot.records[0]!, id: "missing", region: null },
        { ...snapshot.records[0]!, id: "unknown", region: "Unknown" },
        { ...snapshot.records[0]!, id: "number", region: 1 },
        { ...snapshot.records[0]!, id: "string", region: "1" },
      ],
    };
    render(
      <MetricBreakdown
        dataset={teams}
        snapshot={collisionSnapshot}
        metric="requests"
        dimension="region"
        onGroupValueSelect={onGroupValueSelect}
      />,
    );
    const groupButtons = screen
      .getAllByRole("button")
      .filter((button) => button.closest(".aeliqo-ranking"));
    expect(groupButtons.map((button) => button.textContent)).toEqual([
      expect.stringContaining("Unknown (missing)"),
      expect.stringContaining("Unknown"),
      expect.stringContaining("1 (number)"),
      expect.stringMatching(/04.*1/),
    ]);
    groupButtons.forEach((button) => fireEvent.click(button));
    expect(onGroupValueSelect.mock.calls.map(([value]) => value)).toEqual([
      null,
      "Unknown",
      1,
      "1",
    ]);
    expect(
      screen.getAllByText("Loaded page only; results are not global.").length,
    ).toBeGreaterThan(0);
    cleanup();
    const port = {
      listDatasets: () => [teams],
      getDataset: () => teams,
      getSnapshot: () => collisionSnapshot,
      subscribe: () => () => {},
    };
    const store = createWorkspace({
      dataPort: port,
      nodes: [
        {
          id: "breakdown",
          component: "MetricBreakdown",
          datasetId: teams.id,
          metric: "requests",
          dimension: "region",
        },
      ],
    });
    render(
      <MetricBreakdown store={store} node={store.getNode("breakdown")!} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Unknown \(missing\)/ }),
    );
    expect(store.getInteraction("breakdown", "group")).toEqual({
      kind: "group",
      field: "region",
      value: null,
      valueType: "null",
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear group" }));
    expect(store.getInteraction("breakdown", "group")).toEqual({
      kind: "group",
      field: "region",
      value: null,
    });
    expect(screen.queryByRole("button", { name: "Clear group" })).toBeNull();
  });

  it("rejects non-additive breakdowns instead of summing means or arbitrary values", () => {
    const invalid = defineDataset({
      ...teams,
      id: "latency",
      metrics: [
        {
          key: "latency",
          label: "Latency",
          aggregation: "mean" as const,
          grain: "team-day",
        },
      ],
    });
    render(
      <MetricBreakdown
        dataset={invalid}
        snapshot={{
          ...snapshot,
          records: snapshot.records.map((row) => ({ ...row, latency: 12 })),
        }}
        metric="latency"
        dimension="region"
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "additive or ratio-of-sums",
    );
  });

  it("orders explicit events, omits invalid dates, and emits an inclusive typed range", () => {
    const onRangeChange = vi.fn();
    const data = {
      ...snapshot,
      totalCount: 4,
      records: [
        ...snapshot.records,
        {
          id: "bad",
          name: "Invalid",
          region: "East",
          ownerId: "o1",
          requests: 1,
          errors: 0,
          errorRate: null,
          enabled: 0,
          observedAt: "2026-02-30",
        },
      ],
    };
    render(
      <EventTimeline
        dataset={teams}
        snapshot={data}
        timeField="observedAt"
        onRangeChange={onRangeChange}
      />,
    );
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: String(Date.UTC(2026, 7, 3)) },
    });
    expect(onRangeChange).toHaveBeenCalledWith({
      start: Date.UTC(2026, 7, 3),
      end: Date.UTC(2026, 7, 4),
    });
  });

  it("keeps exact linked range endpoints while bounding choices for dense trends", () => {
    const records = Array.from({ length: 1_000 }, (_, index) => ({
      ...snapshot.records[0]!,
      id: `observation-${index}`,
      observedAt: new Date(Date.UTC(2023, 0, index + 1))
        .toISOString()
        .slice(0, 10),
      requests: index,
    }));
    const start = Date.UTC(2023, 4, 5, 12);
    const end = Date.UTC(2023, 7, 9, 12);
    render(
      <Trend
        dataset={teams}
        snapshot={{ status: "ready", records }}
        metric="requests"
        timeField="observedAt"
        range={{ start, end }}
        onRangeChange={vi.fn()}
      />,
    );
    const startControl = screen.getByLabelText("Start") as HTMLSelectElement;
    const endControl = screen.getByLabelText("End") as HTMLSelectElement;
    expect(startControl.value).toBe(String(start));
    expect(endControl.value).toBe(String(end));
    expect(startControl.options.length).toBeLessThanOrEqual(203);
    expect(
      screen.getByText(/Current endpoints are retained exactly/),
    ).toBeTruthy();
  });

  it("groups dense timelines into bounded keyboard-accessible drilldowns", () => {
    const records = Array.from({ length: 25 }, (_, index) => {
      const date = new Date(Date.UTC(2024, index, 1));
      return {
        ...snapshot.records[0]!,
        id: `event-${index}`,
        name: `Event ${index}`,
        observedAt: date.toISOString().slice(0, 10),
      };
    });
    render(
      <EventTimeline
        dataset={teams}
        snapshot={{ status: "ready", records }}
        timeField="observedAt"
      />,
    );
    expect(screen.getByText(/25 events grouped into 25/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /events$/ })).toHaveLength(24);
    fireEvent.click(screen.getByRole("button", { name: /2024-01 · 1 events/ }));
    expect(
      screen.getByRole("list", { name: "Events in 2024-01" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Event 0" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByRole("button", { name: /2026-01 · 1 events/ }),
    ).toBeTruthy();
  });

  it("composes trend, baseline, timeline, and records without a causal claim", () => {
    render(
      <TimeInvestigation
        dataset={teams}
        snapshot={snapshot}
        metric="requests"
        timeField="observedAt"
        baseline={150}
        baselineLabel="Previous window"
      />,
    );
    expect(screen.getByText(/Trend and known events are aligned/)).toBeTruthy();
    expect(screen.getByText("Baseline: Previous window")).toBeTruthy();
    expect(screen.getByText("Records in selected range")).toBeTruthy();
  });

  it("uses an explicit event dataset and inspects its selected event", () => {
    const incidents = defineDataset({
      id: "incidents",
      entity: "Incident",
      label: "Operational incidents",
      identity: "id",
      labelField: "summary",
      dimensions: [
        { key: "id", label: "ID", semanticType: "identifier" as const },
        { key: "summary", label: "Summary", semanticType: "text" as const },
        {
          key: "severity",
          label: "Severity",
          semanticType: "category" as const,
        },
      ],
      metrics: [],
      timeFields: [
        { key: "startedAt", label: "Started", temporal: "date" as const },
      ],
    });
    const incidentSnapshot: DataSnapshot = {
      status: "ready",
      records: [
        {
          id: "inc-1",
          summary: "Database failover",
          severity: "high",
          startedAt: "2026-08-03",
        },
      ],
    };
    render(
      <TimeInvestigation
        dataset={teams}
        snapshot={snapshot}
        metric="requests"
        timeField="observedAt"
        baseline={150}
        baselineLabel="Previous window"
        eventDataset={incidents}
        eventSnapshot={incidentSnapshot}
        eventTimeField="startedAt"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Database failover" }));
    expect(screen.getByText("Selected event")).toBeTruthy();
    expect(screen.getByText("Incident profile · inc-1")).toBeTruthy();
    cleanup();
    const port = {
      listDatasets: () => [teams, incidents],
      getDataset: (id: string) =>
        id === teams.id ? teams : id === incidents.id ? incidents : undefined,
      getSnapshot: (id: string) =>
        id === teams.id ? snapshot : incidentSnapshot,
      subscribe: () => () => {},
    };
    const store = createWorkspace({
      dataPort: port,
      nodes: [
        {
          id: "investigation",
          component: "TimeInvestigation",
          datasetId: teams.id,
          metric: "requests",
          timeField: "observedAt",
          config: {
            baseline: 150,
            baselineLabel: "Previous window",
            eventDatasetId: incidents.id,
            eventTimeField: "startedAt",
            eventLabelField: "summary",
          },
        },
      ],
    });
    render(
      <TimeInvestigation
        store={store}
        node={store.getNode("investigation")!}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Database failover" }));
    expect(screen.getByText("Incident profile · inc-1")).toBeTruthy();
    expect(store.getSelection("investigation")).toBeNull();
  });

  it("distinguishes unknown provenance from a failed snapshot", () => {
    const unknown = defineDataset({
      ...teams,
      id: "unknown",
      metadata: undefined,
      caveat: undefined,
    });
    render(
      <QualityPanel
        dataset={unknown}
        snapshot={{
          ...snapshot,
          metadata: undefined,
          totalCount: undefined,
          stale: undefined,
        }}
      />,
    );
    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(2);
    cleanup();
    render(
      <QualityPanel
        dataset={teams}
        snapshot={{ status: "error", records: [], error: "Permission denied" }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Permission denied",
    );
  });

  it("reuses record primitives for missingness and selected source inspection", () => {
    render(<QualityPanel dataset={teams} snapshot={snapshot} selectedId="a" />);
    expect(screen.getByText("Missing values in loaded records")).toBeTruthy();
    expect(screen.getByText("Selected source record")).toBeTruthy();
    expect(screen.getByText("Team profile · a")).toBeTruthy();
  });

  it("computes quality disclosure from an explicitly linked group scope", () => {
    const port = {
      listDatasets: () => [teams],
      getDataset: () => teams,
      getSnapshot: () => snapshot,
      subscribe: () => () => {},
    };
    const store = createWorkspace({
      dataPort: port,
      nodes: [
        {
          id: "breakdown",
          component: "MetricBreakdown",
          datasetId: teams.id,
          metric: "requests",
          dimension: "region",
        },
        {
          id: "quality",
          component: "QualityPanel",
          datasetId: teams.id,
          dimension: "region",
        },
      ],
      bindings: [
        {
          id: "quality-group",
          mode: "group",
          source: "breakdown",
          target: "quality",
          entity: "Team",
        },
      ],
    });
    expect(
      store.apply({
        version: 1,
        baseRevision: 0,
        operations: [
          {
            type: "interact",
            id: "breakdown",
            payload: {
              kind: "group",
              field: "region",
              value: "East",
              valueType: "string",
            },
          },
        ],
      }).ok,
    ).toBe(true);
    render(<QualityPanel store={store} node={store.getNode("quality")!} />);
    expect(screen.getByRole("row", { name: /On call 1 2/ })).toBeTruthy();
    expect(
      screen.getByText("Results cover the declared filtered population."),
    ).toBeTruthy();
  });

  it("validates and renders every new workspace contract", () => {
    const port = {
      listDatasets: () => [teams, owners],
      getDataset: (id: string) =>
        id === teams.id ? teams : id === owners.id ? owners : undefined,
      getSnapshot: (id: string) => (id === teams.id ? snapshot : ownerSnapshot),
      subscribe: () => () => {},
    };
    expect(() =>
      createWorkspace({
        dataPort: port,
        nodes: [
          {
            id: "bad",
            component: "MetricBreakdown",
            datasetId: teams.id,
            metric: "requests",
          },
        ],
      }),
    ).toThrow("requires a dimension");
    expect(() =>
      createWorkspace({
        dataPort: port,
        nodes: [
          { id: "bad-time", component: "EventTimeline", datasetId: teams.id },
        ],
      }),
    ).toThrow("EventTimeline requires a time field");
    expect(() =>
      createWorkspace({
        dataPort: port,
        nodes: [
          {
            id: "bad-config",
            component: "TimeInvestigation",
            datasetId: teams.id,
            metric: "requests",
            timeField: "observedAt",
            config: {
              baseline: 1,
              baselineLabel: "Previous",
              executable: "alert(1)",
            },
          },
        ],
      }),
    ).toThrow();
    const store = createWorkspace({
      dataPort: port,
      nodes: [
        {
          id: "breakdown",
          component: "MetricBreakdown",
          datasetId: teams.id,
          metric: "requests",
          dimension: "region",
        },
        {
          id: "timeline",
          component: "EventTimeline",
          datasetId: teams.id,
          timeField: "observedAt",
        },
        {
          id: "investigation",
          component: "TimeInvestigation",
          datasetId: teams.id,
          metric: "requests",
          timeField: "observedAt",
          config: { baseline: 150, baselineLabel: "Previous" },
        },
        { id: "quality", component: "QualityPanel", datasetId: teams.id },
      ],
    });
    render(<Workspace store={store} />);
    expect(screen.getByText("Requests breakdown")).toBeTruthy();
    expect(screen.getAllByText("Service teams timeline")).toHaveLength(2);
    expect(screen.getByText("Service teams quality")).toBeTruthy();
  });

  it("propagates typed group and range interactions once and rejects stale or cyclic changes", () => {
    const port = {
      listDatasets: () => [teams],
      getDataset: () => teams,
      getSnapshot: () => snapshot,
      subscribe: () => () => {},
    };
    const store = createWorkspace({
      dataPort: port,
      nodes: [
        {
          id: "groups-a",
          component: "MetricBreakdown",
          datasetId: teams.id,
          metric: "requests",
          dimension: "region",
        },
        {
          id: "groups-b",
          component: "MetricBreakdown",
          datasetId: teams.id,
          metric: "errors",
          dimension: "region",
        },
        {
          id: "events",
          component: "EventTimeline",
          datasetId: teams.id,
          timeField: "observedAt",
        },
        {
          id: "trend",
          component: "Trend",
          datasetId: teams.id,
          metric: "requests",
          timeField: "observedAt",
        },
      ],
      bindings: [
        {
          id: "groups",
          mode: "group",
          source: "groups-a",
          target: "groups-b",
          entity: "Team",
        },
        {
          id: "period",
          mode: "range",
          source: "events",
          target: "trend",
          entity: "Team",
        },
      ],
    });
    const groupListener = vi.fn(),
      rangeListener = vi.fn();
    store.subscribeInteraction("groups-b", "group", groupListener);
    store.subscribeInteraction("trend", "range", rangeListener);
    expect(
      store.apply({
        version: 1,
        baseRevision: 0,
        operations: [
          {
            type: "interact",
            id: "groups-a",
            payload: { kind: "group", field: "region", value: "East" },
          },
        ],
      }),
    ).toEqual({ ok: true, revision: 1 });
    expect(store.getInteraction("groups-b", "group")).toEqual({
      kind: "group",
      field: "region",
      value: "East",
    });
    const range = { start: Date.UTC(2026, 7, 1), end: Date.UTC(2026, 7, 4) };
    expect(
      store.apply({
        version: 1,
        baseRevision: 1,
        operations: [
          {
            type: "interact",
            id: "events",
            payload: { kind: "range", field: "observedAt", range },
          },
        ],
      }).ok,
    ).toBe(true);
    expect(store.getInteraction("trend", "range")).toEqual({
      kind: "range",
      field: "observedAt",
      range,
    });
    expect(groupListener).toHaveBeenCalledTimes(1);
    expect(rangeListener).toHaveBeenCalledTimes(1);
    expect(
      store.apply({
        version: 1,
        baseRevision: 1,
        operations: [
          {
            type: "interact",
            id: "events",
            payload: { kind: "range", field: "observedAt", range: null },
          },
        ],
      }).ok,
    ).toBe(false);
    expect(
      store.apply({
        version: 1,
        baseRevision: 2,
        operations: [
          {
            type: "connect",
            binding: {
              id: "cycle",
              mode: "range",
              source: "trend",
              target: "events",
              entity: "Team",
            },
          },
        ],
      }).ok,
    ).toBe(false);
  });

  it("rejects a non-additive MetricBreakdown through workspace_apply before mount", () => {
    const invalid = defineDataset({
      ...teams,
      id: "latency",
      metrics: [
        {
          key: "latency",
          label: "Latency",
          aggregation: "mean" as const,
          grain: "team-day",
        },
      ],
    });
    const port = {
      listDatasets: () => [invalid],
      getDataset: () => invalid,
      getSnapshot: () => ({
        ...snapshot,
        records: snapshot.records.map((record) => ({ ...record, latency: 12 })),
      }),
      subscribe: () => () => {},
    };
    const dispatcher = createCapabilityDispatcher(
      createWorkspace({ dataPort: port }),
    );
    expect(() =>
      dispatcher.dispatch("workspace_apply", {
        version: 1,
        baseRevision: 0,
        operations: [
          {
            type: "mount",
            node: {
              id: "invalid-breakdown",
              component: "MetricBreakdown",
              datasetId: invalid.id,
              metric: "latency",
              dimension: "region",
            },
          },
        ],
      }),
    ).toThrow("requires an additive or ratio-of-sums metric");
  });
});
