import { isRecord } from './guards.js';

export type PlaygroundConnection =
  | { readonly state: 'connected'; readonly kind: 'local'; readonly label: string; readonly modelConfigured: boolean }
  | { readonly state: 'available'; readonly kind: 'webmcp'; readonly label: string }
  | { readonly state: 'unavailable'; readonly kind: 'local' | 'webmcp'; readonly label: string };

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost');
}

function isLoopbackOrigin(): boolean {
  return typeof window === 'undefined' || isLoopbackHost(window.location.hostname);
}

async function checkWebMcp(): Promise<PlaygroundConnection> {
  const { detectWebMcp } = await import('@aeliqo/agent/webmcp');
  const hostDocument = typeof document === 'undefined' ? undefined : document;
  const detected =
    hostDocument === undefined ? detectWebMcp() : detectWebMcp({ document: hostDocument, evidence: 'native' });
  return detected.supported
    ? { state: 'available', kind: 'webmcp', label: 'Native WebMCP is available (experimental).' }
    : {
        state: 'unavailable',
        kind: 'webmcp',
        label:
          'Native WebMCP is unavailable in this browser. The note above explains how to try it — the demo agent works without it.',
      };
}

function localUnavailable(label: string): PlaygroundConnection {
  return { state: 'unavailable', kind: 'local', label };
}

async function checkLocalHost(): Promise<PlaygroundConnection> {
  if (!isLoopbackOrigin())
    return localUnavailable(
      'The hosted page cannot reach your local runner — the browser blocks cross-site pairing for security reasons. Run `pnpm playground:local` in the repo and open the printed http://127.0.0.1:4174/playground/ address instead.',
    );
  try {
    const response = await fetch('/api/aeliqo/session', {
      headers: { accept: 'application/json', 'x-aeliqo-session-bootstrap': '1' },
      cache: 'no-store',
    });
    if (!response.ok)
      return localUnavailable(
        'No local runner answered. Run `pnpm playground:local` in the repo and open the printed local address — or pick the scripted demo agent.',
      );
    const value: unknown = await response.json();
    if (!isRecord(value) || value.status !== 'ready')
      return localUnavailable('The local runner returned an invalid session response.');
    const modelConfigured = value.modelConfigured === true;
    return {
      state: 'connected',
      kind: 'local',
      modelConfigured,
      label: modelConfigured
        ? 'Local runner connected — MCP endpoint and model are ready.'
        : 'Local runner connected — MCP endpoint is ready. Configure a model in the local process to enable prompts.',
    };
  } catch {
    return localUnavailable(
      'No local runner answered. Run `pnpm playground:local` in the repo and open the printed local address — or pick the scripted demo agent.',
    );
  }
}

export async function checkConnection(kind: 'detect' | 'webmcp'): Promise<PlaygroundConnection> {
  return kind === 'webmcp' ? checkWebMcp() : checkLocalHost();
}

export interface LocalPromptReceipt {
  readonly stop: string;
  readonly modelRequests: number;
  readonly toolCalls: number;
  readonly message?: string;
}

export async function sendLocalPrompt(prompt: string, signal?: AbortSignal): Promise<LocalPromptReceipt> {
  const response = await fetch('/api/aeliqo/prompt', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ prompt }),
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok) throw new Error(`Local agent request failed (${response.status}).`);
  const value: unknown = await response.json();
  if (!isRecord(value)) throw new Error('The local agent returned an invalid receipt.');
  const receipt = value;
  if (
    typeof receipt.stop !== 'string' ||
    typeof receipt.modelRequests !== 'number' ||
    typeof receipt.toolCalls !== 'number'
  )
    throw new Error('The local agent returned an invalid receipt.');
  if (receipt.message !== undefined && (typeof receipt.message !== 'string' || receipt.message.length > 4_000))
    throw new Error('The local agent returned an invalid message.');
  return {
    stop: receipt.stop,
    modelRequests: receipt.modelRequests,
    toolCalls: receipt.toolCalls,
    ...(receipt.message === undefined ? {} : { message: receipt.message }),
  };
}
