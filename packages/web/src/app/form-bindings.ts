import {parseWireValue, validateScalar, type Diagnostic, type Intent, type Outcome, type ReadonlyJsonValue, type ResourceDefinition, type Scalar, type Task} from '@aeliqo/core';
import {AELIQO_INPUT_REFS, type AeliqoInputRef} from '../input/manifest.js';
import type {AeliqoInputBinding, AeliqoInputBindings} from '../region/input-registry.js';
import type {AeliqoFormState} from './types.js';

function failure<T>(code: string, message: string): Outcome<T> {
  const item: Diagnostic = {code, message, retryable: false};
  return {ok: false, diagnostics: [item]};
}

function isJsonValue(value: unknown): value is ReadonlyJsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return value !== null && typeof value === 'object' && Object.values(value).every(isJsonValue);
}

function isJsonObject(value: unknown): value is Readonly<Record<string, ReadonlyJsonValue>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(isJsonValue);
}

function fieldRef(value: ResourceDefinition['entity']['fields'][number]['type']['value']): AeliqoInputRef {
  if (value === 'boolean') return AELIQO_INPUT_REFS.checkbox;
  if (value === 'integer' || value === 'float' || value === 'decimal') return AELIQO_INPUT_REFS.numberField;
  if (value === 'date') return AELIQO_INPUT_REFS.dateField;
  return AELIQO_INPUT_REFS.textField;
}

function defaultConfig(ref: AeliqoInputRef, value: Scalar | undefined): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (ref.id === AELIQO_INPUT_REFS.checkbox.id) return typeof value === 'boolean' ? {defaultChecked: value} : {};
  if (ref.id === AELIQO_INPUT_REFS.numberField.id) {
    const text = typeof value === 'object' ? value.decimal : typeof value === 'number' ? String(value) : undefined;
    return text === undefined ? {} : {defaultValue: text};
  }
  return typeof value === 'string' ? {defaultValue: value} : {};
}

function checkedValues(resource: ResourceDefinition, state: AeliqoFormState): Outcome<Readonly<Record<string, Scalar>>> {
  const parsed = parseWireValue(state.values);
  if (!parsed.ok || !isJsonObject(parsed.value))
    return failure('web.form-state.values', 'Form state values must be a bounded JSON object.');
  const raw = parsed.value;
  const fields = new Map(resource.entity.fields.map((field) => [field.id, field]));
  const output: Record<string, Scalar> = {};
  for (const [id, value] of Object.entries(raw)) {
    const field = fields.get(id);
    if (field === undefined) return failure('web.form-state.field', `Form state contains unknown field ${id}.`);
    const checked = validateScalar(value, field.type);
    if (!checked.ok) return failure('web.form-state.value', `Form state field ${id} does not satisfy its semantic type.`);
    output[id] = checked.value;
  }
  return {ok: true, value: Object.freeze(output)};
}

export function createFormBindings(resource: ResourceDefinition, intent: Intent, task: Task, state: AeliqoFormState): Outcome<AeliqoInputBindings> {
  if ((intent.kind !== 'create' && intent.kind !== 'edit') || task.kind !== 'form')
    return failure('web.form-state.intent', 'Form bindings require a compiled create or edit Task.');
  if (state.entityRevision.length === 0 || state.entityRevision.length > 160 || /[\s\u0000-\u001f\u007f]/u.test(state.entityRevision))
    return failure('web.form-state.revision', 'Form state requires a bounded entity revision.');
  const values = checkedValues(resource, state);
  if (!values.ok) return values;
  const editable = resource.entity.fields.filter((field) => resource.fieldMetadata[field.id]?.hidden !== true &&
    (intent.kind !== 'edit' || !resource.entity.identity.includes(field.id)));
  if (editable.length > 31) return failure('web.form-state.fields', 'The standard form recipe supports at most 31 visible fields; group or customize this form.');
  if (intent.kind === 'edit') {
    const missing = editable.find((field) => !Object.hasOwn(values.value, field.id));
    if (missing !== undefined) return failure('web.form-state.missing', `Edit form state is missing current value for ${missing.id}.`);
  }
  const key = task.entityKey ?? `new-${task.id}`;
  const inputs: AeliqoInputBinding[] = editable.map((field) => {
    const metadata = resource.fieldMetadata[field.id];
    const ref = fieldRef(field.type.value);
    const unit = ref.id === AELIQO_INPUT_REFS.numberField.id && field.type.unit !== undefined ? {unit: field.type.unit.symbol} : {};
    return {
      id: `field-${field.id}`,
      ref,
      config: Object.freeze({label: field.label, ...(metadata?.description === undefined ? {} : {description: metadata.description}),
        required: !field.type.nullable, name: field.id, ...unit, ...defaultConfig(ref, values.value[field.id])}),
      draft: {entity: resource.entity.id, key, field: field.id, entityRevision: state.entityRevision, type: field.type},
    };
  });
  const form: AeliqoInputBinding = {
    id: 'form', ref: AELIQO_INPUT_REFS.form, config: {
      label: intent.kind === 'create' ? `Create ${resource.label}` : `Edit ${resource.label}`,
      submitLabel: intent.kind === 'create' ? `Create ${resource.label}` : `Save ${resource.label}`,
    },
    action: {action: task.action, input: values.value},
  };
  return {ok: true, value: Object.freeze({revision: `form-${task.revision}`.slice(0, 160), inputs: Object.freeze([form, ...inputs])})};
}
