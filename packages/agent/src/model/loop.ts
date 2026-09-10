import {parseWireValue, validateCommitReadSet, WIRE_LIMITS} from '@aeliqo/core';
import {awaitAgentBoundary, capabilityCanonical} from '../capabilities/dispatcher.js';
import type {AgentCapabilityReceipt, AgentCapabilityState, AgentJsonValue} from '../capabilities/types.js';
import type {AgentModelScope} from '../protocol/types.js';
import type {ToolModelBudget, ToolModelLoopOptions, ToolModelLoopOutcome, ToolModelMessage, ToolModelRequest, ToolModelResponse, ToolModelStop} from './types.js';
import {isToolModelContinuation} from './continuation.js';

const fail = (code: string, message: string): ToolModelLoopOutcome => ({ok: false, diagnostics: [{code, message, retryable: false}]});
const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/u.test(value);
const positiveStates = new Set<AgentCapabilityState>(['accepted', 'bound', 'data-ready', 'plan-committed', 'renderer-ready']);
const operations = new Set(['catalog.read', 'result.inspect', 'task.propose', 'task.evaluate', 'experience.propose', 'experience.commit',
  'meaning.propose', 'meaning.activate', 'action.propose', 'action.execute', 'model.egress']);
const bytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).byteLength;
function snapshot<T>(value: T): T {
  if (isToolModelContinuation(value)) return value;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(snapshot)) as T;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, snapshot(child)]))) as T;
}
function validBudget(b: ToolModelBudget): boolean {
  return b !== null && typeof b === 'object' && integer(b.maxTurns, 1, 32) && integer(b.maxModelRequests, 1, 64)
    && integer(b.maxToolCalls, 1, 64) && integer(b.maxMilliseconds, 1, 300_000)
    && integer(b.maxInputTokens, 1, 1_000_000) && integer(b.maxOutputTokens, 1, 100_000)
    && integer(b.maxTotalTokens, 1, 2_000_000) && integer(b.maxInputBytes, 1, WIRE_LIMITS.bytes)
    && integer(b.maxOutputBytes, 1, WIRE_LIMITS.bytes) && integer(b.maxRepeatedCalls, 1, 4);
}
function validPolicy(policy: ToolModelLoopOptions['policy']): boolean {
  if (policy === undefined) return true;
  return policy !== null && typeof policy === 'object' && Array.isArray(policy.requiredOperationSequence)
    && policy.requiredOperationSequence.length > 0 && policy.requiredOperationSequence.length <= 16
    && policy.requiredOperationSequence.every(step => step !== null && typeof step === 'object'
      && typeof step.operation === 'string' && operations.has(step.operation) && Array.isArray(step.acceptedStates)
      && step.acceptedStates.length > 0 && step.acceptedStates.length <= positiveStates.size
      && new Set(step.acceptedStates).size === step.acceptedStates.length
      && step.acceptedStates.every((state: unknown) => typeof state === 'string' && positiveStates.has(state as AgentCapabilityState)));
}
function requiredIndex(policy: ToolModelLoopOptions['policy'], receipts: readonly AgentCapabilityReceipt[]): number {
  if (policy === undefined) return 0;
  let index = 0;
  for (const receipt of receipts) {
    const step = policy.requiredOperationSequence[index];
    if (step !== undefined && receipt.operation === step.operation && step.acceptedStates.includes(receipt.state)) index++;
  }
  return index;
}
function response(input: unknown, limit: number): ToolModelResponse | undefined {
  if (input === null || Array.isArray(input) || typeof input !== 'object') return undefined;
  const continuation = (input as ToolModelResponse).continuation;
  if (continuation !== undefined && !isToolModelContinuation(continuation)) return undefined;
  const {continuation: _continuation, ...wireInput} = input as ToolModelResponse;
  const checked = parseWireValue(wireInput);
  if (!checked.ok || bytes(checked.value) + (continuation?.bytes ?? 0) > limit || checked.value === null || Array.isArray(checked.value) || typeof checked.value !== 'object') return undefined;
  const value = checked.value as unknown as ToolModelResponse;
  if (value.text !== undefined && (typeof value.text !== 'string' || value.text.length > WIRE_LIMITS.text)) return undefined;
  if (!Array.isArray(value.calls) || value.calls.length > 8 || !value.usage
    || !integer(value.usage.inputTokens, 0, 1_000_000) || !integer(value.usage.outputTokens, 0, 100_000)) return undefined;
  const ids = new Set<string>();
  for (const call of value.calls) {
    if (!call || !identifier(call.id) || !identifier(call.name) || ids.has(call.id) || !Object.hasOwn(call, 'input')) return undefined;
    ids.add(call.id);
  }
  const safe = snapshot(value);
  return Object.freeze({...safe, ...(continuation === undefined ? {} : {continuation})});
}

