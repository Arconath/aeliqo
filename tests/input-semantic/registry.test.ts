import {describe, expect, it} from "vitest";
import {createInputPresentationManifests, type AeliqoInputBinding, type AeliqoInputBindings, type AeliqoInputDraftBinding} from "../../packages/web/src/region/input-registry.js";
import type {SemanticType} from "../../packages/core/src/index.js";

const textType: SemanticType = {value: "text", nullable: false};
const numberType: SemanticType = {value: "float", nullable: false, unit: {dimension: "temperature", symbol: "degC"}};
const dateType: SemanticType = {value: "date", nullable: false};
const draft = (field: string, type: SemanticType = textType): AeliqoInputDraftBinding => ({entity: "records", key: "record-1", field, entityRevision: "7", type});
const option = {value: "open", label: "Open"};

function bindings(overrides: Partial<AeliqoInputBindings["inputs"][number]>[] = []): AeliqoInputBindings {
  const base: AeliqoInputBinding[] = [
    {id: "title", ref: {id: "input.text-field", revision: "1"}, config: {label: "Title", defaultValue: "Initial"}, draft: draft("title")},
    {id: "range", ref: {id: "input.date-range", revision: "1"}, config: {label: "Period", boundary: "inclusive"}, range: {start: draft("starts", dateType), end: draft("ends", dateType)}},
    {id: "temperature", ref: {id: "input.slider", revision: "1"}, config: {label: "Temperature", min: 0, max: 100, step: 1, unit: "degC"}, draft: draft("temperature", numberType)},
    {id: "status", ref: {id: "input.select", revision: "1"}, config: {label: "Status", options: [option]}, draft: draft("status")},
    {id: "save", ref: {id: "input.form", revision: "1"}, config: {label: "Save"}, action: {action: {id: "record.save", revision: "1"}, input: {source: "semantic-input-test"}}},
    {id: "attachments", ref: {id: "input.file-input", revision: "1"}, config: {label: "Attachments", multiple: true}, file: {schema: {id: "files.metadata", revision: "1"}}},
    {id: "details", ref: {id: "input.field-group", revision: "1"}, config: {legend: "Details"}},
  ];
  return {revision: "inputs-7", inputs: base.map((entry, index) => ({...entry, ...(overrides[index] ?? {})}) as AeliqoInputBinding)};
}

describe("semantic input registry", () => {
  it("registers all 15 primitives and resolves only host-owned binding values", () => {
    const result = createInputPresentationManifests(bindings());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(15);
    const text = result.value.find((manifest) => manifest.ref.id === "input.text-field");
    expect(text).toBeDefined();
    const resolved = text!.resolveConfig({bindingRef: "title", bindingRevision: "inputs-7"}, undefined);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.values).toMatchObject({label: "Title", defaultValue: "Initial", entity: "records", field: "title", bindingRevision: "inputs-7"});
    expect(resolved.value.ports[0]).toMatchObject({id: "draft", payload: "draft", entity: "records", type: textType});
    expect(resolved.value.values).not.toHaveProperty("options");
    const group = result.value.find((manifest) => manifest.ref.id === "input.field-group")!;
    expect(group.resolveConfig({bindingRef: "details", bindingRevision: "inputs-7"}, undefined).ok).toBe(true);
  });

  it("rejects graph supplied labels, options, semantic targets and stale revisions", () => {
    const result = createInputPresentationManifests(bindings());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const text = result.value.find((manifest) => manifest.ref.id === "input.text-field")!;
    expect(text.resolveConfig({bindingRef: "title", bindingRevision: "inputs-6"}, undefined).ok).toBe(false);
    expect(text.resolveConfig({bindingRef: "title", bindingRevision: "inputs-7", label: "forged"}, undefined).ok).toBe(false);
    expect(text.resolveConfig({bindingRef: "title", bindingRevision: "inputs-7", field: "forged"}, undefined).ok).toBe(false);
    const select = result.value.find((manifest) => manifest.ref.id === "input.select")!;
    expect(select.resolveConfig({bindingRef: "status", bindingRevision: "inputs-7", options: [{value: "forged", label: "Forged"}]}, undefined).ok).toBe(false);
  });

  it("validates defaults, number units, date range mappings and action/file registrations", () => {
    const invalidDefault = bindings();
    (invalidDefault.inputs[0]!.config as Record<string, unknown>).defaultValue = 4;
    expect(createInputPresentationManifests(invalidDefault).ok).toBe(false);

    const invalidUnit = bindings();
    (invalidUnit.inputs[2]!.config as Record<string, unknown>).unit = "degF";
    expect(createInputPresentationManifests(invalidUnit).ok).toBe(false);

    const invalidRange = bindings();
    (invalidRange.inputs[1]!.range!.end as unknown as {type: SemanticType}).type = textType;
    expect(createInputPresentationManifests(invalidRange).ok).toBe(false);

    const invalidAction = bindings();
    (invalidAction.inputs[4]!.action!.input as Record<string, unknown>).secret = new Date();
    expect(createInputPresentationManifests(invalidAction).ok).toBe(false);

    const invalidFile = bindings();
    (invalidFile.inputs[5] as unknown as {file?: unknown}).file = undefined;
    expect(createInputPresentationManifests(invalidFile).ok).toBe(false);
  });

  it("freezes the copied binding snapshot", () => {
    const input = bindings();
    const result = createInputPresentationManifests(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value[0])).toBe(true);
    expect(Object.isFrozen(input)).toBe(false);
  });
});
