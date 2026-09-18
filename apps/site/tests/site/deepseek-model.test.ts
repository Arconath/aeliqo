import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolModelRequest } from '@aeliqo/agent/model';
import { createBrowserDeepSeekModel } from '../../src/playground/deepseek-model.js';

const requestOptions = { signal: new AbortController().signal };

function modelRequest(text = 'Browse people'): ToolModelRequest {
  return { messages: [{ role: 'user', text }], tools: [], maxOutputTokens: 128 };
}

function responseJson(): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { role: 'assistant', content: 'Ready.' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

beforeEach(() => {
  vi.stubGlobal('window', {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('direct DeepSeek request bounds', () => {
  it('rejects an oversized encoded request before calling fetch', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const model = createBrowserDeepSeekModel('sk-test-only');

    await expect(model.complete(modelRequest('x'.repeat(32_768)), requestOptions)).rejects.toThrow(
      'exceeds the Playground size limit',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an oversized declared response before reading its body', async () => {
    const getReader = vi.fn();
    const response = {
      ok: true,
      headers: new Headers({ 'content-length': '32769' }),
      body: { getReader },
    } as unknown as Response;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);
    const model = createBrowserDeepSeekModel('sk-test-only');

    await expect(model.complete(modelRequest(), requestOptions)).rejects.toThrow('direct DeepSeek request failed');
    expect(getReader).not.toHaveBeenCalled();
  });

  it('cancels a streamed response once its bytes exceed the cap', async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(16_384));
        controller.enqueue(new Uint8Array(16_385));
      },
      cancel() {
        cancelled = true;
      },
    });
    const response = new Response(body, { status: 200 });
    expect(response.headers.get('content-length')).toBeNull();
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(response));
    const model = createBrowserDeepSeekModel('sk-test-only');

    await expect(model.complete(modelRequest(), requestOptions)).rejects.toThrow('direct DeepSeek request failed');
    expect(cancelled).toBe(true);
  });

  it('aborts a request after the 12-second timeout and returns a generic failure', async () => {
    vi.useFakeTimers();
    const scheduled: number[] = [];
    vi.stubGlobal('window', {
      setTimeout: (callback: () => void, delay: number) => {
        scheduled.push(delay);
        return globalThis.setTimeout(callback, delay);
      },
      clearTimeout: (timeoutId: number) => globalThis.clearTimeout(timeoutId),
    });
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
            once: true,
          });
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const model = createBrowserDeepSeekModel('sk-test-only');
    const pending = model.complete(modelRequest(), requestOptions);
    const failed = expect(pending).rejects.toThrow('direct DeepSeek request failed or exceeded its time limit');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(12_000);
    await failed;
    expect(scheduled).toEqual([12_000]);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
});
