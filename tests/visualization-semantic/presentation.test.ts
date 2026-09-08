import {describe, expect, it} from "vitest";
import {createAeliqoPresentationRegistry} from "../../packages/web/src/region/registry.js";
import type {AeliqoPresentationRegistryOptions} from "../../packages/web/src/region/registry.js";
import {validatePresentationPlan} from "../../packages/core/src/index.js";
import type {PresentationContext, PresentationPlan, ValidatedPresentation} from "../../packages/core/src/index.js";
import {visualizationContext, visualizationPlan, visualizationRegistryOptions} from "./fixtures.mjs";

function checked(readOnly = false): ValidatedPresentation {
  const options = visualizationRegistryOptions(readOnly) as AeliqoPresentationRegistryOptions;
  const registry = createAeliqoPresentationRegistry(options);
  if (!registry.ok) throw new Error(JSON.stringify(registry.diagnostics));
  const result = validatePresentationPlan(
    visualizationPlan() as PresentationPlan,
    visualizationContext() as PresentationContext,
    registry.value,
  );
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

describe("canonical semantic visualization presentation", () => {
  it("validates one core plan containing all twelve visualization families", () => {
    const presentation = checked();
    expect(presentation.nodes).toHaveLength(13);
    const visualizationNodes = presentation.nodes.filter((node) => node.node.id !== "root");
    expect(visualizationNodes.map((node) => node.manifest.id)).toEqual([
      "visualization.trend", "visualization.bar", "visualization.area", "visualization.scatter",
      "visualization.histogram", "visualization.heatmap", "visualization.matrix", "visualization.timeline",
      "visualization.calendar-grid", "visualization.tree", "visualization.treemap", "visualization.relationship",
    ]);
    expect(visualizationNodes.every((node) => node.node.result !== undefined)).toBe(true);
    expect(visualizationNodes.every((node) => node.config.values.visualization !== undefined)).toBe(true);

    const matrix = visualizationNodes.find((node) => node.manifest.id === "visualization.matrix");
    expect(matrix?.config.fields).toEqual(["id", "date"]);
    expect(matrix?.node.result).toEqual({id: "semantic-temporal", revision: "1", outputId: "rows", queryDigest: "query", scopeDigest: "scope"});
    expect(matrix?.config.operations).toEqual([{id: "data.read", revision: "1"}, {id: "interaction.selection", revision: "1"}]);
  });

  it("derives a read-only configuration with no selection port or operation", () => {
    const presentation = checked(true);
    const visualizationNodes = presentation.nodes.filter((node) => node.node.id !== "root");
    expect(visualizationNodes.every((node) => node.config.ports.length === 0)).toBe(true);
    expect(visualizationNodes.every((node) => node.config.operations?.map((operation) => operation.id))).toBe(true);
    expect(visualizationNodes.every((node) => node.config.operations?.length === 1 && node.config.operations[0]?.id === "data.read")).toBe(true);
  });
});
