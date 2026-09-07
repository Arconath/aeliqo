# @aeliqo/runtime

Effectful Aeliqo integration, separate from the pure core. Version 0.1.0 is under
implementation; the full ADC host/client and evaluator are not complete.

The `@aeliqo/runtime/data` entry currently exports `readResultStream` and
`DataStreamError`. The async generator checks bounded NDJSON framing, canonical
event shape, accepted query/output/scope pins, stable result lineage, batch
sequence, progress and terminal events. Supply explicit byte, per-message,
message-count and row budgets and connect the host's cancellation signal.
Cancellation and early consumer exit cancel the reader and release its lock.

A completion event is withheld until EOF validates that no trailing event exists.
A dropped stream throws a structured error; already delivered batches remain
provisional. The caller must not mark those batches complete before receiving a
validated terminal event. Source error events remain error events, not completion.
The caller also owns the transport deadline and authenticated plan context.

These checks establish framing and lineage, not arithmetic correctness, field
authorization, completeness truth, or permission to send results to a model.
The host and later data/evaluation passes retain those responsibilities.
