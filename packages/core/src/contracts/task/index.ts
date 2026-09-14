import {parseTask} from '../parse.js';
import type {Diagnostic, Outcome, ResultRef, Task} from '../types.js';
import {WIRE_LIMITS} from '../limits.js';

export type TaskStructure = {
  readonly task: Task;
  /** Stable topological order of named data outputs; empty for queryless tasks. */
  readonly outputOrder: readonly string[];
  /** External immutable handles, including fixed cohorts, never visible row indices. */
  readonly resultReferences: readonly ResultRef[];
};
const refKey = (ref: ResultRef) => JSON.stringify([ref.id, ref.revision, ref.outputId, ref.queryDigest, ref.scopeDigest]);

/** Structure only: catalog binding, result authorization and grain semantics are later passes. */
export function validateTaskStructure(input: unknown): Outcome<TaskStructure> {
  const parsed = parseTask(input);
  if (!parsed.ok) return parsed;
  const task = parsed.value;
  const diagnostics: Diagnostic[] = [];
  const fail = (code: string, message: string, path: readonly (string | number)[]) => {
    if (diagnostics.length < WIRE_LIMITS.diagnostics) diagnostics.push({code, message, path, retryable: false});
  };
  const unique = (values: readonly string[], path: readonly (string | number)[]) => {
    const seen = new Set<string>();
    values.forEach((id, index) => {
      if (seen.has(id)) fail('task.duplicate', 'The identifier must be unique in this list.', [...path, index]);
      seen.add(id);
    });
  };
  unique(task.needs.map(need => need.id), ['needs']);
  task.needs.forEach((need, index) => unique(need.fields, ['needs', index, 'fields']));
  const outputIds = new Set<string>();
  const ambiguousOutputIds = new Set<string>();
  const references = new Map<string, ResultRef>();
  const addReference = (ref: ResultRef) => references.set(refKey(ref), ref);
  const order: string[] = [];
  if (task.kind === 'data') {
    unique(task.outputs.map(output => output.id), ['outputs']);
    task.outputs.forEach(output => outputIds.add(output.id));
    const outputById = new Map(task.outputs.map(output => [output.id, output]));
    const indegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();
    task.outputs.forEach((output, index) => {
      unique(output.dependsOn, ['outputs', index, 'dependsOn']);
      indegree.set(output.id, output.dependsOn.length);
      output.dependsOn.forEach((dependency, dependencyIndex) => {
        if (!outputIds.has(dependency)) fail('task.dependency-missing', 'The named output dependency does not exist.', ['outputs', index, 'dependsOn', dependencyIndex]);
        const next = dependents.get(dependency) ?? [];
        next.push(output.id);
        dependents.set(dependency, next);
      });
      if (output.kind === 'reuse') addReference(output.result);
      else {
        const population = output.query.population;
        if (population.kind !== 'all-authorized') unique(population.identityKeys, ['outputs', index, 'query', 'population', 'identityKeys']);
        if (population.kind === 'fixed') addReference(population.source);
        if (population.kind === 'live-output' && !output.dependsOn.includes(population.outputId))
          fail('task.cohort-dependency', 'A live cohort must declare its named upstream output as a dependency.', ['outputs', index, 'query', 'population', 'outputId']);
        if (population.kind === 'live-output' && outputById.get(population.outputId)?.kind === 'reuse')
          fail('task.cohort-source', 'Live membership requires an upstream query; an immutable reused result is a fixed cohort source.', ['outputs', index, 'query', 'population', 'outputId']);
      }
    });
    // Do not manufacture secondary cycle errors from duplicate or missing edges.
    if (!diagnostics.length) {
      const queue = task.outputs.filter(output => indegree.get(output.id) === 0).map(output => output.id);
      for (let index = 0; index < queue.length; index++) {
        const id = queue[index]!;
        order.push(id);
        for (const next of dependents.get(id) ?? []) {
          const remaining = indegree.get(next)! - 1;
          indegree.set(next, remaining);
          if (remaining === 0) queue.push(next);
        }
      }
      if (order.length !== task.outputs.length) fail('task.output-cycle', 'Named output dependencies must be acyclic.', ['outputs']);
    }
  } else if (task.kind === 'presentation') {
    const byOutput = new Map<string, string>();
    task.inputs.forEach(ref => {
      const previous = byOutput.get(ref.outputId);
      if (previous !== undefined && previous !== refKey(ref)) ambiguousOutputIds.add(ref.outputId);
      byOutput.set(ref.outputId, refKey(ref));
      outputIds.add(ref.outputId);
      addReference(ref);
    });
  }
  task.needs.forEach((need, index) => {
    if (need.outputId !== undefined && !outputIds.has(need.outputId))
      fail('task.operation-output', 'The operation refers to an output absent from this task.', ['needs', index, 'outputId']);
    if (need.outputId !== undefined && ambiguousOutputIds.has(need.outputId))
      fail('task.output-ambiguous', 'The operation target matches different result handles; use named reuse outputs to disambiguate.', ['needs', index, 'outputId']);
  });
  if (diagnostics.length) return {ok: false, diagnostics: diagnostics as [Diagnostic, ...Diagnostic[]]};
  return {ok: true, value: {task, outputOrder: order, resultReferences: [...references.values()]}};
}
