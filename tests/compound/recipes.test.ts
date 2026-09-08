import {describe, expect, it} from "vitest";
import type {CommitPreconditions, ResultRef} from "../../packages/core/src/index.js";
import {
  breakdownPresentationRecipe, comparisonPresentationRecipe, explorerPresentationRecipe, formFlowPresentationRecipe,
  investigationPresentationRecipe, qualityPanelPresentationRecipe, recordEditorPresentationRecipe, searchResultsPresentationRecipe,
} from "../../packages/web/src/compound/index.js";

const ref: ResultRef = {id: "task", revision: "1", outputId: "rows", queryDigest: "query", scopeDigest: "scope"};
const preconditions: CommitPreconditions = {scopeDigest: "scope", policyRevision: "policy", taskRevision: "task", regionRevision: "region", catalogRevision: "catalog", experienceRevision: "experience", functionRegistryDigest: "functions", results: [ref]};
const input = {id: "view", revision: "1", preconditions, result: ref};
const key = (value: {readonly id: string; readonly revision: string}) => `${value.id}@${value.revision}`;

describe("compound presentation recipes", () => {
  it("creates bounded plans with stable child identities and exact result references", () => {
    const recipes = [
      explorerPresentationRecipe(input), comparisonPresentationRecipe(input), breakdownPresentationRecipe(input), investigationPresentationRecipe(input),
      searchResultsPresentationRecipe(input), recordEditorPresentationRecipe(input), formFlowPresentationRecipe(input), qualityPanelPresentationRecipe(input),
    ];
    for (const recipe of recipes) {
      expect(recipe.plan.id).toBe("view");
      expect(recipe.plan.nodes.length).toBeGreaterThan(1);
      expect(new Set(recipe.plan.nodes.map(node => node.id)).size).toBe(recipe.plan.nodes.length);
      expect(recipe.plan.nodes[0]?.children).toEqual(recipe.childIds);
      if (recipe.plan.nodes.some(node => node.result !== undefined)) expect(recipe.plan.nodes.some(node => node.result?.scopeDigest === "scope")).toBe(true);
      expect(recipe.plan.links.every(link => link.mapping.id.length > 0)).toBe(true);
      expect(recipe.plan.stateTransfer).toEqual([]);
    }
  });

  it("uses semantic child representations for each inventory entry", () => {
    expect(explorerPresentationRecipe(input).plan.nodes.map(node => key(node.representation))).toEqual(["compound.explorer@1", "control.filter-builder@1", "data.record-list@1", "data.detail@1"]);
    expect(comparisonPresentationRecipe(input).plan.nodes[1]?.representation.id).toBe("data.table");
    expect(breakdownPresentationRecipe(input).plan.nodes.map(node => node.role)).toEqual(["breakdown", "metric", "collection", "detail"]);
    expect(investigationPresentationRecipe(input).plan.nodes.map(node => node.role)).toContain("timeline");
    expect(searchResultsPresentationRecipe(input).plan.nodes.map(node => node.role)).toContain("search");
    expect(recordEditorPresentationRecipe(input).plan.nodes[1]?.role).toBe("form");
    expect(formFlowPresentationRecipe({...input, steps: ["one", "two"]}).plan.nodes[1]?.config.values).toEqual({steps: ["one", "two"]});
    expect(qualityPanelPresentationRecipe(input).plan.nodes[1]?.role).toBe("quality");
  });

  it("does not invent an authorization result when none is supplied", () => {
    const plan = explorerPresentationRecipe({id: "unresolved", revision: "1", preconditions});
    expect(plan.plan.nodes.every(node => node.result === undefined)).toBe(true);
    expect(plan.plan.nodes[0]?.config.values).toEqual({});
  });
});
