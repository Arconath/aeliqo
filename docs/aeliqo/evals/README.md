# Outcome evaluation specifications

`routing-cases.jsonl` contains 36 proposed end-to-end routing cases. `data-cases.jsonl` contains 26 semantic cases with synthetic inputs. **These are test specifications, not executed PoC tests or an agent scorecard.** The reconciled repository does not ship the original kit validator. An implementation must bind selected cases to real fixtures and assertions before claiming evidence.

Use deterministic runtime tests first, then a real-client/harness suite for routing. Record client build, model identifier, settings, tool availability, instructions/config, paired workspace, input prompt, trial count and results. Do not force a particular tool sequence when multiple valid paths produce the same outcome. Never score a verbose chat answer as a successful UI mutation. Negative cases (no unauthorized mutation, no false completed status, no data leak) are strict invariants.

Report successes/eligible trials, false mutation count, false completion count, unsupported capability cases and reasons separately. Split unsupported environments from eligible supported tests without hiding the overall coverage. Repeat with paraphrases and hold-out prompts. A 95% observed routing target in the engineering plan is not a universal success guarantee or an acceptable 5% unauthorized mutation rate.

Cases D01–D26 test the actual DataPort/semantic implementation. A hand-written separate evaluator that merely reproduces the expected answer does not test the PoC. External FX/pricing examples are deliberately synthetic; do not use them as live market data. Pending/limited/resolve-target outcomes can be correct depending on fixture capability and user authorization.
