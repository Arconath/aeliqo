import {bindVisualizationSpec, scalarIdentity} from '@aeliqo/sdk-core';
import type {BoundVisualization, Catalog, Outcome, Result, ResultRef, Scalar, SemanticType} from '@aeliqo/sdk-core';
import {materializeVisualizationRows} from '../materialization.js';
import type {VisualizationInputs, VisualizationRow} from '../types.js';

const MAX_ROWS = 10_000;
const MAX_WORK = 100_000;
const MAX_MARKS = 50_000;
const MAX_DEPTH = 128;
const MAX_PIXELS = 4_000_000;
const MAX_GROUPS = 2_048;

export interface HierarchyGeometryOptions {
  readonly width?: number;
  readonly height?: number;
  readonly maxMarks?: number;
  readonly maxDepth?: number;
}

export interface HierarchyNodeGeometry {
  readonly identity: string;
  readonly rowIdentity: string;
  readonly label: string;
  readonly parentIdentity?: string;
  readonly depth: number;
  readonly children: readonly string[];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly value?: number;
  readonly leaf: boolean;
}

export interface HierarchyGeometry {
  readonly kind: 'tree' | 'treemap';
  readonly state: 'geometry' | 'data-only';
  readonly reason?: string;
  readonly bound: BoundVisualization;
  readonly result: Result;
  readonly rows: readonly VisualizationRow[];
  readonly nodes: readonly HierarchyNodeGeometry[];
  readonly width: number;
  readonly height: number;
  readonly maxDepth: number;
  readonly leafValuePolicy?: 'leaf-only';
}

