import {readFileSync} from 'node:fs';
import {Ajv2020} from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {describe, expect, it} from 'vitest';
import {parseContract, serializeContract, type QuerySpec} from '../../packages/core/src/index.js';
import {query} from './fixtures.js';

const ajv = new Ajv2020({strict: false});
addFormats(ajv);
const validate = ajv.compile(JSON.parse(readFileSync(new URL('../../packages/core/schemas/query.schema.json', import.meta.url), 'utf8')));
const relation = {id: 'orders.tags', revision: '1'};

describe('explicit relation usage wire boundary', () => {
  it('roundtrips each explicit join kind and preserves opaque IDs and target predicates', () => {
    for (const kind of ['inner', 'left', 'semi'] as const) {
      const value: QuerySpec = {...query, relations: [relation], relationUsage: [{relation, kind,
        where: {op: 'compare', field: 'target.field.with.dots', comparison: 'eq', value: 'eligible'}}]};
      expect(validate(value)).toBe(true);
      const parsed = parseContract('query', value);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) throw new Error('query failed');
      const serialized = serializeContract('query', parsed.value);
      expect(serialized.ok).toBe(true);
      if (!serialized.ok) throw new Error('serialization failed');
      expect(parseContract('query', serialized.value)).toEqual(parsed);
    }
    expect(parseContract('query', query).ok).toBe(true);
  });
  it('rejects missing semantics, authority injection and raw query text in both validators', () => {
    for (const usage of [
      {relation}, {relation, kind: 'cross'}, {relation, kind: 'semi', approved: true},
      {relation, kind: 'inner', where: 'SELECT * FROM tags'},
      {relation: {...relation, actor: 'admin'}, kind: 'left'},
    ]) {
      const value = {...query, relationUsage: [usage]};
      expect(parseContract('query', value).ok).toBe(false);
      expect(validate(value)).toBe(false);
    }
  });
});
