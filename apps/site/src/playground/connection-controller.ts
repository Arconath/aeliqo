export type PlaygroundConnection =
  | { readonly state: 'connected'; readonly kind: 'local'; readonly label: string; readonly modelConfigured: boolean }
  | { readonly state: 'available'; readonly kind: 'webmcp'; readonly label: string }
  | { readonly state: 'unavailable'; readonly kind: 'local' | 'webmcp'; readonly label: string };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function checkConnection(kind: 'detect' | 'webmcp'): Promise<PlaygroundConnection> {
  if (kind === 'webmcp') {
    const { detectWebMcp } = await import('@aeliqo/agent/webmcp');
    const hostDocument = typeof document === 'undefined' ? undefined : document;
    const detected =
      hostDocument === undefined ? detectWebMcp() : detectWebMcp({ document: hostDocument, evidence: 'native' });
    return detected.supported
      ? { state: 'available', kind: 'webmcp', label: 'Native WebMCP is available (experimental).' }
      : {
          state: 'unavailable',
          kind: 'webmcp',
          label: `Native WebMCP is unavailable in this browser. ${detected.reason ?? 'Without AI remains available.'}`,
        };
  }
  try {
    const response = await fetch('/api/aeliqo/session', {
      headers: { accept: 'application/json', 'x-aeliqo-session-bootstrap': '1' },
      cache: 'no-store',
    });
    if (!response.ok)
      return {
        state: 'unavailable',
        kind: 'local',
        label: 'Local host is not running. Without AI remains available.',
      };
    const value: unknown = await response.json();
    if (!isRecord(value) || value.status !== 'ready')
      return { state: 'unavailable', kind: 'local', label: 'Local host returned an invalid session response.' };
    const modelConfigured = value.modelConfigured === true;
    return {
      state: 'connected',
      kind: 'local',
      modelConfigured,
      label: modelConfigured
        ? 'Local agent host connected. BYOK and MCP are ready.'
        : 'Local agent host connected for MCP. Configure a model in the local process to enable this composer.',
    };
  } catch {
    return { state: 'unavailable', kind: 'local', label: 'Local host is not running. Without AI remains available.' };
  }
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
