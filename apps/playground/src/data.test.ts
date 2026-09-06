import { describe, expect, it } from "vitest";
import { dataPort, usageMetadata } from "./data";
import { createUsageRecords } from "./usage";

describe("rich application-owned snapshot", () => {
  it("preserves sourced models while isolating synthetic history", () => {
    const models = dataPort.getSnapshot("models").records;
    const history = dataPort.getSnapshot("usage").records;
    expect(models).toHaveLength(8);
    expect(history).toHaveLength(720);
    expect(new Set(history.map((row) => row.id)).size).toBe(720);
    expect(history[0]?.date).toBe(usageMetadata.startDate);
    expect(history.at(-1)?.date).toBe(usageMetadata.endDate);
    expect(createUsageRecords(models)).toEqual(history);
    expect(
      history.every((row) => row.dataKind === "SYNTHETIC · not observed usage"),
    ).toBe(true);
    expect(
      history.every((row) => models.some((model) => model.id === row.modelId)),
    ).toBe(true);
    expect(Object.isFrozen(history)).toBe(true);
    expect(history.every(Object.isFrozen)).toBe(true);
  });

  it("computes spend from fixed snapshot prices and totals without claiming observed popularity", () => {
    const history = dataPort.getSnapshot("usage").records;
    for (const summary of dataPort.getSnapshot("model-usage").records) {
      const rows = history.filter((row) => row.modelId === summary.modelId);
      expect(rows).toHaveLength(90);
      expect(summary.requests).toBe(
        rows.reduce((sum, row) => sum + Number(row.requests), 0),
      );
      expect(summary.spend).toBeCloseTo(
        rows.reduce((sum, row) => sum + Number(row.spend), 0),
        5,
      );
      for (const row of rows) {
        expect(row.spend).toBeCloseTo(
          (Number(row.inputTokens) * Number(summary.inputPrice) +
            Number(row.outputTokens) * Number(summary.outputPrice)) /
            1e6,
          5,
        );
      }
    }
  });

  it("derives organization comparisons from the curated model subset", () => {
    const orgs = dataPort.getSnapshot("organizations").records;
    expect(
      orgs.map((org) => [org.id, org.modelCount, org.outputPriceSpread]),
    ).toEqual([
      ["openai", 2, 10.5],
      ["anthropic", 2, 15],
      ["google", 2, 6.5],
      ["xai", 2, 3.5],
    ]);
    expect(orgs.find((org) => org.id === "anthropic")?.meanOutputPrice).toBe(
      17.5,
    );
  });

  it("exposes one connected semantic landscape graph with explicit benchmark caveats", () => {
    expect(dataPort.listDatasets().map((dataset) => dataset.id)).toEqual(
      expect.arrayContaining([
        "providers",
        "models",
        "pricing",
        "capabilities",
        "modalities",
        "model-limits",
        "benchmarks",
        "benchmark-results",
        "releases",
        "availability",
      ]),
    );
    const models = dataPort.getSnapshot("models").records;
    expect(models.every((model) => Number(model.capabilityCount) >= 4)).toBe(true);
    expect(dataPort.getSnapshot("model-capabilities").records).toHaveLength(48);
    expect(dataPort.getSnapshot("availability").records.length).toBeGreaterThan(8);
    expect(dataPort.getDataset("benchmark-results")?.caveat).toContain("Synthetic");
    expect(dataPort.getDataset("models")?.relationships?.map((item) => item.id)).toEqual(
      expect.arrayContaining(["organization", "provider"]),
    );
  });
});
