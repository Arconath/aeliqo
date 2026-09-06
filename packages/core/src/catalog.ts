import type { Capability } from "./contracts";

export const catalog: readonly Capability[] = [
  {
    component: "Delta",
    purpose: "Compare a measure with an explicitly labeled baseline",
    accepts: ["metric", "baseline"],
    interactions: [],
    minWidth: 180,
    accessibility: "Signed change with baseline and zero-baseline explanation",
  },
  {
    component: "RecordList",
    purpose: "Scan entity summaries without ranking or a table grid",
    accepts: ["entity"],
    interactions: ["select", "receive-selection"],
    minWidth: 220,
    accessibility: "Semantic list with named record selection buttons",
  },
  {
    component: "SelectionSummary",
    purpose: "Disclose selected identities and their loaded scope",
    accepts: ["entity"],
    interactions: ["receive-selection"],
    minWidth: 180,
    accessibility:
      "Labeled selected identity list including unavailable entities",
  },
  {
    component: "Overview",
    purpose: "Read declared measures beside a scannable entity collection",
    accepts: ["entity", "metric"],
    interactions: ["select", "receive-selection"],
    minWidth: 280,
    accessibility: "Composition of labeled Metric and RecordList primitives",
  },
  {
    component: "Filter",
    purpose: "Build explicit semantic filters with an editable draft",
    accepts: ["entity"],
    interactions: ["filter"],
    minWidth: 260,
    accessibility: "Labeled native controls; IME-safe explicit submission",
    adaptation: "Controls wrap while preserving focused input and draft",
  },
  {
    component: "Metric",
    purpose: "Summarize one measure",
    accepts: ["metric"],
    interactions: [],
    minWidth: 180,
    accessibility: "Labeled numeric summary",
  },
  {
    component: "Ranking",
    purpose: "Order entities by a measure",
    accepts: ["entity", "metric"],
    interactions: ["select"],
    minWidth: 260,
    accessibility: "Keyboard-selectable ranked list",
    adaptation:
      "Compact containers retain labels and values and omit bar representation",
  },
  {
    component: "Trend",
    purpose: "Show a measure over time",
    accepts: ["time", "metric"],
    interactions: ["select-range", "receive-range"],
    minWidth: 260,
    accessibility: "Named chart with textual summary",
    adaptation: "Responsive SVG and reduced tick density",
  },
  {
    component: "Table",
    purpose: "Inspect entity records",
    accepts: ["entity"],
    interactions: ["select", "receive-range", "receive-group"],
    minWidth: 280,
    accessibility: "Semantic table and selection buttons",
  },
  {
    component: "Detail",
    purpose: "Inspect a selected entity",
    accepts: ["entity"],
    interactions: ["receive-selection", "forward-selection"],
    minWidth: 260,
    accessibility: "Definition list with selected entity heading",
  },
  {
    component: "Scatter",
    purpose: "Inspect correlation and trade-offs between two measures",
    accepts: ["entity", "x-metric", "y-metric", "group"],
    interactions: ["select", "receive-selection"],
    minWidth: 320,
    accessibility: "Named scatterplot with keyboard-selectable point list",
    adaptation:
      "Full annotations become selected and Pareto-outlier annotations in compact containers",
  },
  {
    component: "Distribution",
    purpose: "Inspect the spread, range and outliers of a measure",
    accepts: ["entity", "metric"],
    interactions: [],
    minWidth: 280,
    accessibility: "Named histogram with textual range and outlier summary",
    adaptation: "Bin and label density follow the container width",
  },
  {
    component: "Relationship",
    purpose: "Explore a declared relationship between semantic entities",
    accepts: ["entity", "relationship"],
    interactions: ["select", "receive-selection"],
    minWidth: 320,
    accessibility:
      "Declared relationship groups with selectable source entities",
    adaptation:
      "Compact containers collapse relationship metadata while preserving every entity",
  },
  {
    component: "Matrix",
    purpose: "Compare boolean or categorical features across entities",
    accepts: ["entity", "boolean-metrics"],
    interactions: ["select", "receive-selection"],
    minWidth: 340,
    accessibility: "Semantic comparison table with selectable rows",
    adaptation:
      "Full labels become compact labels while retaining accessible names",
  },
  {
    component: "Comparison",
    purpose: "Compare measures using primitives",
    accepts: ["entity", "metric"],
    interactions: [],
    minWidth: 280,
    accessibility: "Labeled metric summaries and ranking",
  },
  {
    component: "Explorer",
    purpose: "Explore and inspect entities",
    accepts: ["entity", "metric"],
    interactions: ["select", "receive-selection"],
    minWidth: 280,
    accessibility: "Ranking linked to detail through semantic selection",
  },
  {
    component: "MetricBreakdown",
    purpose:
      "Explain a measure across a declared dimension and inspect contributing records",
    accepts: ["entity", "metric", "dimension"],
    interactions: ["select-group", "receive-group", "inspect-records"],
    minWidth: 320,
    accessibility:
      "Labeled total, keyboard-selectable groups, and contributing record table",
    adaptation:
      "The ranked group list and record table stack without changing aggregation semantics",
  },
  {
    component: "EventTimeline",
    purpose: "Inspect explicit dated events without implying causality",
    accepts: ["entity", "time"],
    interactions: [
      "select",
      "select-range",
      "receive-range",
      "receive-selection",
    ],
    minWidth: 300,
    accessibility:
      "Chronological keyboard-selectable event list with explicit timestamps",
    adaptation:
      "Dense timestamps group visually while every event remains in reading order",
  },
  {
    component: "TimeInvestigation",
    purpose:
      "Investigate a declared trend beside known events and a labeled baseline",
    accepts: ["time", "metric", "baseline", "event"],
    interactions: [
      "select",
      "select-range",
      "receive-range",
      "receive-selection",
    ],
    minWidth: 360,
    accessibility:
      "Composed trend, baseline change, events, and records with preserved reading order",
    adaptation: "The composed views stack in narrow containers",
  },
  {
    component: "QualityPanel",
    purpose:
      "Disclose source, freshness, coverage, missing values, and comparison limits",
    accepts: ["entity", "provenance"],
    interactions: ["receive-selection", "receive-range", "receive-group"],
    minWidth: 260,
    accessibility:
      "Definition list distinguishes known, unknown, stale, partial, and failed states",
  },
];
