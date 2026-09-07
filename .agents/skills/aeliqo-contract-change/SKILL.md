---
name: aeliqo-contract-change
description: Change a canonical Aeliqo contract, schema, wire format or compiler boundary.
---

# aeliqo-contract-change

Read docs/00-decisions.md, docs/01-architecture.md and the relevant contract chapter only. Identify affected producers/consumers and version rules. Change the schema source once; generate types/validators. Add round-trip, malformed-input, authority and migration tests. No browser/provider/database dependency in core. Report compatibility and a concrete consumer test before integration.
