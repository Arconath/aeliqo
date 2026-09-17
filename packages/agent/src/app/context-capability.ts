import type { AgentCapabilityHandlerResult, AgentCapabilityManifest, AgentJsonValue } from '../capabilities/types.js';
import type { AppToolEndpointOptions } from './types.js';
import { failure, record, wire } from './values.js';

export function createContextCapability(
  options: AppToolEndpointOptions,
): AgentCapabilityManifest<Record<string, never>, AgentJsonValue> {
  return {
    ref: { id: 'aeliqo.app.context', revision: '1' },
    operation: 'catalog.read',
    label: 'Inspect the current Aeliqo context',
    description:
      'Lists the active resource and every resource, field, meaning, view, intent, and action the trusted host allows this paired Region to route. Returns metadata, never records or credentials.',
    parse(input) {
      return record(input) && Object.keys(input).length === 0
        ? { ok: true, value: {} }
        : failure('agent.app.context-input', 'Context accepts an empty object.');
    },
    invoke(): AgentCapabilityHandlerResult<AgentJsonValue> {
      const active = options.runtime.context(options.regionId);
      if (!active.ok) return { state: 'denied', diagnostics: active.diagnostics };
      const current = options.context?.read() ?? { ok: true as const, value: [active.value] };
      if (!current.ok) return { state: 'denied', diagnostics: current.diagnostics };
      const resources = current.value.map(({ resource, intents, fields, meanings, views, actions }) => ({
        resource,
        intents,
        fields,
        meanings,
        views,
        actions,
      }));
      const result = wire({ activeResource: active.value.resource.id, resources });
      if (result.ok) return { state: 'accepted', value: result.value };
      return { state: 'failed', diagnostics: result.diagnostics };
    },
  };
}