export interface RelationshipNodeGeometry {
  readonly identity: string;
  readonly namespace: 'source' | 'target';
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

export interface RelationshipEdgeGeometry {
  readonly identity: string;
  readonly source: string;
  readonly target: string;
  readonly sourceLabel: string;
  readonly targetLabel: string;
  readonly label?: string;
}

export interface RelationshipGeometry {
  readonly kind: 'relationship';
  readonly state: 'geometry' | 'data-only';
  readonly reason?: string;
  readonly bound: BoundVisualization;
  readonly result: Result;
  readonly rows: readonly VisualizationRow[];
  readonly nodes: readonly RelationshipNodeGeometry[];
  readonly edges: readonly RelationshipEdgeGeometry[];
  readonly width: number;
  readonly height: number;
  readonly cardinality: Catalog['relationships'][number]['cardinality'];
}

export type HierarchyVisualizationGeometry = HierarchyGeometry | RelationshipGeometry;

const compareIdentity = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const fail = (code: string, message: string): Outcome<never> => ({
  ok: false,
  diagnostics: [{code: `visualization.${code}`, message, retryable: false}],
});

function refKey(ref: ResultRef): string {
  return JSON.stringify([ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest]);
}

function saneDimension(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function optionsFor(inputs: VisualizationInputs, options: HierarchyGeometryOptions = {}): Required<HierarchyGeometryOptions> {
  const width = saneDimension(options.width ?? inputs.width, 640);
  const height = saneDimension(options.height ?? inputs.height, 360);
  const requestedMarks = options.maxMarks ?? inputs.maxMarks;
  const maxMarks = Number.isSafeInteger(requestedMarks) ? requestedMarks : 0;
  const maxDepth = Number.isSafeInteger(options.maxDepth) && options.maxDepth !== undefined && options.maxDepth > 0
    ? Math.min(MAX_DEPTH, options.maxDepth) : MAX_DEPTH;
  return {width, height, maxMarks, maxDepth};
}

function validateGeometryBudget(width: number, height: number, maxMarks: number): Outcome<true> {
  if (width < 64 || height < 64 || width > 4_000 || height > 4_000 || width * height > MAX_PIXELS) return fail('pixels', `The visualization dimensions exceed the bounded pixel budget.`);
  if (maxMarks < 1 || maxMarks > MAX_MARKS) return fail('marks', `The visualization mark budget is unsupported.`);
  return {ok: true, value: true};
}

function bindForView(inputs: VisualizationInputs, view: 'tree' | 'treemap' | 'relationship'): Outcome<{bound: BoundVisualization; result: Result; rows: readonly VisualizationRow[]}> {
  if (inputs.visualization === undefined) return fail('input', 'A visualization specification is required.');
  if (inputs.visualization.view !== view) return fail('view', `Expected a ${view} visualization specification.`);
  const checked = bindVisualizationSpec(inputs.visualization, inputs.context);
  if (!checked.ok) return checked;
  const bound = checked.value;
  const result = bound.results.find(candidate => refKey(candidate.ref) === refKey(inputs.visualization && 'result' in inputs.visualization ? inputs.visualization.result : bound.results[0]!.ref));
  if (result === undefined) return fail('result', 'The bound result is unavailable.');
  const materialized = materializeVisualizationRows(bound, result.ref, inputs.datasets);
  if (!materialized.ok) return materialized;
  return {ok: true, value: {bound, result, rows: materialized.value}};
}

function fieldsFor(result: Result, ids: readonly string[]): Outcome<readonly {readonly id: string; readonly type: SemanticType}[]> {
  const fields: {id: string; type: SemanticType}[] = [];
  for (const id of ids) {
    const field = result.fields.find(candidate => candidate.id === id);
    if (field === undefined) return fail('field', `The field ${id} is unavailable in the bound result.`);
    fields.push({id: field.id, type: field.type});
  }
  return {ok: true, value: fields};
}

function keyFor(values: Readonly<Record<string, Scalar>>, fields: readonly {readonly id: string; readonly type: SemanticType}[], allowAllNull: boolean): Outcome<string | undefined> {
  const identities: string[] = [];
  let nullCount = 0;
  for (const field of fields) {
    const value = values[field.id];
    if (value === null) {
      nullCount += 1;
      identities.push('null');
      continue;
    }
    const identity = scalarIdentity(value, field.type);
    if (!identity.ok) return identity;
    identities.push(identity.value);
  }
  if (nullCount !== 0) {
    if (!allowAllNull || nullCount !== fields.length) return fail('hierarchy-parent', 'Parent keys must be wholly null for roots or wholly non-null for descendants.');
    return {ok: true, value: undefined};
  }
  return {ok: true, value: JSON.stringify(identities)};
}

function labelFor(values: Readonly<Record<string, Scalar>>, field: {readonly id: string; readonly type: SemanticType} | undefined, fallback: string): string {
  if (field === undefined) return fallback;
  const value = values[field.id];
  if (value === null) return 'Missing';
  if (typeof value === 'object') return value.decimal;
  return String(value);
}

interface PreparedHierarchy {
  readonly bound: BoundVisualization;
  readonly result: Result;
  readonly rows: readonly VisualizationRow[];
  readonly nodeFields: readonly {readonly id: string; readonly type: SemanticType}[];
  readonly parentFields: readonly {readonly id: string; readonly type: SemanticType}[];
  readonly labelField?: {readonly id: string; readonly type: SemanticType};
}

function prepareHierarchy(inputs: VisualizationInputs, view: 'tree' | 'treemap', options: HierarchyGeometryOptions): Outcome<{prepared: PreparedHierarchy; dimensions: Required<HierarchyGeometryOptions>}> {
  const checked = bindForView(inputs, view); if (!checked.ok) return checked;
  const spec = checked.value.bound.spec;
  if (spec.view !== view) return fail('view', `Expected a ${view} visualization specification.`);
  const nodeFields = fieldsFor(checked.value.result, spec.node); if (!nodeFields.ok) return nodeFields;
  const parentFields = fieldsFor(checked.value.result, spec.parent); if (!parentFields.ok) return parentFields;
  const labelField = spec.label === undefined ? undefined : checked.value.result.fields.find(field => field.id === spec.label);
  const dimensions = optionsFor(inputs, options);
  const budget = validateGeometryBudget(dimensions.width, dimensions.height, dimensions.maxMarks); if (!budget.ok) return budget;
  if (checked.value.rows.length > MAX_ROWS || checked.value.rows.length * checked.value.result.fields.length > MAX_WORK)
    return fail('budget', 'The authorized hierarchy rows exceed the bounded materialization work budget.');
  return {ok: true, value: {prepared: {bound: checked.value.bound, result: checked.value.result, rows: checked.value.rows, nodeFields: nodeFields.value, parentFields: parentFields.value, ...(labelField === undefined ? {} : {labelField})}, dimensions}};
}

interface CheckedNode {
  readonly identity: string;
  readonly parentIdentity?: string;
  readonly label: string;
  readonly row: VisualizationRow;
  readonly weight?: ExactWeight;
  children: string[];
  depth: number;
}

/**
 * A non-negative finite value represented as coefficient × 10^-scale.
 *
 * Treemap layout must not use Number as its source of truth: decimal values
 * can be much wider or smaller than the floating-point range.  BigInt keeps
 * subtree sums and comparisons exact; Number is used only for the final
 * bounded screen ratio and is rejected when it would underflow/overflow.
 */
interface ExactWeight {
  readonly coefficient: bigint;
  readonly scale: number;
}

const ZERO_WEIGHT: ExactWeight = Object.freeze({coefficient: 0n, scale: 0});

function normalizeWeight(coefficient: bigint, scale: number): ExactWeight {
  if (coefficient === 0n) return ZERO_WEIGHT;
  let normalized = coefficient;
  let normalizedScale = scale;
  while (normalized % 10n === 0n) {
    normalized /= 10n;
    normalizedScale -= 1;
  }
  return Object.freeze({coefficient: normalized, scale: normalizedScale});
}

function decimalWeight(text: string): ExactWeight | undefined {
  const match = /^(-?)([0-9]+)(?:\.([0-9]+))?$/u.exec(text);
  if (match === null) return undefined;
  const digits = `${match[2]}${match[3] ?? ''}`;
  const coefficient = BigInt(digits);
  if (match[1] === '-' && coefficient !== 0n) return undefined;
  return normalizeWeight(coefficient, match[3]?.length ?? 0);
}

function numberWeight(value: number): ExactWeight | undefined {
  if (!Number.isFinite(value) || value < 0) return undefined;
  // String(number) is a finite, round-trippable decimal and may use an
  // exponent.  Parse it exactly rather than converting it back through
  // Number during subtree aggregation.
  const match = /^([+]?[0-9]+)(?:\.([0-9]+))?(?:e([+-]?[0-9]+))?$/iu.exec(String(value));
  if (match === null) return undefined;
  const coefficient = BigInt(`${match[1]}${match[2] ?? ''}`);
  const exponent = Number(match[3] ?? '0');
  if (!Number.isSafeInteger(exponent)) return undefined;
  return normalizeWeight(coefficient, (match[2]?.length ?? 0) - exponent);
}

function addWeights(left: ExactWeight, right: ExactWeight): ExactWeight {
  if (left.coefficient === 0n) return right;
  if (right.coefficient === 0n) return left;
  const scale = Math.max(left.scale, right.scale);
  const leftCoefficient = left.coefficient * 10n ** BigInt(scale - left.scale);
  const rightCoefficient = right.coefficient * 10n ** BigInt(scale - right.scale);
  return normalizeWeight(leftCoefficient + rightCoefficient, scale);
}

function leadingNumber(coefficient: bigint): {readonly mantissa: number; readonly exponent: number} {
  const digits = coefficient.toString();
  const significant = digits.slice(0, 16);
  return {mantissa: Number(significant) / 10 ** (significant.length - 1), exponent: digits.length - 1};
}

function weightAsNumber(weight: ExactWeight): number | undefined {
  if (weight.coefficient === 0n) return 0;
  const leading = leadingNumber(weight.coefficient);
  // Let the runtime parse the scientific form so subnormal values such as
  // 5e-324 survive; `mantissa * 10 ** exponent` rounds 10^-324 to zero
  // before the multiplication.
  const value = Number(`${leading.mantissa}e${leading.exponent - weight.scale}`);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function ratioAsNumber(weight: ExactWeight, total: ExactWeight): number | undefined {
  if (weight.coefficient === 0n) return 0;
  if (total.coefficient === 0n) return undefined;
  const numerator = leadingNumber(weight.coefficient);
  const denominator = leadingNumber(total.coefficient);
  const exponent = numerator.exponent - weight.scale - denominator.exponent + total.scale;
  const ratio = Number(`${numerator.mantissa / denominator.mantissa}e${exponent}`);
  if (!Number.isFinite(ratio) || ratio <= 0) return undefined;
  // The exact ratio is at most one.  Refuse an approximation that exceeds
  // one materially instead of creating overlapping boxes.
  if (ratio > 1) return ratio <= 1 + Number.EPSILON * 8 ? 1 : undefined;
  return ratio;
}

function checkedHierarchyNodes(prepared: PreparedHierarchy, view: 'tree' | 'treemap', maxDepth: number): Outcome<{nodes: Map<string, CheckedNode>; roots: string[]; maxDepth: number}> {
  const nodes = new Map<string, CheckedNode>();
  const roots: string[] = [];
  const spec = prepared.bound.spec;
  if (spec.view !== view) return fail('view', 'The bound view changed during materialization.');
  let valueField: {readonly id: string; readonly type: SemanticType} | undefined;
  if (spec.view === 'treemap') {
    valueField = prepared.result.fields.find(field => field.id === spec.value);
    if (valueField === undefined) return fail('field', 'The treemap value field is unavailable.');
  }
  for (const row of prepared.rows) {
    const identity = keyFor(row.values, prepared.nodeFields, false); if (!identity.ok || identity.value === undefined) return identity.ok ? fail('identity', 'A node identity is unavailable.') : identity;
    if (nodes.has(identity.value)) return fail('duplicate-node', 'Hierarchy node keys must be unique.');
    const parent = keyFor(row.values, prepared.parentFields, true); if (!parent.ok) return parent;
    let weight: ExactWeight | undefined;
    if (valueField !== undefined) {
      const raw = row.values[valueField.id];
      if (raw === null) return fail('treemap-value', 'Treemap values must be non-null and nonnegative.');
      if (typeof raw === 'object') {
        weight = decimalWeight(raw.decimal);
      } else if (typeof raw === 'number') {
        weight = numberWeight(raw);
      } else return fail('treemap-value', 'Treemap values must be numeric.');
      if (weight === undefined) return fail('treemap-value', 'Treemap values must be finite and nonnegative.');
    }
    nodes.set(identity.value, {identity: identity.value, ...(parent.value === undefined ? {} : {parentIdentity: parent.value}), label: labelFor(row.values, prepared.labelField, identity.value), row, ...(weight === undefined ? {} : {weight}), children: [], depth: 0});
  }
  for (const node of nodes.values()) {
    if (node.parentIdentity === undefined) roots.push(node.identity);
    else {
      const parent = nodes.get(node.parentIdentity);
      if (parent === undefined) return fail('missing-parent', 'Every non-root hierarchy node must reference a supplied parent.');
      parent.children.push(node.identity);
    }
  }
  roots.sort();
  for (const node of nodes.values()) node.children.sort();
  // Compute depth iteratively with a recursion-stack set so cycles and depth are
  // rejected before a renderer can expose any partial geometry.
  const visiting = new Set<string>();
  const finished = new Set<string>();
  const visit = (identity: string, depth: number): Outcome<true> => {
    const node = nodes.get(identity); if (node === undefined) return fail('identity', 'A hierarchy node reference is unavailable.');
    if (visiting.has(identity)) return fail('cycle', 'Hierarchy parent keys contain a cycle.');
    if (finished.has(identity)) return {ok: true, value: true};
    if (depth > maxDepth) return fail('depth', `Hierarchy depth exceeds the ${maxDepth} level bound.`);
    visiting.add(identity); node.depth = depth;
    for (const child of node.children) {const checked = visit(child, depth + 1); if (!checked.ok) return checked;}
    visiting.delete(identity); finished.add(identity); return {ok: true, value: true};
  };
  for (const root of roots) {const checked = visit(root, 0); if (!checked.ok) return checked;}
  if (finished.size !== nodes.size) return fail('cycle', 'Hierarchy parent keys contain a cycle or disconnected component.');
  let deepest = 0; for (const node of nodes.values()) deepest = Math.max(deepest, node.depth);
  return {ok: true, value: {nodes, roots, maxDepth: deepest}};
}

function treeLayout(nodes: Map<string, CheckedNode>, width: number, height: number): readonly HierarchyNodeGeometry[] {
  const pad = 16;
  const levels = new Map<number, CheckedNode[]>();
  for (const node of [...nodes.values()].sort((left, right) => left.depth - right.depth || compareIdentity(left.identity, right.identity))) {const list = levels.get(node.depth) ?? []; list.push(node); levels.set(node.depth, list);}
  const maxLevel = Math.max(0, ...levels.keys());
  const levelHeight = Math.max(1, Math.min(64, (height - pad * 2) / Math.max(1, maxLevel + 1)));
  const output: HierarchyNodeGeometry[] = [];
  for (const [depth, list] of levels) {
    const gap = 2; const cellWidth = Math.max(1, (width - pad * 2 - gap * Math.max(0, list.length - 1)) / Math.max(1, list.length));
    list.forEach((node, index) => output.push({identity: node.identity, rowIdentity: node.row.identity, label: node.label, ...(node.parentIdentity === undefined ? {} : {parentIdentity: node.parentIdentity}), depth, children: Object.freeze([...node.children]), x: pad + index * (cellWidth + gap), y: pad + depth * levelHeight, width: cellWidth, height: Math.max(1, levelHeight - 2), leaf: node.children.length === 0}));
  }
  return Object.freeze(output);
}

interface TreemapLayoutResult {
  readonly state: 'geometry' | 'data-only';
  readonly reason?: string;
  readonly nodes: readonly HierarchyNodeGeometry[];
}

function treemapLayout(nodes: Map<string, CheckedNode>, roots: readonly string[], width: number, height: number): TreemapLayoutResult {
  const subtreeWeights = new Map<string, ExactWeight>();
  const computeSubtreeWeight = (identity: string): ExactWeight => {
    const cached = subtreeWeights.get(identity);
    if (cached !== undefined) return cached;
    const node = nodes.get(identity)!;
    let total = node.children.length === 0 ? (node.weight ?? ZERO_WEIGHT) : ZERO_WEIGHT;
    for (const child of node.children) total = addWeights(total, computeSubtreeWeight(child));
    subtreeWeights.set(identity, total);
    return total;
  };
  for (const root of roots) computeSubtreeWeight(root);

  const numericValues = new Map<string, number>();
  for (const node of nodes.values()) {
    const value = weightAsNumber(node.weight ?? ZERO_WEIGHT);
    if (value === undefined) return {state: 'data-only', reason: 'A treemap value is outside the safe floating-point geometry range. Exact values remain available in the data table.', nodes: Object.freeze([])};
    numericValues.set(node.identity, value);
  }

  const boxes = new Map<string, {x: number; y: number; width: number; height: number}>();
  let unsafeRatio = false;
  const place = (children: readonly string[], x: number, y: number, w: number, h: number, depth: number): void => {
    if (unsafeRatio || children.length === 0) return;
    const total = children.reduce((sum, child) => addWeights(sum, subtreeWeights.get(child) ?? ZERO_WEIGHT), ZERO_WEIGHT);
    const rawRatios = children.map(child => ratioAsNumber(subtreeWeights.get(child) ?? ZERO_WEIGHT, total));
    if (rawRatios.some(ratio => ratio === undefined)) {
      unsafeRatio = true;
      return;
    }
    const definedRatios = rawRatios.map(ratio => ratio ?? 0);
    const ratioTotal = definedRatios.reduce((sum, ratio) => sum + ratio, 0);
    if (!Number.isFinite(ratioTotal) || (ratioTotal === 0 && total.coefficient !== 0n)) {
      unsafeRatio = true;
      return;
    }
    // Leading-digit conversion is intentionally bounded, so normalize the
    // representable ratios once per sibling set to keep cumulative rounding
    // from creating overlap or a negative final remainder.
    const ratios = ratioTotal === 0 ? definedRatios.map(() => 0) : definedRatios.map(ratio => ratio / ratioTotal);
    const positive = ratios.map((ratio, index) => ratio !== 0 ? index : -1).filter(index => index >= 0);
    const horizontal = depth % 2 === 0;
    const extentLimit = horizontal ? w : h;
    let cursor = 0;
    children.forEach((identity, index) => {
      const ratio = ratios[index]!;
      let extent = 0;
      if (ratio > 0) {
        const lastPositive = index === positive[positive.length - 1];
        extent = lastPositive ? extentLimit - cursor : extentLimit * ratio;
        if (!Number.isFinite(extent) || extent <= 0) {
          unsafeRatio = true;
          return;
        }
      }
      const cw = horizontal ? extent : w;
      const ch = horizontal ? h : extent;
      const childX = horizontal ? x + cursor : x;
      const childY = horizontal ? y : y + cursor;
      boxes.set(identity, {x: childX, y: childY, width: Math.max(0, cw), height: Math.max(0, ch)});
      const node = nodes.get(identity)!;
      if (node.children.length > 0) place(node.children, childX, childY, cw, ch, depth + 1);
      cursor += extent;
    });
  };
  place(roots, 0, 0, width, height, 0);
  if (unsafeRatio) return {state: 'data-only', reason: 'A positive treemap weight cannot be represented safely in bounded geometry. Exact values remain available in the data table.', nodes: Object.freeze([])};

  const output: HierarchyNodeGeometry[] = [];
  for (const node of [...nodes.values()].sort((left, right) => left.depth - right.depth || compareIdentity(left.identity, right.identity))) {
    const box = boxes.get(node.identity);
    if (box === undefined) return {state: 'data-only', reason: 'Treemap geometry could not cover every authorized node. Exact values remain available in the data table.', nodes: Object.freeze([])};
    output.push({identity: node.identity, rowIdentity: node.row.identity, label: node.label, ...(node.parentIdentity === undefined ? {} : {parentIdentity: node.parentIdentity}), depth: node.depth, children: Object.freeze([...node.children]), x: box.x, y: box.y, width: box.width, height: box.height, value: numericValues.get(node.identity) ?? 0, leaf: node.children.length === 0});
  }
  return {state: 'geometry', nodes: Object.freeze(output)};
}

export function compileTreeGeometry(inputs: VisualizationInputs, options: HierarchyGeometryOptions = {}): Outcome<HierarchyGeometry> {
  const prepared = prepareHierarchy(inputs, 'tree', options); if (!prepared.ok) return prepared;
  const checked = checkedHierarchyNodes(prepared.value.prepared, 'tree', prepared.value.dimensions.maxDepth); if (!checked.ok) return checked;
  const nodes = treeLayout(checked.value.nodes, prepared.value.dimensions.width, prepared.value.dimensions.height);
  if (nodes.length > prepared.value.dimensions.maxMarks || nodes.some(node=>node.width<24||node.height<24||node.x+node.width>prepared.value.dimensions.width||node.y+node.height>prepared.value.dimensions.height)) return {ok: true, value: Object.freeze({kind: 'tree', state: 'data-only', reason: 'The hierarchy exceeds the configured mark budget or readable graphic density. Exact values remain available in the data table.', bound: prepared.value.prepared.bound, result: prepared.value.prepared.result, rows: prepared.value.prepared.rows, nodes: Object.freeze([]), width: prepared.value.dimensions.width, height: prepared.value.dimensions.height, maxDepth: checked.value.maxDepth})};
  return {ok: true, value: Object.freeze({kind: 'tree', state: 'geometry', bound: prepared.value.prepared.bound, result: prepared.value.prepared.result, rows: prepared.value.prepared.rows, nodes, width: prepared.value.dimensions.width, height: prepared.value.dimensions.height, maxDepth: checked.value.maxDepth})};
}

export function compileTreemapGeometry(inputs: VisualizationInputs, options: HierarchyGeometryOptions = {}): Outcome<HierarchyGeometry> {
  const prepared = prepareHierarchy(inputs, 'treemap', options); if (!prepared.ok) return prepared;
  const checked = checkedHierarchyNodes(prepared.value.prepared, 'treemap', prepared.value.dimensions.maxDepth); if (!checked.ok) return checked;
  const layout = treemapLayout(checked.value.nodes, checked.value.roots, prepared.value.dimensions.width, prepared.value.dimensions.height);
  if (layout.state === 'data-only' || layout.nodes.length > prepared.value.dimensions.maxMarks || layout.nodes.some(node=>node.width>0&&node.height>0&&(node.width<24||node.height<24))) return {ok: true, value: Object.freeze({kind: 'treemap', state: 'data-only', reason: layout.reason ?? 'The treemap exceeds the configured mark budget or readable graphic density. Exact values remain available in the data table.', bound: prepared.value.prepared.bound, result: prepared.value.prepared.result, rows: prepared.value.prepared.rows, nodes: Object.freeze([]), width: prepared.value.dimensions.width, height: prepared.value.dimensions.height, maxDepth: checked.value.maxDepth, leafValuePolicy: 'leaf-only'})};
  return {ok: true, value: Object.freeze({kind: 'treemap', state: 'geometry', bound: prepared.value.prepared.bound, result: prepared.value.prepared.result, rows: prepared.value.prepared.rows, nodes: layout.nodes, width: prepared.value.dimensions.width, height: prepared.value.dimensions.height, maxDepth: checked.value.maxDepth, leafValuePolicy: 'leaf-only'})};
}

function endpointKey(values: Readonly<Record<string, Scalar>>, fields: readonly {readonly id: string; readonly type: SemanticType}[]): Outcome<string> {
  const key = keyFor(values, fields, false); if (!key.ok) return key;
  return key.value === undefined ? fail('relationship-endpoint', 'Relationship endpoint identities must be non-null.') : {ok: true, value: key.value};
}

function endpointLabel(values: Readonly<Record<string, Scalar>>, fields: readonly {readonly id: string; readonly type: SemanticType}[]): string {
  return fields.map(field => labelFor(values, field, 'Missing')).join(', ');
}

export function compileRelationshipGeometry(inputs: VisualizationInputs, options: HierarchyGeometryOptions = {}): Outcome<RelationshipGeometry> {
  const checked = bindForView(inputs, 'relationship'); if (!checked.ok) return checked;
  const spec = checked.value.bound.spec; if (spec.view !== 'relationship') return fail('view', 'Expected a relationship visualization specification.');
  const sourceFields = fieldsFor(checked.value.result, spec.source); if (!sourceFields.ok) return sourceFields;
  const targetFields = fieldsFor(checked.value.result, spec.target); if (!targetFields.ok) return targetFields;
  const dimensions = optionsFor(inputs, options); const budget = validateGeometryBudget(dimensions.width, dimensions.height, dimensions.maxMarks); if (!budget.ok) return budget;
  if (checked.value.rows.length > MAX_ROWS || checked.value.rows.length * checked.value.result.fields.length > MAX_WORK) return fail('budget', 'The authorized relationship rows exceed the bounded materialization work budget.');
  const relation = checked.value.bound.relationship; if (relation === undefined) return fail('relationship', 'The authorized relationship is unavailable.');
  const sourceCounts = new Map<string, Set<string>>(); const targetCounts = new Map<string, Set<string>>(); const edgePairs = new Set<string>();
  const edges: RelationshipEdgeGeometry[] = []; const sourceNodes = new Map<string, RelationshipNodeGeometry>(); const targetNodes = new Map<string, RelationshipNodeGeometry>();
  const labelField = spec.label === undefined ? undefined : checked.value.result.fields.find(field => field.id === spec.label);
  for (const row of checked.value.rows) {
    const source = endpointKey(row.values, sourceFields.value); if (!source.ok) return source;
    const target = endpointKey(row.values, targetFields.value); if (!target.ok) return target;
    const sourceId = `source:${source.value}`; const targetId = `target:${target.value}`;
    const sourceText = endpointLabel(row.values, sourceFields.value); const targetText = endpointLabel(row.values, targetFields.value);
    if (!sourceNodes.has(sourceId)) sourceNodes.set(sourceId, {identity: sourceId, namespace: 'source', label: sourceText, x: 0, y: 0});
    if (!targetNodes.has(targetId)) targetNodes.set(targetId, {identity: targetId, namespace: 'target', label: targetText, x: 0, y: 0});
    const pair = `${source.value}\u0000${target.value}`;
    if (relation.cardinality !== 'many-to-many' && edgePairs.has(pair)) return fail('cardinality', 'The materialized relationship repeats an edge under a unique endpoint cardinality.');
    edgePairs.add(pair);
    const sourceTargets = sourceCounts.get(source.value) ?? new Set<string>(); sourceTargets.add(target.value); sourceCounts.set(source.value, sourceTargets);
    const targetSources = targetCounts.get(target.value) ?? new Set<string>(); targetSources.add(source.value); targetCounts.set(target.value, targetSources);
    edges.push({identity: row.identity, source: sourceId, target: targetId, sourceLabel: sourceText, targetLabel: targetText, ...(labelField === undefined ? {} : {label: labelFor(row.values, {id: labelField.id, type: labelField.type}, '')})});
  }
  if (relation.cardinality === 'one-to-one' && ([...sourceCounts.values()].some(targets => targets.size > 1) || [...targetCounts.values()].some(sources => sources.size > 1))) return fail('cardinality', 'The materialized relationship violates one-to-one cardinality.');
  if (relation.cardinality === 'many-to-one' && [...sourceCounts.values()].some(targets => targets.size > 1)) return fail('cardinality', 'The materialized relationship violates many-to-one cardinality.');
  if (relation.cardinality === 'one-to-many' && [...targetCounts.values()].some(sources => sources.size > 1)) return fail('cardinality', 'The materialized relationship violates one-to-many cardinality.');
  if (sourceNodes.size > MAX_GROUPS || targetNodes.size > MAX_GROUPS) return {ok: true, value: Object.freeze({kind: 'relationship', state: 'data-only', reason: `Relationship endpoint groups exceed the ${MAX_GROUPS} group bound. Exact values remain available in the data table.`, bound: checked.value.bound, result: checked.value.result, rows: checked.value.rows, nodes: Object.freeze([]), edges: Object.freeze([]), width: dimensions.width, height: dimensions.height, cardinality: relation.cardinality})};
  const arrange = (values: readonly RelationshipNodeGeometry[], x: number): readonly RelationshipNodeGeometry[] => {const gap = values.length > 1 ? (dimensions.height - 88) / (values.length - 1) : 0; return values.map((node, index) => ({...node, x, y: 72 + index * gap}));};
  const sourceList = [...sourceNodes.values()].sort((left, right) => compareIdentity(left.identity, right.identity));
  const targetList = [...targetNodes.values()].sort((left, right) => compareIdentity(left.identity, right.identity));
  const nodes = Object.freeze([...arrange(sourceList, dimensions.width * 0.25), ...arrange(targetList, dimensions.width * 0.75)]);
  if (edges.length + nodes.length > dimensions.maxMarks || Math.max(sourceList.length,targetList.length)>Math.floor((dimensions.height-88)/24)+1) return {ok: true, value: Object.freeze({kind: 'relationship', state: 'data-only', reason: 'The relationship exceeds the configured mark budget or readable graphic density. Exact values remain available in the data table.', bound: checked.value.bound, result: checked.value.result, rows: checked.value.rows, nodes: Object.freeze([]), edges: Object.freeze([]), width: dimensions.width, height: dimensions.height, cardinality: relation.cardinality})};
  return {ok: true, value: Object.freeze({kind: 'relationship', state: 'geometry', bound: checked.value.bound, result: checked.value.result, rows: checked.value.rows, nodes, edges: Object.freeze(edges), width: dimensions.width, height: dimensions.height, cardinality: relation.cardinality})};
}

export function compileHierarchyVisualization(inputs: VisualizationInputs, options: HierarchyGeometryOptions = {}): Outcome<HierarchyVisualizationGeometry> {
  const view = inputs.visualization?.view;
  if (view === 'tree') return compileTreeGeometry(inputs, options);
  if (view === 'treemap') return compileTreemapGeometry(inputs, options);
  if (view === 'relationship') return compileRelationshipGeometry(inputs, options);
  return fail('view', 'The hierarchy surface requires a tree, treemap or relationship specification.');
}

export const compileTree = compileTreeGeometry;
export const compileTreemap = compileTreemapGeometry;
export const compileRelationship = compileRelationshipGeometry;
