import {describe, expect, it} from 'vitest';
import {createUiDevelopmentHost, task} from './host.js';

describe('development deterministic UI completion seam', () => {
  it('evaluates an authorized task, validates a proposal, and commits through the region', async () => {
    const host = createUiDevelopmentHost();
    try {
      const evaluated = await host.evaluateTask(task);
      expect(evaluated.ok).toBe(true);
      expect(evaluated.ok && evaluated.value.state).toBe('data-ready');
      expect(host.outputs()).toHaveLength(1);

      const plan = host.plan();
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      const proposed = await host.propose(plan.value);
      expect(proposed.ok).toBe(true);
      expect(proposed.ok && proposed.value.state).toBe('bound');
      if (!proposed.ok || proposed.value.value === undefined || typeof proposed.value.value !== 'object' || Array.isArray(proposed.value.value)) return;
      const proposalId = (proposed.value.value as {readonly proposalId?: unknown}).proposalId;
      expect(typeof proposalId).toBe('string');
      if (typeof proposalId !== 'string') return;

      const committed = await host.commit(proposalId);
      expect(committed.ok).toBe(true);
      expect(committed.ok && committed.value.state).toBe('renderer-ready');
      expect(host.region.snapshot().state?.presentation?.nodes).toHaveLength(2);
      expect(host.observations.map(observation => `${observation.stage}:${observation.status}`)).toEqual([
        'evaluate:data-ready',
        'propose:bound',
        'commit:renderer-ready',
      ]);
    } finally {
      host.dispose();
    }
  });

  it('rejects malformed proposals while preserving the committed region', async () => {
    const host = createUiDevelopmentHost();
    try {
      expect((await host.evaluateTask(task)).ok).toBe(true);
      const plan = host.plan();
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      const proposed = await host.propose(plan.value);
      expect(proposed.ok).toBe(true);
      if (!proposed.ok || proposed.value.value === undefined || typeof proposed.value.value !== 'object' || Array.isArray(proposed.value.value)) return;
      const proposalId = (proposed.value.value as {readonly proposalId?: unknown}).proposalId;
      expect(typeof proposalId).toBe('string');
      if (typeof proposalId !== 'string') return;
      const committed = await host.commit(proposalId);
      expect(committed.ok).toBe(true);
      expect(committed.ok && committed.value.state).toBe('renderer-ready');
      const before = host.region.snapshot();
      const beforePresentation = before.state?.presentation;
      expect(beforePresentation).toBeDefined();
      const malformed = await host.propose({version: '1', id: 'bad', revision: '1'});
      expect(malformed.ok).toBe(true);
      expect(malformed.ok && malformed.value.state).toBe('invalid');
      const after = host.region.snapshot();
      expect(after.regionRevision).toBe(before.regionRevision);
      expect(after.state?.presentation).toEqual(beforePresentation);
    } finally {
      host.dispose();
    }
  });

  it('rejects a stale proposal after a newer authorized data revision', async () => {
    const host = createUiDevelopmentHost();
    try {
      expect((await host.evaluateTask(task)).ok).toBe(true);
      const plan = host.plan();
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      const proposed = await host.propose(plan.value);
      expect(proposed.ok).toBe(true);
      if (!proposed.ok || proposed.value.value === undefined || typeof proposed.value.value !== 'object' || Array.isArray(proposed.value.value)) return;
      const proposalId = (proposed.value.value as {readonly proposalId?: unknown}).proposalId;
      expect(typeof proposalId).toBe('string');
      if (typeof proposalId !== 'string') return;

      expect((await host.evaluateTask(task)).ok).toBe(true);
      const stale = await host.commit(proposalId);
      expect(stale.ok).toBe(true);
      expect(stale.ok && stale.value.state).toBe('stale');
      expect(host.region.snapshot().state?.presentation).toBeUndefined();
    } finally {
      host.dispose();
    }
  });

  it('prunes retired output generations so a fresh evaluation can be committed', async () => {
    const host = createUiDevelopmentHost();
    try {
      expect((await host.evaluateTask(task)).ok).toBe(true);
      const firstPlan = host.plan();
      expect(firstPlan.ok).toBe(true);
      if (!firstPlan.ok) return;
      const firstProposal = await host.propose(firstPlan.value);
      expect(firstProposal.ok).toBe(true);
      if (!firstProposal.ok || firstProposal.value.value === undefined || typeof firstProposal.value.value !== 'object' || Array.isArray(firstProposal.value.value)) return;
      const firstProposalId = (firstProposal.value.value as {readonly proposalId?: unknown}).proposalId;
      expect(typeof firstProposalId).toBe('string');
      if (typeof firstProposalId !== 'string') return;
      const firstCommit = await host.commit(firstProposalId);
      expect(firstCommit.ok && firstCommit.value.state).toBe('renderer-ready');

      expect((await host.evaluateTask(task)).ok).toBe(true);
      const secondPlan = host.plan();
      expect(secondPlan.ok).toBe(true);
      if (!secondPlan.ok) return;
      const secondProposal = await host.propose(secondPlan.value);
      expect(secondProposal.ok).toBe(true);
      if (!secondProposal.ok || secondProposal.value.value === undefined || typeof secondProposal.value.value !== 'object' || Array.isArray(secondProposal.value.value)) return;
      const secondProposalId = (secondProposal.value.value as {readonly proposalId?: unknown}).proposalId;
      expect(typeof secondProposalId).toBe('string');
      if (typeof secondProposalId !== 'string') return;
      const secondCommit = await host.commit(secondProposalId);
      expect(secondCommit.ok && secondCommit.value.state).toBe('renderer-ready');

      const oldProposal = await host.commit(firstProposalId);
      expect(oldProposal.ok && oldProposal.value.state).toBe('stale');
      expect(host.region.snapshot().state?.presentation).toBeDefined();
      expect(host.outputs()).toHaveLength(1);
    } finally {
      host.dispose();
    }
  });

  it('contains a late revoked commit without restoring region state', async () => {
    const host = createUiDevelopmentHost();
    try {
      expect((await host.evaluateTask(task)).ok).toBe(true);
      const plan = host.plan();
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      const proposed = await host.propose(plan.value);
      expect(proposed.ok).toBe(true);
      if (!proposed.ok || proposed.value.value === undefined || typeof proposed.value.value !== 'object' || Array.isArray(proposed.value.value)) return;
      const proposalId = (proposed.value.value as {readonly proposalId?: unknown}).proposalId;
      expect(typeof proposalId).toBe('string');
      if (typeof proposalId !== 'string') return;

      host.holdNextCommit();
      const late = host.commit(proposalId);
      await host.waitForCommitAuthorization();
      host.revoke('development revocation');
      const result = await late;
      expect(result.ok).toBe(true);
      expect(result.ok && result.value.state).toBe('partial');
      expect(host.region.snapshot().status).toBe('revoked');
      expect(host.observations.some(observation => observation.stage === 'revoke')).toBe(true);
    } finally {
      host.dispose();
    }
  });
});
