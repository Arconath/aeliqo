import type { DataService, LocalSnapshot } from '@aeliqo/runtime/data';
import type { AeliqoRuntime } from '@aeliqo/runtime';
import { z } from 'zod';

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  team: z.enum(['Design', 'Engineering']),
});

export type Person = z.infer<typeof PersonSchema>;

export const fixtureRows: readonly Person[] = Object.freeze([
  Object.freeze({ id: 'ada', name: 'Ada Chen', team: 'Design' as const }),
  Object.freeze({ id: 'sam', name: 'Sam Rivera', team: 'Engineering' as const }),
]);

export const updatedRows: readonly Person[] = Object.freeze([
  fixtureRows[0]!,
  Object.freeze({ id: 'sam', name: 'Sam Rivera', team: 'Design' as const }),
]);

export interface PeopleFixtureContract {
  readonly runtime: AeliqoRuntime;
  readonly source: DataService;
  readonly updatedSnapshot: LocalSnapshot;
  readonly dispose: () => void | Promise<void>;
}

// Runtime construction is added by the owning vNext tasks. Keeping this file
// data- and type-only prevents the harness from manufacturing product success.