/** A bounded I/O loop around the existing dispatcher, with no provider-specific semantics. */
export async function runToolModel(options: ToolModelLoopOptions): Promise<ToolModelLoopOutcome> {
  if (!options || !identifier(options.requestId) || !['chat', 'experience'].includes(options.goal)
    || typeof options.prompt !== 'string' || options.prompt.length === 0 || options.prompt.length > WIRE_LIMITS.text
    || (options.instructions !== undefined && (typeof options.instructions !== 'string' || options.instructions.length === 0 || options.instructions.length > WIRE_LIMITS.text))
    || !validPolicy(options.policy) || !validBudget(options.budget) || options.endpoint?.transport !== 'byok'
    || typeof options.endpoint.authorizeModel !== 'function' || (typeof options.model?.countInputTokens !== 'function' && typeof options.model?.estimateInputTokens !== 'function')
    || typeof options.model.complete !== 'function') return fail('agent.model.invalid', 'The model loop requires bounded input, a BYOK endpoint, and an application-owned model port.');
  const budget = {...options.budget}, requestId = options.requestId, goal = options.goal;
  const policy = options.policy === undefined ? undefined : snapshot(options.policy);
  const endpoint = options.endpoint;
  const count = options.model.countInputTokens?.bind(options.model);
  const estimate = options.model.estimateInputTokens?.bind(options.model);
  const complete = options.model.complete.bind(options.model);
  const controller = new AbortController();
  const signal = options.signal === undefined ? controller.signal : AbortSignal.any([controller.signal, options.signal]);
  const started = performance.now();
  const left = (): number => Math.max(0, budget.maxMilliseconds - (performance.now() - started));
  const messages: ToolModelMessage[] = [
    ...(options.instructions === undefined ? [] : [{role: 'system' as const, text: options.instructions}]),
    {role: 'user', text: options.prompt},
  ];
  const receipts: AgentCapabilityReceipt[] = [];
  const seen = new Map<string, {fingerprint: string; output: AgentJsonValue}>();
  const repeats = new Map<string, number>();
  let turns = 0, modelRequests = 0, toolCalls = 0, inputTokens = 0, outputTokens = 0;
  let expectedScope: AgentModelScope | undefined;
  const remainingRequired = () => policy?.requiredOperationSequence.slice(requiredIndex(policy, receipts)).map(step => step.operation) ?? [];
  const finish = (stop: ToolModelStop, textDraft?: string): ToolModelLoopOutcome => {
    const incompleteRequiredOperations = remainingRequired();
    return {ok: true, value: snapshot({stop, turns, modelRequests, toolCalls, inputTokens, outputTokens, receipts,
      ...(textDraft === undefined ? {} : {textDraft}), ...(incompleteRequiredOperations.length === 0 ? {} : {incompleteRequiredOperations})})};
  };
  const boundary = async <T>(work: (signal: AbortSignal) => Promise<T>): Promise<T | ToolModelStop> => {
    if (signal.aborted) return 'cancelled';
    if (left() === 0) return 'budget';
    const result = await awaitAgentBoundary(work, signal, left());
    if (result.kind === 'aborted') return 'cancelled';
    if (result.kind === 'deadline') return 'budget';
    if (result.kind === 'failed') return 'failed';
    return result.value;
  };
  const admit = async (transition?: AgentCapabilityReceipt): Promise<ToolModelStop | undefined> => {
    const scope = await boundary(child => endpoint.authorizeModel({signal: child}));
    if (typeof scope === 'string') return scope;
    if (!scope.ok) return scope.diagnostics.some(d => d.code.endsWith('stale')) ? 'stale' : 'denied';
    if (expectedScope !== undefined && capabilityCanonical(expectedScope) !== capabilityCanonical(scope.value)) {
      const before = expectedScope.current, after = scope.value.current;
      if (transition === undefined || expectedScope.principalKey !== scope.value.principalKey || before === undefined || after === undefined) return 'stale';
      const commit = transition.operation === 'experience.commit' && ['plan-committed', 'renderer-ready'].includes(transition.state);
      const stable = ['scopeDigest', 'policyRevision', 'catalogRevision', 'experienceRevision', 'functionRegistryDigest'] as const;
      if (stable.some(pin => before[pin] !== after[pin])) return 'stale';
      if (commit ? after.regionRevision !== transition.regionRevision : !validateCommitReadSet(before, after).ok) return 'stale';
    }
    expectedScope = snapshot(scope.value);
    return undefined;
  };
  try {
    for (let turn = 0; turn < budget.maxTurns; turn++) {
      const admission = await admit();
      if (admission !== undefined) return finish(admission);
      const discovery = await boundary(child => endpoint.discover({signal: child}));
      if (typeof discovery === 'string') return finish(discovery);
      if (!discovery.ok) return finish('denied');
      const required = policy?.requiredOperationSequence[requiredIndex(policy, receipts)];
      const tools = required === undefined ? discovery.value : discovery.value.filter(tool => tool.operation === required.operation);
      if (required !== undefined && tools.length === 0) return finish('failed');
      const request: ToolModelRequest = snapshot({messages, tools, toolChoice: required === undefined ? 'auto' : 'required', maxOutputTokens: budget.maxOutputTokens});
      const countIsRemote = count !== undefined;
      const continuationBytes = request.messages.reduce((total, message) => total + (message.role === 'assistant' ? message.continuation?.bytes ?? 0 : 0), 0);
      if (bytes(request) + continuationBytes > budget.maxInputBytes || modelRequests + (countIsRemote ? 2 : 1) > budget.maxModelRequests) return finish('budget');
      let counted: number | ToolModelStop;
      if (count !== undefined) {
        // A remote counter receives model input, so recheck the independent
        // egress grant before calling it. Local estimation has no transport.
        const countAdmission = await admit();
        if (countAdmission !== undefined) return finish(countAdmission);
        modelRequests++;
        counted = await boundary(child => count(request, {signal: child}));
      } else {
        try {counted = estimate!(request);} catch {return finish('failed');}
      }
      if (typeof counted === 'string') {
        if (['cancelled', 'budget', 'failed'].includes(counted)) return finish(counted as ToolModelStop);
        return finish('failed');
      }
      if (!integer(counted, 1, 1_000_000)) return finish('failed');
      if (counted > budget.maxInputTokens || inputTokens + outputTokens + counted + budget.maxOutputTokens > budget.maxTotalTokens) return finish('budget');
      const modelAdmission = await admit();
      if (modelAdmission !== undefined) return finish(modelAdmission);
      modelRequests++;
      turns++;
      const raw = await boundary(child => complete(request, {signal: child}));
      if (typeof raw === 'string') return finish(raw);
      const candidate = response(raw, budget.maxOutputBytes);
      if (candidate === undefined) return finish('failed');
      inputTokens += candidate.usage.inputTokens;
      outputTokens += candidate.usage.outputTokens;
      if (candidate.usage.inputTokens > budget.maxInputTokens || candidate.usage.outputTokens > budget.maxOutputTokens
        || inputTokens + outputTokens > budget.maxTotalTokens) return finish('budget');
      const outputAdmission = await admit();
      if (outputAdmission !== undefined) return finish(outputAdmission);
      if (candidate.calls.length === 0) {
        if (required === undefined) return finish(goal === 'chat' && candidate.text ? 'text-ready' : 'no-commit', candidate.text);
        if (candidate.text !== undefined || candidate.continuation !== undefined) messages.push({role: 'assistant', ...(candidate.text === undefined ? {} : {text: candidate.text}), calls: [],
          ...(candidate.continuation === undefined ? {} : {continuation: candidate.continuation})});
        messages.push({role: 'system', text: `The host still requires a successful ${required.operation} tool receipt before final text. Continue with the available tool.`});
        continue;
      }
      if (toolCalls + candidate.calls.length > budget.maxToolCalls) return finish('budget');
      if (required !== undefined && candidate.calls.some(call => !tools.some(tool => tool.name === call.name))) {
        toolCalls += candidate.calls.length;
        messages.push({role: 'assistant', ...(candidate.text === undefined ? {} : {text: candidate.text}), calls: candidate.calls,
          ...(candidate.continuation === undefined ? {} : {continuation: candidate.continuation})});
        for (const call of candidate.calls) messages.push({role: 'tool', callId: call.id, output: {ok: false, diagnostics: [{code: 'agent.model.required-operation', message: `The host requires ${required.operation} before this tool.`, retryable: true}]}});
        continue;
      }
      messages.push({role: 'assistant', ...(candidate.text === undefined ? {} : {text: candidate.text}), calls: candidate.calls,
        ...(candidate.continuation === undefined ? {} : {continuation: candidate.continuation})});
      for (const [callIndex, call] of candidate.calls.entries()) {
        if (required !== undefined && callIndex > 0) {
          toolCalls++;
          messages.push({role: 'tool', callId: call.id, output: {ok: false, diagnostics: [{code: 'agent.model.required-operation',
            message: 'The host admits at most one required operation per model response. Continue after the trusted receipt.', retryable: true}]}});
          continue;
        }
        const fresh = await admit();
        if (fresh !== undefined) return finish(fresh);
        const fingerprint = capabilityCanonical({name: call.name, input: call.input, scope: expectedScope === undefined ? undefined : {principalKey: expectedScope.principalKey, current: expectedScope.current === undefined ? undefined : {...expectedScope.current, results: []}}});
        const prior = seen.get(call.id);
        if (prior !== undefined && prior.fingerprint !== fingerprint) return finish('failed');
        const repeated = (repeats.get(fingerprint) ?? 0) + 1;
        repeats.set(fingerprint, repeated);
        if (repeated > budget.maxRepeatedCalls) return finish('no-progress');
        if (prior !== undefined) {messages.push({role: 'tool', callId: call.id, output: prior.output}); continue;}
        toolCalls++;
        const result = await boundary(child => endpoint.invoke(call.name, call.input, {requestId: `${requestId}-${toolCalls}`, signal: child}));
        if (typeof result === 'string') return finish(result);
        // Effects may update the result/read set. Capture a fresh scope only after the
        // dispatcher has rechecked authority; a denied/partial receipt ends this run.
        if (result.ok) {
          receipts.push(result.value);
          if (['partial', 'cancelled', 'failed', 'stale', 'denied'].includes(result.value.state))
            return finish(result.value.state === 'partial' || result.value.state === 'failed' ? 'failed' : result.value.state as ToolModelStop);
        }
        const afterTool = await admit(result.ok ? result.value : undefined);
        if (afterTool !== undefined) return finish(afterTool);
        if (result.ok && result.value.state === 'renderer-ready' && goal === 'experience') return finish('renderer-ready');
        const wire = parseWireValue(result);
        if (!wire.ok || bytes(wire.value) > budget.maxOutputBytes) return finish('budget');
        const output = snapshot(wire.value as AgentJsonValue);
        seen.set(call.id, {fingerprint, output});
        messages.push({role: 'tool', callId: call.id, output});
        if (bytes(messages) > budget.maxInputBytes) return finish('budget');
      }
    }
    return finish(remainingRequired().length === 0 ? 'budget' : 'required-sequence');
  } catch {
    return finish('failed');
  } finally {
    controller.abort();
  }
}
