import { createIntentCompilerRegistry } from '@aeliqo/core/app';
import type { Outcome, Task } from '@aeliqo/core';
import { defineRecipe, standardDataRecipe } from '@aeliqo/web/recipes';
import * as z from 'zod';

const customIntent = createIntentCompilerRegistry([
  {
    ref: { id: 'demo.knowledge.by-topic', revision: '1' },
    schema: z.object({ topic: z.string().min(1).max(80) }),
    capabilities: ['data.read'],
    compile(input: { readonly topic: string }, context): Outcome<Task> {
      return {
        ok: true,
        value: {
          version: '1',
          id: `knowledge-${input.topic.toLocaleLowerCase()}`.slice(0, 160),
          revision: context.taskRevision,
          catalogRevision: context.resource.catalog.revision,
          functionRegistryDigest: context.resource.catalog.functionRegistryDigest,
          regionId: context.regionId,
          kind: 'data',
          goal: `Browse ${input.topic} knowledge`,
          assumptions: [],
          viewPreference: { representation: 'cards', strength: 'preferred' },
          outputs: [
            {
              id: 'primary',
              kind: 'query',
              query: {
                entity: context.resource.entity.id,
                fields: ['id', 'title', 'topic', 'excerpt'],
                measures: [],
                relations: [],
                groupBy: [],
                population: { kind: 'all-authorized' },
                where: { op: 'compare', field: 'topic', comparison: 'eq', value: input.topic },
                order: [],
              },
              dependsOn: [],
              delivery: 'eager',
            },
          ],
          needs: [
            {
              id: 'custom',
              operation: { id: 'data.read', revision: '1' },
              outputId: 'primary',
              fields: ['id', 'title', 'topic', 'excerpt'],
              required: true,
            },
          ],
        },
      };
    },
  },
]);
if (!customIntent.ok) throw new Error(customIntent.diagnostics[0].message);
export const PLAYGROUND_INTENTS = customIntent.value;

export const customIntentRecipe = defineRecipe({
  ref: { id: 'demo.recipe.custom-data', revision: '1' },
  intents: ['custom'],
  build: standardDataRecipe.build,
});
