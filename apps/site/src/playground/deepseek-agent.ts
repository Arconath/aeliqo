import { runToolModel, type ToolModelLoopOutcome } from '@aeliqo/agent/model';
import type { AgentModelToolEndpoint } from '@aeliqo/agent/protocol';
import type { PlaygroundScenario } from './scenarios.js';
import type { PlaygroundSession } from './session.js';
import { createBrowserDeepSeekModel, type BrowserDeepSeekModel } from './deepseek-model.js';

const MAX_PROMPT_BYTES = 4_096;
const MAX_INPUT_BYTES = 32_768;
const MAX_OUTPUT_BYTES = 32_768;
const MAX_OUTPUT_TOKENS = 1_024;

export interface HostedDeepSeekConnection {
  run(prompt: string, scenario: PlaygroundScenario): Promise<ToolModelLoopOutcome>;
  cancel(): void;
  close(): void;
}

function scenarioPrompt(prompt: string, scenario: PlaygroundScenario): string {
  const value = [
    `Selected synthetic Playground scenario: ${scenario.label} (${scenario.id}).`,
    `Scenario context: ${scenario.description}`,
    `User request: ${prompt.trim()}`,
  ].join('\n');
  if (new TextEncoder().encode(value).byteLength > MAX_PROMPT_BYTES)
    throw new Error('Keep the Playground request under 4 KB.');
  return value;
}

function modelInstructions(): string {
  return [
    'Use aeliqo_context first. Select only a resource, field, meaning, view, or action present in its returned metadata.',
    'Call aeliqo_render only when the request can be satisfied with that metadata. Do not invent data, meanings, permissions, HTML, code, or endpoints.',
    'Do not claim a view changed unless the trusted renderer receipt confirms it. Application confirmation remains required for actions.',
  ].join(' ');
}

function loopOptions(
  endpoint: AgentModelToolEndpoint,
  model: BrowserDeepSeekModel,
  prompt: string,
  signal: AbortSignal,
) {
  return {
    requestId: `deepseek-${crypto.randomUUID()}`,
    goal: 'experience' as const,
    prompt,
    instructions: modelInstructions(),
    policy: {
      requiredOperationSequence: [{ operation: 'catalog.read' as const, acceptedStates: ['accepted' as const] }],
    },
    endpoint,
    model,
    budget: {
      maxTurns: 4,
      maxModelRequests: 4,
      maxToolCalls: 4,
      maxMilliseconds: 45_000,
      maxInputTokens: 32_000,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      maxTotalTokens: 36_000,
      maxInputBytes: MAX_INPUT_BYTES,
      maxOutputBytes: MAX_OUTPUT_BYTES,
      maxRepeatedCalls: 2,
    },
    signal,
  };
}

export async function connectHostedDeepSeek(
  session: PlaygroundSession,
  apiKey: string,
): Promise<Readonly<{ connection: HostedDeepSeekConnection } | { error: string }>> {
  const paired = await session.connectAgent('byok', 'hosted-deepseek');
  if (!paired.ok) return { error: paired.diagnostics[0]?.message ?? 'The Playground could not open this connection.' };
  const endpoint = paired.value;
  const model = createBrowserDeepSeekModel(apiKey);
  let active: AbortController | undefined;
  let closed = false;
  return {
    connection: Object.freeze({
      async run(prompt: string, scenario: PlaygroundScenario): Promise<ToolModelLoopOutcome> {
        if (closed) throw new Error('The DeepSeek connection is closed.');
        if (active !== undefined)
          return {
            ok: false,
            diagnostics: [{ code: 'playground.byok.busy', message: 'A request is already running.', retryable: true }],
          };
        const controller = new AbortController();
        active = controller;
        try {
          return await runToolModel(loopOptions(endpoint, model, scenarioPrompt(prompt, scenario), controller.signal));
        } finally {
          if (active === controller) active = undefined;
        }
      },
      cancel() {
        active?.abort();
      },
      close() {
        if (closed) return;
        closed = true;
        active?.abort();
        active = undefined;
        model.clear();
        endpoint.close();
      },
    }),
  };
}
