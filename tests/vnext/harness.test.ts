import { describe, expect, it } from 'vitest';
import { fixtureRows } from './fixtures/people';

describe('vNext test harness', () => {
  it('uses deterministic synthetic identities and no production data', () => {
    expect(fixtureRows.map((row) => row.id)).toEqual(['ada', 'sam']);
    expect(fixtureRows.map((row) => row.team)).toEqual(['Design', 'Engineering']);
  });
});
