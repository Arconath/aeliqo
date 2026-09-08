import {parseWireValue, validatePresentationPlan, type Outcome, type PresentationPlan, type VersionRef} from '@aeliqo/core';
import type {
  AeliqoBreakdownRecipeInput, AeliqoComparisonRecipeInput, AeliqoCompoundRecipe, AeliqoCompoundRecipeInput,
  AeliqoExplorerRecipeInput, AeliqoFormFlowRecipeInput, AeliqoInvestigationRecipeInput, AeliqoQualityPanelRecipeInput,
  AeliqoRecordEditorRecipeInput, AeliqoSearchResultsRecipeInput,
} from './types.js';

/** Macro names are authoring identifiers. They are not invented renderer registrations. */
export const AELIQO_COMPOUND_REFS = Object.freeze({
  explorer: {id: 'compound.explorer', revision: '1'}, comparison: {id: 'compound.comparison', revision: '1'},
  breakdown: {id: 'compound.breakdown', revision: '1'}, investigation: {id: 'compound.investigation', revision: '1'},
  searchResults: {id: 'compound.search-results', revision: '1'}, recordEditor: {id: 'compound.record-editor', revision: '1'},
  formFlow: {id: 'compound.form-flow', revision: '1'}, qualityPanel: {id: 'compound.quality-panel', revision: '1'},
} satisfies Record<string, VersionRef>);
const failure = (message: string): Outcome<AeliqoCompoundRecipe> => ({ok: false, diagnostics: [{code: 'web.compound.recipe', message, retryable: false}]});
const required = {
  explorer: [['control.filter-builder'], ['data.record-list', 'data.card-collection', 'data.table'], ['data.detail']],
  comparison: [['data.table', 'visualization.matrix']],
  breakdown: [['data.metric'], ['data.table', 'data.record-list']],
  investigation: [['visualization.trend'], ['visualization.timeline'], ['data.detail']],
  searchResults: [['input.search-field'], ['data.record-list', 'data.card-collection', 'data.table']],
  recordEditor: [['input.form']],
  formFlow: [['input.form']],
  qualityPanel: [['data.detail', 'data.key-value', 'foundation.text']],
} as const;

function build(input: AeliqoCompoundRecipeInput, kind: keyof typeof required): Outcome<AeliqoCompoundRecipe> {
  if (!input || !input.validation || !Array.isArray(input.parts) || input.parts.length === 0 || input.parts.length > 64)
    return failure('A compound recipe requires configured primitive nodes and the canonical validation context.');
  const checked = parseWireValue({id: input.id, revision: input.revision, preconditions: input.preconditions, nodes: input.parts,
    links: input.links ?? [], coverage: input.coverage ?? [], stateTransfer: input.stateTransfer ?? []});
  if (!checked.ok) return failure('Compound recipe input must be bounded wire data.');
  const copied = checked.value as unknown as Pick<PresentationPlan, 'id' | 'revision' | 'preconditions' | 'nodes' | 'links' | 'coverage' | 'stateTransfer'>;
  if (copied.nodes.some(node => !node || typeof node !== 'object' || !node.representation || typeof node.representation !== 'object' || !Array.isArray(node.children)))
    return failure('A compound primitive node is malformed.');
  for (const alternatives of required[kind]) {
    if (!copied.nodes.some(node => alternatives.some(ref => node.representation.id === ref))) return failure(`The ${kind} recipe is missing a required primitive.`);
  }
  const rootId = `${input.id}:compound-root`;
  if (copied.nodes.some(node => node.id === rootId)) return failure('The compound root identity conflicts with a supplied primitive.');
  const contained = new Set(copied.nodes.flatMap(node => node.children));
  const childIds = copied.nodes.filter(node => !contained.has(node.id)).map(node => node.id);
  const plan: PresentationPlan = {...copied, rootId, nodes: [{id: rootId, role: 'structure', representation: {id: 'layout.stack', revision: '1'},
    config: {schema: {id: 'layout.stack.config', revision: '1'}, values: {}}, children: childIds}, ...copied.nodes], diagnostics: []};
  // Actual task needs, exact results, operation coverage, mappings, registered
  // configuration and experience restrictions are all checked by the shared pass.
  const validated = validatePresentationPlan(plan, input.validation.context, input.validation.registry);
  if (!validated.ok) return validated;
  return {ok: true, value: Object.freeze({plan: validated.value.plan, childIds: Object.freeze(childIds)})};
}
export const explorerPresentationRecipe = (input: AeliqoExplorerRecipeInput): Outcome<AeliqoCompoundRecipe> => build(input, 'explorer');
export const comparisonPresentationRecipe = (input: AeliqoComparisonRecipeInput): Outcome<AeliqoCompoundRecipe> => build(input, 'comparison');
export const breakdownPresentationRecipe = (input: AeliqoBreakdownRecipeInput): Outcome<AeliqoCompoundRecipe> => build(input, 'breakdown');
export const investigationPresentationRecipe = (input: AeliqoInvestigationRecipeInput): Outcome<AeliqoCompoundRecipe> => build(input, 'investigation');
export const searchResultsPresentationRecipe = (input: AeliqoSearchResultsRecipeInput): Outcome<AeliqoCompoundRecipe> => build(input, 'searchResults');
export const recordEditorPresentationRecipe = (input: AeliqoRecordEditorRecipeInput): Outcome<AeliqoCompoundRecipe> => build(input, 'recordEditor');
export const formFlowPresentationRecipe = (input: AeliqoFormFlowRecipeInput): Outcome<AeliqoCompoundRecipe> => build(input, 'formFlow');
export const qualityPanelPresentationRecipe = (input: AeliqoQualityPanelRecipeInput): Outcome<AeliqoCompoundRecipe> => build(input, 'qualityPanel');
export const compoundRecipeHelpers = Object.freeze({explorerPresentationRecipe, comparisonPresentationRecipe, breakdownPresentationRecipe, investigationPresentationRecipe, searchResultsPresentationRecipe, recordEditorPresentationRecipe, formFlowPresentationRecipe, qualityPanelPresentationRecipe});
