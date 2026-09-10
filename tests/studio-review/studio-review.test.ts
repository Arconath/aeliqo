import {describe, expect, it} from 'vitest';
import {createStudioDocument, createStudioSession} from '../../packages/devtools/src/index.js';
import {createMeaningAuthoring, meaningDigest} from '@aeliqo/sdk-runtime/meaning';
import {catalog, document, input, registry} from '../studio/fixtures.js';

function catalogWithEntity(entity: string, revision: string) {
  return {
    ...catalog,
    revision,
    entities: [{...catalog.entities[0]!, id: entity, label: entity[0]!.toUpperCase() + entity.slice(1)}],
  };
}

function meaningDraftsInOrder() {
  const authoring = createMeaningAuthoring({catalog, registry});
  expect(authoring.ok).toBe(true);
  if (!authoring.ok) throw new Error(authoring.diagnostics[0]!.message);
  const field = authoring.value.field('employees', 'amount');
  expect(field.ok).toBe(true);
  if (!field.ok) throw new Error(field.diagnostics[0]!.message);
  const expression = authoring.value.call({id: 'core.aggregate.sum', revision: '1'}, [field]);
  expect(expression.ok).toBe(true);
  if (!expression.ok) throw new Error(expression.diagnostics[0]!.message);
  const base = authoring.value.defineMeaning({id: 'employees.base', label: 'Base', description: 'Base amount.', expression});
  expect(base.ok).toBe(true);
  if (!base.ok) throw new Error(base.diagnostics[0]!.message);
  const withBase = createMeaningAuthoring({catalog, registry, definitions: [base.value.meaning]});
  expect(withBase.ok).toBe(true);
  if (!withBase.ok) throw new Error(withBase.diagnostics[0]!.message);
  const dependent = withBase.value.draft({
    ...base.value.meaning,
    id: 'employees.dependent',
    label: 'Dependent',
    explanation: 'Dependent amount.',
    implementation: {kind: 'expression', expression: {kind: 'definition', ref: {id: 'employees.base', revision: '1'}}},
    dependencies: [{id: 'employees.base', revision: '1'}],
  }, {source: {surface: 'studio', ownership: 'personal'}, assumptions: []});
  const baseDraft = withBase.value.draft(base.value.meaning, {source: {surface: 'studio', ownership: 'personal'}, assumptions: []});
  expect(dependent.ok).toBe(true);
  expect(baseDraft.ok).toBe(true);
  if (!dependent.ok || !baseDraft.ok) throw new Error('DAG fixture could not be constructed.');
  return {dependent: dependent.value, base: baseDraft.value};
}

describe('T26 Studio independent boundary review', () => {
  it('rebuilds meaning validation after importing a different catalog', () => {
    const session = createStudioSession(document(), {registry});
    const imported = createStudioDocument({
      ...input,
      id: 'studio-imported-catalog',
      revision: 'studio-imported-catalog-1',
      catalog: catalogWithEntity('projects', 'studio-catalog-2'),
      profiles: [{...input.profiles[0]!, experience: {...input.profiles[0]!.experience, id: 'project-profile'}}],
      activeProfile: {id: 'project-profile', revision: '1'},
    }, {registry});
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(session.importDocument(imported.value).ok).toBe(true);
    const draft = session.defineMeaning({id: 'projects.total', label: 'Total amount', description: 'Sum of project amounts.', entity: 'projects', field: 'amount'});
    expect(draft.ok).toBe(true);
  });

  it('rejects a changed canonical definition for an accepted immutable ID/revision', () => {
    // `StudioSession.defineMeaning` must reject caller-declared provenance.
    // Construct this code-owned fixture through the canonical host authoring
    // path instead, which is the trusted route for a code bundle.
    const hostAuthoring = createMeaningAuthoring({catalog, registry});
    expect(hostAuthoring.ok).toBe(true);
    if (!hostAuthoring.ok) return;
    const field = hostAuthoring.value.field('employees' as never, 'amount' as never);
    expect(field.ok).toBe(true);
    if (!field.ok) return;
    const defined = hostAuthoring.value.defineMeaning({id: 'employees.total', label: 'Total amount', description: 'Sum of employee amounts.', expression: field});
    expect(defined.ok).toBe(true);
    if (!defined.ok) return;
    const codeDraft = hostAuthoring.value.draft(defined.value.meaning, {source: {surface: 'code', ownership: 'code', readOnly: true}, assumptions: []});
    expect(codeDraft.ok).toBe(true);
    if (!codeDraft.ok) return;
    const codeDocument = createStudioDocument({...input, revision: 'studio-demo-code-1', meanings: [codeDraft.value]}, {registry});
    expect(codeDocument.ok).toBe(true);
    if (!codeDocument.ok) return;
    const first = codeDocument.value;
    const session = createStudioSession(document(), {registry});
    expect(session.importDocument(first).ok).toBe(true);
    const altered = {...codeDraft.value.meaning, label: 'Hacked canonical meaning'};
    const changed = {...first, revision: 'studio-imported-altered', meanings: [{...codeDraft.value, meaning: altered, digest: meaningDigest(altered)}]};
    const imported = session.importDocument(changed);
    expect(imported.ok).toBe(false);
    if (!imported.ok) expect(imported.diagnostics[0]!.code).toBe('studio.meaning-conflict');
  });

  it('accepts a valid dependency DAG regardless of draft array order', () => {
    const {dependent, base} = meaningDraftsInOrder();
    const reversed = createStudioDocument({...input, meanings: [dependent, base]}, {registry});
    expect(reversed.ok).toBe(true);
  });

  it('fails closed for forged source provenance and malformed public calls', () => {
    const session = createStudioSession(document(), {registry});
    const forged = session.defineMeaning({id: 'employees.forged', label: 'Forged', description: 'Untrusted source claim.', entity: 'employees', field: 'amount', source: {surface: 'code', ownership: 'code', readOnly: true}});
    expect(forged.ok).toBe(false);
    expect(() => session.defineMeaning(null as never)).not.toThrow();
    const malformed = session.defineMeaning(null as never);
    expect(malformed.ok).toBe(false);
    expect(() => session.setActiveProfile(null as never)).not.toThrow();
    const invalidProfile = session.setActiveProfile(null as never);
    expect(invalidProfile.ok).toBe(false);
  });

  it('rejects invalid runtime setter values without mutating the document', () => {
    const session = createStudioSession(document(), {registry});
    const before = session.getState();
    expect(session.selectArea('bogus').ok).toBe(false);
    expect(session.setTheme('purple').ok).toBe(false);
    expect(session.setPreviewState('bogus').ok).toBe(false);
    expect(session.getState().area).toBe(before.area);
    expect(session.getState().document).toEqual(before.document);
    expect(session.getState().dirty).toBe(false);
  });
});
