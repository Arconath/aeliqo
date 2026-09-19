export interface ControlledProposal<I> {
  readonly id: string;
  readonly intent: I;
  readonly expectedRevision: string;
}

export interface ControlledHostFixtureContract<I, S> {
  readonly getSnapshot: () => S;
  readonly subscribe: (listener: () => void) => () => void;
  readonly proposals: readonly ControlledProposal<I>[];
  readonly accept: (proposalId: string) => Promise<void>;
  readonly reject: (proposalId: string) => Promise<void>;
}

// The real controlled fixture is implemented with the production surface
// controller in T03; no fake dispatcher belongs in the baseline harness.
