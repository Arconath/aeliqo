import type { Diagnostic } from '@aeliqo/core';
import type { PresentationValues } from '@aeliqo/core/presentation';
import type { RecipeContext } from './types.js';

export type TrendConfig =
  | { readonly kind: 'available'; readonly values: PresentationValues }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'needs-input'; readonly diagnostic: Diagnostic };

function requestedFields(context: RecipeContext): ReadonlySet<string> {
  return new Set(context.task.needs.flatMap((need) => need.fields));
}

function needsInput(code: string, message: string): TrendConfig {
  return { kind: 'needs-input', diagnostic: { code, message, retryable: false } };
}

export function trendConfig(context: RecipeContext): TrendConfig {
  const result = context.result;
  if (result === undefined) return { kind: 'unavailable' };
  const requested = requestedFields(context);
  const fields = result.fields.filter((field) => requested.has(field.id));
  const temporal = fields.filter((field) => field.type.value === 'date' || field.type.value === 'instant');
  const semanticTime = temporal.filter((field) => field.role === 'time');
  const timeCandidates = semanticTime.length > 0 ? semanticTime : temporal;
  if (timeCandidates.length === 0)
    return needsInput(
      'web.recipe.needs-input.time',
      'Choose one requested date or time field before rendering a trend.',
    );
  if (timeCandidates.length > 1)
    return needsInput('web.recipe.needs-input.time', 'Choose one requested time field before rendering a trend.');
  const measures = fields.filter(
    (field) => field.role === 'measure' && ['integer', 'float', 'decimal'].includes(field.type.value),
  );
  if (measures.length === 0)
    return needsInput(
      'web.recipe.needs-input.measure',
      'Choose one requested numeric measure before rendering a trend.',
    );
  if (measures.length > 1)
    return needsInput(
      'web.recipe.needs-input.measure',
      `Choose one requested measure before rendering a trend: ${measures.map((field) => field.label).join(', ')}.`,
    );
  const temporalField = timeCandidates[0]!;
  const measure = measures[0]!;
  const seriesBy = fields
    .filter((field) => field.role === 'dimension' && field.id !== temporalField.id && field.id !== measure.id)
    .map((field) => field.id);
  return { kind: 'available', values: { labelField: temporalField.id, series: [{ field: measure.id }], seriesBy } };
}
