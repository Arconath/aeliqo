import {parseContract, WIRE_LIMITS} from '@aeliqo/core';
import type {Contract, Diagnostic, ResultRef} from '@aeliqo/core';

type ResultEvent = Contract<'result-event'>;

export interface ResultStreamLimits {
  readonly bytes: number;
  readonly messageBytes: number;
  readonly messages: number;
  readonly rows: number;
}

/** Pins come from the accepted host plan, never from the stream being checked. */
export interface ResultStreamContext {
  readonly requestId: string;
  readonly queryDigest: string;
  readonly scopeDigest: string;
  readonly outputId: string;
  readonly limits: ResultStreamLimits;
  readonly signal?: AbortSignal;
}

export class DataStreamError extends Error {
  readonly diagnostic: Diagnostic;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'DataStreamError';
    this.diagnostic = {code, message, retryable: false};
  }
}

function fail(code: string, message: string): never {throw new DataStreamError(code, message);}
const sameRef = (a: ResultRef, b: ResultRef) =>
  a.id === b.id && a.revision === b.revision && a.outputId === b.outputId &&
  a.queryDigest === b.queryDigest && a.scopeDigest === b.scopeDigest;

/** Validates framing and stream lineage. It does not prove data or prose truth. */
export async function* readResultStream(
  source: ReadableStream<Uint8Array>, context: ResultStreamContext,
): AsyncGenerator<ResultEvent> {
  const limits = {...context.limits};
  const {requestId, queryDigest, scopeDigest, outputId, signal} = context;
  for (const limit of [limits.bytes, limits.messageBytes, limits.messages, limits.rows]) {
    if (!Number.isSafeInteger(limit) || limit < 0) fail('data.stream-budget', 'Stream limits must be nonnegative safe integers.');
  }
  if (!limits.messageBytes || limits.messageBytes > WIRE_LIMITS.bytes || !limits.messages)
    fail('data.stream-budget', 'Stream message limits exceed the wire boundary or permit no messages.');
  const reader = source.getReader();
  const abort = () => {void reader.cancel().catch(() => {});};
  signal?.addEventListener('abort', abort, {once: true});
  let buffer = new Uint8Array(Math.min(4096, limits.messageBytes));
  let used = 0;
  let bytes = 0;
  let messages = 0;
  let rows = 0;
  let sequence = 0;
  let reference: ResultRef | undefined;
  let terminal = false;
  let terminalEvent: ResultEvent | undefined;
  let population: string | undefined;
  const progress = new Map<string, number>();
  const decoder = new TextDecoder('utf-8', {fatal: true});

  const parseLine = (): ResultEvent => {
    if (++messages > limits.messages) fail('data.stream-budget', 'Stream message budget exceeded.');
    if (terminal) fail('data.stream-terminal', 'A result stream continued after its terminal event.');
    let text: string;
    try {text = decoder.decode(buffer.subarray(0, used));}
    catch {return fail('data.stream-encoding', 'Result stream contains invalid UTF-8.');}
    used = 0;
    const parsed = parseContract('result-event', text);
    if (!parsed.ok) fail('data.stream-shape', 'Result stream message does not match the bounded event contract.');
    const event = parsed.value;
    if (event.kind === 'error') {
      if (event.requestId !== requestId) fail('data.stream-request', 'Result error belongs to another request.');
      terminal = true;
      return event;
    }
    if (event.kind === 'descriptor') {
      if (reference !== undefined) fail('data.stream-descriptor', 'A result stream has more than one descriptor.');
      const ref = event.descriptor.ref;
      if (ref.queryDigest !== queryDigest || ref.scopeDigest !== scopeDigest || ref.outputId !== outputId)
        fail('data.stream-scope', 'Result descriptor does not match the accepted query, output and authorization scope.');
      reference = ref;
      const coverage = event.descriptor.coverage;
      population = coverage.kind === 'unknown' ? undefined : coverage.populationDigest;
      return event;
    }
    if (reference === undefined) fail('data.stream-descriptor', 'A result stream event arrived before its descriptor.');
    if (!sameRef(reference, event.result)) fail('data.stream-lineage', 'Result stream identity changed between messages.');
    if (event.kind === 'batch') {
      if (event.sequence !== sequence++) fail('data.stream-sequence', 'Result batches must be consecutive and start at zero.');
      rows += event.rows.length;
      if (rows > limits.rows) fail('data.stream-budget', 'Result stream row budget exceeded.');
    } else if (event.kind === 'progress') {
      if (event.completed < (progress.get(event.unit) ?? 0) || (event.total !== undefined && event.completed > event.total))
        fail('data.stream-progress', 'Result stream progress is inconsistent.');
      progress.set(event.unit, event.completed);
    } else {
      const coverage = event.finalCoverage;
      if (population !== undefined && coverage.kind !== 'unknown' && coverage.populationDigest !== population)
        fail('data.stream-population', 'Result stream population changed at completion.');
      terminal = true;
    }
    return event;
  };
  try {
    while (true) {
      if (signal?.aborted) fail('data.aborted', 'Result stream was cancelled.');
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {chunk = await reader.read();}
      catch {
        if (signal?.aborted) fail('data.aborted', 'Result stream was cancelled.');
        fail('data.stream-network', 'Result transport failed before its stream was validated.');
      }
      if (signal?.aborted) fail('data.aborted', 'Result stream was cancelled.');
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limits.bytes) fail('data.stream-budget', 'Result stream byte budget exceeded.');
      for (const byte of chunk.value) {
        if (byte === 10) {
          const event = parseLine();
          if (terminal) terminalEvent = event;
          else yield event;
          continue;
        }
        if (used >= limits.messageBytes) fail('data.stream-budget', 'Result stream message byte budget exceeded.');
        if (used === buffer.length) {
          const grown = new Uint8Array(Math.min(limits.messageBytes, buffer.length * 2));
          grown.set(buffer);
          buffer = grown;
        }
        buffer[used++] = byte;
      }
    }
    if (used > 0) {
      const event = parseLine();
      if (terminal) terminalEvent = event;
      else yield event;
    }
    if (!terminal) fail('data.stream-truncated', 'Result stream ended without a completion or error event.');
    if (terminalEvent !== undefined) yield terminalEvent;
  } finally {
    signal?.removeEventListener('abort', abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
