import {describe, expect, it} from 'vitest';
import type {QuerySource} from '@aeliqo/sdk-core';
import {createStudioSession} from '../../packages/devtools/src/index.js';
import {catalog, document, registry} from '../studio/fixtures.js';

const localSource: QuerySource = {
  revision: 'studio-review-source-1',
  catalogRevision: catalog.revision,
  scopeDigest: 'studio-review-scope',
  policyRevision: 'studio-review-policy-1',
  relations: {employees: {entity: 'employees', complete: true, rows: [
    {id: 'ada', name: 'Ada', amount: 42},
    {id: 'grace', name: 'Grace', amount: 37},
  ]}},
};

describe('T26 fixed-source follow-up review', () => {
  it('evaluates a Studio meaning against the bounded local source', () => {
    const session = createStudioSession(document(), {registry});
    const draft = session.defineMeaning({id: 'employees.total', label: 'Total amount', description: 'Sum of employee amounts.', entity: 'employees', field: 'amount'});
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const result = session.evaluateMeaning({meaning: {id: draft.value.meaning.id, revision: draft.value.meaning.revision}, entity: 'employees', source: localSource});
    expect(result.ok).toBe(true);
    if (result.ok) expect(JSON.stringify(result.value.rows)).toContain('79');
  });

  it('creates a new Experience revision while retaining the code-owned base', () => {
    const session = createStudioSession(document(), {registry});
    const base = session.getState().document.profiles[0]!;
    const edited = session.editExperience({
      base: {id: base.experience.id, revision: base.experience.revision},
      label: 'Edited employee inspection',
      experience: {...base.experience, revision: '2', mode: 'fixed'},
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.value.source.ownership).toBe('personal');
    expect(session.getState().document.profiles.some((entry) => entry.experience.id === base.experience.id && entry.experience.revision === base.experience.revision && entry.source.ownership === 'code')).toBe(true);
    expect(session.getState().document.profiles.some((entry) => entry.experience.id === base.experience.id && entry.experience.revision === '2' && entry.source.ownership === 'personal')).toBe(true);
  });

  it('proposes and applies a meaning diff as a new immutable revision', () => {
    const session = createStudioSession(document(), {registry});
    const draft = session.defineMeaning({id: 'employees.total', label: 'Total amount', description: 'Sum of employee amounts.', entity: 'employees', field: 'amount'});
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const candidate = {...draft.value.meaning, revision: '2', label: 'Total employee amount'};
    const diff = session.proposeMeaningDiff({id: draft.value.meaning.id, revision: draft.value.meaning.revision}, candidate);
    expect(diff.ok).toBe(true);
    if (!diff.ok) return;
    expect(diff.value.state).toBe('proposed-diff');
    const applied = session.applyMeaningDiff(diff.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.meaning.revision).toBe('2');
    expect(session.getState().document.meanings.map((entry) => entry.meaning.revision)).toEqual(['1', '2']);
  });
});
