import {describe, expect, it} from 'vitest';
import {createStudioDocument, createStudioSession, parseStudioDocument} from '../../packages/devtools/src/index.js';
import {createMeaningAuthoring, meaningDigest} from '../../packages/runtime/src/meaning/index.js';
import type {QuerySource} from '@aeliqo/core';
import {catalog, document, input, registry} from './fixtures.js';

describe('local Studio document and session', () => {
  it('exports and imports the same canonical document without a second format', () => {
    const session = createStudioSession(document(), {registry});
    const exported = session.exportDocument();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const imported = parseStudioDocument(exported.value, {registry});
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value).toEqual(session.getState().document);
    expect(exported.value).not.toContain('credential');
    const code = session.exportCode();
    expect(code.ok).toBe(true);
    if (code.ok) expect(code.value).toContain('export const studioDocument =');
  });

  it('supports manual meaning authoring and keeps code-owned entries inspectable', () => {
    const session = createStudioSession(document(), {registry});
    const draft = session.defineMeaning({id: 'employees.total', label: 'Total amount', description: 'Sum of employee amounts.', entity: 'employees', field: 'amount'});
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    expect(draft.value.source.ownership).toBe('personal');
    expect(session.getState().dirty).toBe(true);
    expect(session.inspect()).toMatchObject({sourceOfTruth: 'studio-draft', studioOwnedCount: 1});
    session.selectMeaning({id: draft.value.meaning.id, revision: draft.value.meaning.revision});
    expect(session.getState().selectedMeaning).toEqual({id: 'employees.total', revision: '1'});
  });

  it('evaluates a local meaning through the bounded typed query path', () => {
    const session = createStudioSession(document(), {registry});
    const draft = session.defineMeaning({id: 'employees.total', label: 'Total amount', description: 'Sum of employee amounts.', entity: 'employees', field: 'amount'});
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const source: QuerySource = {revision: 'studio-source-1', catalogRevision: catalog.revision, relations: {employees: {entity: 'employees', complete: true, rows: [{id: 'ada', name: 'Ada', amount: 42}, {id: 'grace', name: 'Grace', amount: 37}]}}};
    const result = session.evaluateMeaning({meaning: draft.value.meaning, entity: 'employees', source});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.rows).toEqual([{'employees.total': 79}]);
  });

  it('edits a validated Experience into a new personal revision', () => {
    const session = createStudioSession(document(), {registry});
    const base = session.getState().document.profiles[0]!.experience;
    const edited = session.editExperience({base, label: 'Compact employee inspection', experience: {...base, revision: '2', mode: 'fixed'}});
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.value.source).toEqual({surface: 'studio', ownership: 'personal'});
    expect(edited.value.experience.mode).toBe('fixed');
    expect(session.getState().document.activeProfile).toEqual({id: base.id, revision: '2'});
    const codeSession = createStudioSession(document(), {registry});
    const readOnly = codeSession.editExperience({base, label: 'Code mutation', experience: {...base, mode: 'fixed'}});
    expect(readOnly.ok).toBe(false);
    if (!readOnly.ok) expect(readOnly.diagnostics[0]!.code).toBe('studio.experience-read-only');
  });

  it('applies an explicit meaning diff only as a new revision and rejects a stale base', () => {
    const session = createStudioSession(document(), {registry});
    const draft = session.defineMeaning({id: 'employees.total', label: 'Total amount', description: 'Sum of employee amounts.', entity: 'employees', field: 'amount'});
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const candidate = {...draft.value.meaning, revision: '2', label: 'Revised total'};
    const proposed = session.proposeMeaningDiff(draft.value.meaning, candidate);
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    const applied = session.applyMeaningDiff(proposed.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.meaning.revision).toBe('2');
    const sameRevision = session.applyMeaningDiff(proposed.value);
    expect(sameRevision.ok).toBe(true);
    expect(session.getState().document.meanings.filter((entry) => entry.meaning.id === 'employees.total')).toHaveLength(2);
  });

  it('rejects conflicting immutable definitions and invalid active profiles', () => {
    const conflict = createStudioDocument({...input, meanings: [{
      version: '1', meaning: {
        id: 'employees.total', revision: '1', label: 'One', explanation: 'One',
        output: {value: 'integer', nullable: false}, implementation: {kind: 'host-capability', capability: {id: 'total', revision: '1'}},
        dependencies: [], functionRegistryDigest: registry.digest, origin: 'manual', lifecycle: 'draft', scope: 'session', authority: 'hypothesis', aggregation: 'sum', aggregationDimensions: [], missingPolicy: 'propagate',
      }, source: {surface: 'studio', ownership: 'personal'}, digest: 'wrong', assumptions: [],
    }]}, {registry});
    expect(conflict.ok).toBe(false);
    const session = createStudioSession(document(), {registry});
    const invalid = session.setActiveProfile({id: 'missing', revision: '1'});
    expect(invalid.ok).toBe(false);
    expect(session.getState().document.activeProfile).toEqual({id: 'employees-profile', revision: '1'});
  });

  it('does not silently replace a previously seen document revision', () => {
    const session = createStudioSession(document(), {registry});
    const changed = JSON.stringify({...input, tokens: {...input.tokens, theme: 'dark'}});
    const imported = session.importDocument(changed);
    expect(imported.ok).toBe(false);
    if (!imported.ok) expect(imported.diagnostics[0]!.code).toBe('studio.source-conflict');
    expect(session.getState().diagnostics[0]!.code).toBe('studio.source-conflict');
  });

  it('does not accept caller-declared code provenance and handles malformed inputs as diagnostics', () => {
    const session = createStudioSession(document(), {registry});
    const forged = session.defineMeaning({id: 'employees.forged', label: 'Forged', description: 'Forged provenance.', entity: 'employees', field: 'amount', source: {surface: 'code', ownership: 'code', readOnly: true}});
    expect(forged.ok).toBe(false);
    if (!forged.ok) expect(forged.diagnostics[0]!.code).toBe('studio.meaning-source-untrusted');
    expect(() => session.defineMeaning(null as never)).not.toThrow();
    expect(session.defineMeaning(null as never).ok).toBe(false);
    expect(() => session.setActiveProfile(null as never)).not.toThrow();
    expect(session.setActiveProfile(null as never).ok).toBe(false);
  });

  it('rebuilds meaning validation when an import switches catalogs', () => {
    const session = createStudioSession(document(), {registry});
    const importedInput = {
      ...input,
      id: 'studio-imported',
      revision: 'studio-imported-1',
      catalog: {
        ...catalog,
        revision: 'studio-catalog-2',
        entities: [{...catalog.entities[0]!, id: 'projects', label: 'Projects'}],
      },
      profiles: [{...input.profiles[0]!, experience: {...input.profiles[0]!.experience, id: 'project-profile'}}],
      activeProfile: {id: 'project-profile', revision: '1'},
    };
    const imported = session.importDocument(importedInput);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    const draft = session.defineMeaning({id: 'projects.total', label: 'Total amount', description: 'Sum of project amounts.', entity: 'projects', field: 'amount'});
    expect(draft.ok).toBe(true);
  });

  it('keeps an immutable meaning ledger across accepted document revisions', () => {
    const authoring = createMeaningAuthoring({catalog, registry});
    expect(authoring.ok).toBe(true);
    if (!authoring.ok) return;
    const field = authoring.value.field('employees', 'amount');
    expect(field.ok).toBe(true);
    if (!field.ok) return;
    const defined = authoring.value.defineMeaning({id: 'employees.total', label: 'Total amount', description: 'Sum of employee amounts.', expression: field});
    expect(defined.ok).toBe(true);
    if (!defined.ok) return;
    const codeDraft = authoring.value.draft(defined.value.meaning, {source: {surface: 'code', ownership: 'code', readOnly: true}, assumptions: []});
    expect(codeDraft.ok).toBe(true);
    if (!codeDraft.ok) return;
    const codeDocumentResult = createStudioDocument({...input, id: 'studio-code', revision: 'studio-code-1', meanings: [codeDraft.value]}, {registry});
    expect(codeDocumentResult.ok).toBe(true);
    if (!codeDocumentResult.ok) return;
    const codeDocument = codeDocumentResult.value;
    const session = createStudioSession(document(), {registry});
    const importedCode = session.importDocument(codeDocument);
    expect(importedCode.ok).toBe(true);
    const alteredMeaning = {...codeDraft.value.meaning, label: 'Altered total'};
    const alteredDocument = {...codeDocument, revision: 'studio-code-1-altered', meanings: [{...codeDraft.value, meaning: alteredMeaning, digest: meaningDigest(alteredMeaning)}]};
    const imported = session.importDocument(alteredDocument);
    expect(imported.ok).toBe(false);
    if (!imported.ok) expect(imported.diagnostics[0]!.code).toBe('studio.meaning-conflict');
  });

  it('validates a dependency DAG independently of draft array order', () => {
    const authoring = createMeaningAuthoring({catalog, registry});
    expect(authoring.ok).toBe(true);
    if (!authoring.ok) return;
    const field = authoring.value.field('employees', 'amount');
    const expression = authoring.value.call({id: 'core.aggregate.sum', revision: '1'}, [field]);
    expect(expression.ok).toBe(true);
    if (!expression.ok) return;
    const base = authoring.value.defineMeaning({id: 'employees.base', label: 'Base', description: 'Base amount.', expression});
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    const withBase = createMeaningAuthoring({catalog, registry, definitions: [base.value.meaning]});
    expect(withBase.ok).toBe(true);
    if (!withBase.ok) return;
    const dependent = withBase.value.draft({...base.value.meaning, id: 'employees.dependent', label: 'Dependent', explanation: 'Dependent amount.', implementation: {kind: 'expression', expression: {kind: 'definition', ref: {id: 'employees.base', revision: '1'}}}, dependencies: [{id: 'employees.base', revision: '1'}]}, {source: {surface: 'studio', ownership: 'personal'}, assumptions: []});
    const baseDraft = withBase.value.draft(base.value.meaning, {source: {surface: 'studio', ownership: 'personal'}, assumptions: []});
    expect(dependent.ok).toBe(true);
    expect(baseDraft.ok).toBe(true);
    if (!dependent.ok || !baseDraft.ok) return;
    const reversed = createStudioDocument({...input, meanings: [dependent.value, baseDraft.value]}, {registry});
    expect(reversed.ok).toBe(true);
  });

  it('rejects invalid runtime setter values without mutating the document', () => {
    const session = createStudioSession(document(), {registry});
    const before = session.getState();
    const area = session.selectArea('bogus');
    const theme = session.setTheme('purple');
    const preview = session.setPreviewState('bogus');
    expect(area.ok).toBe(false);
    expect(theme.ok).toBe(false);
    expect(preview.ok).toBe(false);
    expect(session.getState().area).toBe(before.area);
    expect(session.getState().document).toEqual(before.document);
    expect(session.getState().dirty).toBe(false);
    expect(session.getState().diagnostics[0]!.code).toBe('studio.preview-state-invalid');
  });
});
