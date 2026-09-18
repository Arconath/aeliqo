import {
  openAICompatibleChatAdapter,
  type ToolModelPort,
  type ToolModelRequest,
  type ToolModelResponse,
} from '@aeliqo/agent/model';

const DEEPSEEK_MODEL_ID = 'deepseek-flash';
const DEEPSEEK_CHAT_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const MAX_REQUEST_BYTES = 32_768;
const MAX_RESPONSE_BYTES = 32_768;
const REQUEST_TIMEOUT_MS = 12_000;

export interface BrowserDeepSeekModel extends ToolModelPort {
  clear(): void;
}

function requestBody(request: ToolModelRequest): string {
  const encoded = openAICompatibleChatAdapter.encodeRequest({ request, model: DEEPSEEK_MODEL_ID });
  const body = JSON.stringify(encoded);
  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES)
    throw new Error('The DeepSeek request exceeds the Playground size limit.');
  return body;
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES)
    throw new Error('DeepSeek response exceeds the Playground size limit.');
  const reader = response.body?.getReader();
  if (reader === undefined) throw new Error('DeepSeek returned an empty response.');
  const decoder = new TextDecoder();
  let length = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('DeepSeek response exceeds the Playground size limit.');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } finally {
    reader.releaseLock();
  }
}

export function createBrowserDeepSeekModel(apiKey: string): BrowserDeepSeekModel {
  let key: string | undefined = apiKey;
  return Object.freeze({
    estimateInputTokens: (request: ToolModelRequest) => openAICompatibleChatAdapter.estimateInputTokens(request),
    async complete(request: ToolModelRequest, options: { readonly signal: AbortSignal }): Promise<ToolModelResponse> {
      const credential = key;
      if (credential === undefined) throw new Error('The DeepSeek connection is closed.');
      const body = requestBody(request);
      const timeout = new AbortController();
      const timeoutId = window.setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(DEEPSEEK_CHAT_ENDPOINT, {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          redirect: 'error',
          referrerPolicy: 'no-referrer',
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${credential}`,
            'content-type': 'application/json',
          },
          body,
          signal: AbortSignal.any([options.signal, timeout.signal]),
        });
        if (!response.ok) throw new Error('DeepSeek returned an unsuccessful response.');
        const value = await readBoundedJson(response);
        return openAICompatibleChatAdapter.decodeResponse(value, {
          model: DEEPSEEK_MODEL_ID,
          estimatedInputTokens: openAICompatibleChatAdapter.estimateInputTokens(request),
        });
      } catch {
        throw new Error('The direct DeepSeek request failed or exceeded its time limit.');
      } finally {
        window.clearTimeout(timeoutId);
      }
    },
    clear() {
      key = undefined;
    },
  });
}
