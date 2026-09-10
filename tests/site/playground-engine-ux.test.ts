import {expect, it} from 'vitest';
import type {Outcome} from '@aeliqo/core';
import {createDemoEngine, type DemoOutput} from '../../apps/site/src/playground-engine.js';

function value<T>(outcome: Outcome<T>): T {
  if (!outcome.ok) throw Error(JSON.stringify(outcome.diagnostics));
  return outcome.value;
}

function first(outputs: readonly DemoOutput[]): DemoOutput {
  if (!outputs[0]) throw Error('missing output');
  return outputs[0];
}

it('dispatches supplied tasks and exposes bounded synthetic source snapshots', () => {
  const engine = createDemoEngine();
  try {
    expect(engine.taskFor('people-rank')).toMatchObject({ok: false, diagnostics: [{code: 'demo.needs-meaning'}]});
    value(engine.defineAbsenceMeaning());
    expect(value(engine.taskFor('people-rank', {team: 'Engineering'})).goal).toContain('Rank synthetic employees');
    expect(value(engine.taskFor('people-contributor', {contributor: 'sam'})).goal).toContain('one employee');
    const people = engine.sourceSnapshot('employees');
    expect(people).toMatchObject({version: '1', synthetic: true, scopeDigest: 'synthetic-public-records'});
    expect(people.entities.map(entity => [entity.id, entity.grain, entity.records.length])).toEqual([
      ['employees', ['employee_id'], 4],
      ['absences', ['fact_id'], 16],
    ]);
    expect(engine.sourceSnapshot('products').entities[0]?.records).toHaveLength(4);
  } finally {
    engine.dispose();
  }
});

it('exports only the versioned Task and committed Presentation metadata', async () => {
  const engine = createDemoEngine();
  try {
    const output = first(value(await engine.evaluate(engine.peopleTask())));
    const presentation = value(engine.present(output));
    const exported = engine.createExportDocument(output.task, [presentation]);
    expect(exported).toMatchObject({
      version: '1',
      kind: 'aeliqo-playground-export',
      disclosure: {synthetic: true, includesRows: false, includesCredentials: false},
      presentations: [{outputId: 'main'}],
    });
    const serialized = JSON.stringify(exported);
    expect(serialized).not.toContain('Ada Chen');
    expect(serialized).not.toContain('Field notebook');
    expect(serialized).not.toMatch(/secret|access[_-]?token|api[_-]?key/i);
  } finally {
    engine.dispose();
  }
});
