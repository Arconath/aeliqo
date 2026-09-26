import type { WebMcpDetection, WebMcpDetectionOptions, WebMcpModelContext } from './types.js';
import { isRecord } from '../guards.js';

function isModelContext(value: unknown): value is WebMcpModelContext {
  return (
    isRecord(value) &&
    typeof value.registerTool === 'function' &&
    (value.getTools === undefined || typeof value.getTools === 'function')
  );
}

/**
 * Read a modelContext from one supplied host object: the object itself
 * (`document.modelContext`, or `navigator.modelContext` on Chrome 146-149
 * where only the navigator entry point existed) or a `navigator` member.
 */
function modelContextFromHost(host: unknown): WebMcpModelContext | undefined {
  if (!isRecord(host)) return undefined;
  try {
    if (isModelContext(host.modelContext)) return host.modelContext;
    const nested = host.navigator;
    if (isRecord(nested) && isModelContext(nested.modelContext)) return nested.modelContext;
    return undefined;
  } catch {
    return undefined;
  }
}

/** Inspect explicitly supplied host capabilities without reading browser globals. */
export function detectWebMcp(options: WebMcpDetectionOptions = {}): WebMcpDetection {
  const explicit = Object.hasOwn(options, 'document') || Object.hasOwn(options, 'navigator');
  const evidence = options.evidence ?? 'simulated';
  const context = explicit
    ? (modelContextFromHost(options.document) ?? modelContextFromHost(options.navigator))
    : undefined;
  if (context !== undefined) return Object.freeze({ evidence, supported: true, modelContext: context });
  return Object.freeze({
    evidence: explicit && evidence === 'simulated' ? 'simulated' : 'unavailable',
    supported: false,
    reason: 'The host does not expose document.modelContext or navigator.modelContext.',
  });
}
