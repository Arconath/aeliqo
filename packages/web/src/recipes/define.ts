import { createPresentationRegistry } from '@aeliqo/core';
import type { RecipeDefinition, RecipeInput, ViewInput } from './types.js';
import type { AeliqoViewDefinition } from '../region/types.js';

function validNamespacedId(id: string): boolean {
  return id.includes('.') && id.length <= 160 && !/[\s\u0000-\u001f\u007f]/u.test(id);
}

export function defineRecipe(input: RecipeInput): RecipeDefinition {
  if (
    !validNamespacedId(input.ref.id) ||
    input.ref.revision.length === 0 ||
    input.intents.length === 0 ||
    new Set(input.intents).size !== input.intents.length
  )
    throw new TypeError('A recipe needs a namespaced versioned ID and unique supported intents.');
  if (typeof input.build !== 'function') throw new TypeError('A recipe needs a synchronous trusted build callback.');
  return Object.freeze({ ...input, ref: Object.freeze({ ...input.ref }), intents: Object.freeze([...input.intents]) });
}

export function defineView(input: ViewInput): AeliqoViewDefinition {
  if (
    !validNamespacedId(input.ref.id) ||
    input.ref.id !== input.manifest.ref.id ||
    input.ref.revision !== input.manifest.ref.revision
  )
    throw new TypeError('A custom view needs one matching namespaced versioned identity.');
  if (input.manifest.extension !== true || typeof input.render !== 'function')
    throw new TypeError('A custom view must be declared as a trusted extension with a renderer.');
  const checked = createPresentationRegistry([input.manifest]);
  if (!checked.ok) throw new TypeError(checked.diagnostics.map((item) => item.message).join(' '));
  return Object.freeze({ ...input, ref: Object.freeze({ ...input.ref }), manifest: checked.value.manifests[0]! });
}
