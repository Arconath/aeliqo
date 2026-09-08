import {describe, expect, it} from 'vitest';
import {createStudioDocument, createStudioSession, parseStudioDocument} from '../../packages/devtools/src/index.js';
import {document, input, registry} from './fixtures.js';

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
  });
});
