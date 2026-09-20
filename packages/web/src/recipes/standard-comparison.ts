import type { Outcome, PresentationPlan } from '@aeliqo/core';
import { AELIQO_FOUNDATION_REFS } from '../foundation/manifest.js';
import { AELIQO_OPERATION_REFS } from '../region/registry.js';
import { AELIQO_DATA_CONFIG_SCHEMAS, AELIQO_DATA_REFS } from '../region/data-registry.js';
import { dataColumns } from './standard-data.js';
import type { RecipeContext } from './types.js';

function sameRef(
  left: { readonly id: string; readonly revision: string },
  right: { readonly id: string; readonly revision: string },
): boolean {
  return left.id === right.id && left.revision === right.revision;
}

/** Build the bounded two-pane comparison candidate when the scope can support it. */
export function comparisonSplitPlan(context: RecipeContext): Outcome<PresentationPlan> | undefined {
  if (
    context.intent.kind !== 'compare' ||
    context.result === undefined ||
    context.environment.inlineSize.state !== 'known' ||
    context.environment.inlineSize.value < 640 ||
    context.intent.identities.length !== 2 ||
    context.task.viewPreference !== undefined ||
    context.incumbent !== undefined
  )
    return undefined;
  const need = context.task.needs[0];
  if (need === undefined || !sameRef(need.operation, AELIQO_OPERATION_REFS.compare)) return undefined;
  const columns = dataColumns(context, false);
  if (columns.length === 0) return undefined;
  const children = context.intent.identities.map((identityValues, index) => ({
    id: `comparison.${index === 0 ? 'left' : 'right'}`,
    role: 'detail',
    representation: AELIQO_DATA_REFS.detail,
    result: context.result!.ref,
    config: {
      schema: AELIQO_DATA_CONFIG_SCHEMAS.detail,
      values: {
        fields: columns.map((column) => column.key),
        columns,
        identity: context.result!.identity,
        identityValues,
        title: `Comparison ${index + 1}`,
        showIdentity: true,
      },
    },
    children: [],
  }));
  return {
    ok: true,
    value: {
      id: `presentation-${context.task.id}`.slice(0, 160),
      revision: context.task.revision,
      rootId: 'comparison',
      preconditions: context.current,
      nodes: [
        {
          id: 'comparison',
          role: 'structure',
          representation: AELIQO_FOUNDATION_REFS.splitPane,
          config: {
            schema: { id: 'foundation.split-pane.config', revision: '1' },
            values: {
              bindingRevision: 'unconfigured',
              orientation: 'horizontal',
              position: 50,
              min: 20,
              max: 80,
              step: 5,
            },
          },
          children: children.map((child) => child.id),
        },
        ...children,
      ],
      links: [],
      coverage: [{ needId: need.id, nodeIds: [children[0]!.id, children[1]!.id], operations: [need.operation] }],
      stateTransfer: [],
      diagnostics: [],
    },
  };
}
