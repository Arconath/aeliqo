import { describe, expect, it } from 'vitest';
import { RelaySessionBroker } from '../src/broker.js';
import type { BridgeCall, BridgeCancel } from '../src/protocol.js';

type Sent = { event: 'call' | 'cancel'; value: BridgeCall | BridgeCancel };

function attach(broker: RelaySessionBroker, sent: Sent[] = []): { sent: Sent[]; closed: () => boolean } {
  let closed = false;
  const attachment = broker.attach(
    (event, value) => sent.push({ event, value }),
    () => {
      closed = true;
    },
  );
  expect(attachment).toBeDefined();
  return { sent, closed: () => closed };
}

describe('RelaySessionBroker', () => {
  it('bridges a bounded outcome to the matching pending call', async () => {
    const broker = new RelaySessionBroker({ surface: 'playground', expiresAt: Date.now() + 60_000 });
    const { sent } = attach(broker);
    const pending = broker.endpoint().discover();
    const call = sent[0]!.value as BridgeCall;
    expect(sent[0]!.event).toBe('call');
    expect(call.operation).toBe('discover');
    expect(call.transport).toBe('mcp');
    expect(broker.acknowledge(call.id, { ok: true, value: [{ name: 'aeliqo_context' }] })).toBe(true);
    await expect(pending).resolves.toEqual({ ok: true, value: [{ name: 'aeliqo_context' }] });
    broker.dispose();
  });

  it('labels the endpoint with the surface namespace', () => {
    const broker = new RelaySessionBroker({ surface: 'playground', expiresAt: Date.now() + 60_000 });
    const endpoint = broker.endpoint();
    expect(endpoint.transport).toBe('mcp');
    expect(endpoint.targetRegionId).toBe('playground-main');
    expect(endpoint.goalEpoch).toBe('playground-relay');
    broker.dispose();
  });

  it('rejects stale acknowledgments and isolates a replacement stream', () => {
    const broker = new RelaySessionBroker({ surface: 'playground', expiresAt: Date.now() + 60_000 });
    let firstClosed = false;
    const first = broker.attach(
      () => {},
      () => {
        firstClosed = true;
      },
    );
    const second = broker.attach(
      () => {},
      () => {},
    );
    expect(firstClosed).toBe(true);
    broker.detach(first);
    expect(broker.connected).toBe(true);
    broker.detach(second);
    expect(broker.connected).toBe(false);
    expect(broker.acknowledge('unknown', { ok: true, value: {} })).toBe(false);
    broker.dispose();
  });

  it('cancels in-flight work on abort and refuses a late result', async () => {
    const broker = new RelaySessionBroker({ surface: 'playground', expiresAt: Date.now() + 60_000 });
    const { sent } = attach(broker);
    const controller = new AbortController();
    const pending = broker.endpoint().discover({ signal: controller.signal });
    controller.abort();
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0]!.code).toBe('aeliqo.relay-cancelled');
    const cancel = sent.at(-1)!;
    expect(cancel.event).toBe('cancel');
    expect(broker.acknowledge((sent[0]!.value as BridgeCall).id, { ok: true, value: {} })).toBe(false);
    broker.dispose();
  });

  it('fails immediately when disconnected, already aborted, or the stream write throws', async () => {
    const detached = new RelaySessionBroker({ surface: 'playground', expiresAt: Date.now() + 60_000 });
    const outcome = await detached.endpoint().discover();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.diagnostics[0]!.code).toBe('aeliqo.relay-disconnected');

    const cancelled = new RelaySessionBroker({ surface: 'playground', expiresAt: Date.now() + 60_000 });
    attach(cancelled);
    const controller = new AbortController();
    controller.abort();
    const aborted = await cancelled.endpoint().discover({ signal: controller.signal });
    if (!aborted.ok) expect(aborted.diagnostics[0]!.code).toBe('aeliqo.relay-cancelled');
    cancelled.dispose();

    const broken = new RelaySessionBroker({ surface: 'playground', expiresAt: Date.now() + 60_000 });
    brokerThrowing(broken);
    const failed = await broken.endpoint().discover();
    if (!failed.ok) expect(failed.diagnostics[0]!.code).toBe('aeliqo.relay-disconnected');
    broken.dispose();
  });

  it('enforces the pending-call cap and the call timeout', async () => {
    const broker = new RelaySessionBroker({
      surface: 'playground',
      expiresAt: Date.now() + 60_000,
      maxPending: 1,
      callTimeoutMs: 25,
    });
    const { sent } = attach(broker);
    const first = broker.endpoint().discover();
    const second = await broker.endpoint().discover();
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.diagnostics[0]!.code).toBe('aeliqo.relay-busy');
    broker.acknowledge((sent[0]!.value as BridgeCall).id, { ok: true, value: [] });
    await first;

    const timedOut = await broker.endpoint().discover();
    expect(timedOut.ok).toBe(false);
    if (!timedOut.ok) expect(timedOut.diagnostics[0]!.code).toBe('aeliqo.relay-cancelled');
    broker.dispose();
  });

  it('rejects oversized or malformed outcomes', async () => {
    const broker = new RelaySessionBroker({ surface: 'playground', expiresAt: Date.now() + 60_000 });
    const { sent } = attach(broker);
    const pending = broker.endpoint().discover();
    const id = (sent[0]!.value as BridgeCall).id;
    expect(broker.acknowledge(id, { ok: true, value: 'x'.repeat(70_000) })).toBe(false);
    expect(broker.acknowledge(id, 'not-an-outcome')).toBe(false);
    expect(broker.acknowledge(id, { ok: true, value: [] })).toBe(true);
    await pending;
    broker.dispose();
  });

  it('expires and fails pending calls on dispose', async () => {
    const expired = new RelaySessionBroker({ surface: 'playground', expiresAt: Date.now() - 1 });
    expect(
      expired.attach(
        () => {},
        () => {},
      ),
    ).toBeUndefined();
    expect((await expired.endpoint().discover()).ok).toBe(false);

    const broker = new RelaySessionBroker({ surface: 'playground', expiresAt: Date.now() + 60_000 });
    const { sent, closed } = attach(broker);
    const pending = broker.endpoint().discover();
    broker.dispose();
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0]!.code).toBe('aeliqo.relay-disconnected');
    expect(closed()).toBe(true);
    expect(sent).toHaveLength(1);
    broker.dispose();
  });
});

function brokerThrowing(broker: RelaySessionBroker): void {
  broker.attach(
    () => {
      throw new Error('stream closed');
    },
    () => {},
  );
}
