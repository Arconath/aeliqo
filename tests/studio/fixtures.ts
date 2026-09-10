import {createStandardFunctionRegistry, type Catalog, type Experience} from '@aeliqo/sdk-core';
import {createStudioDocument, type StudioDocument} from '../../packages/devtools/src/index.js';

const functions = createStandardFunctionRegistry('studio-test-functions');
if (!functions.ok) throw new Error('Studio function registry fixture failed.');
export const registry = functions.value;

export const catalog: Catalog = {
  version: '1', revision: 'studio-catalog-1', functionRegistryDigest: registry.digest,
  entities: [{id: 'employees', label: 'Employees', identity: ['id'], rowGrain: ['id'], fields: [
    {id: 'id', label: 'ID', role: 'identity', type: {value: 'text', nullable: false}},
    {id: 'name', label: 'Name', role: 'attribute', type: {value: 'text', nullable: false}},
    {id: 'amount', label: 'Amount', role: 'measure', type: {value: 'integer', nullable: false}},
  ]}], relationships: [], meanings: [], capabilities: [],
};

export const experience: Experience = {
  version: '1', id: 'employees-profile', revision: '1', mode: 'adaptive', agentAllowed: false,
  allowedRepresentations: ['table', 'metric'], allowedPatterns: ['record-inspection'],
  composition: {allowWithoutPreset: true, maxNodes: 16, maxExpansions: 16}, requiredOperations: [],
  tokenProfile: {id: 'tokens.aeliqo', revision: '1'}, extensionAllowlist: [], transitionPolicy: 'stable',
};

export const input = {
  version: '1' as const,
  id: 'studio-demo',
  revision: 'studio-demo-1',
  catalog,
  meanings: [],
  profiles: [{label: 'Employee records', source: {surface: 'code' as const, ownership: 'code' as const, readOnly: true}, experience}],
  activeProfile: {id: experience.id, revision: experience.revision},
  tokens: {profile: {id: 'tokens.aeliqo', revision: '1'}, theme: 'light' as const},
};

export function document(): StudioDocument {
  const result = createStudioDocument(input, {registry});
  if (!result.ok) throw new Error(result.diagnostics[0]!.message);
  return result.value;
}
