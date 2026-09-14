# @aeliqo/testkit

Bounded helpers for testing Aeliqo host integrations. The package consumes the
public runtime result-stream and result-store types; it does not create a
second authorization or materialization implementation.

`@aeliqo/testkit` is Apache-2.0 source in this repository, but it is an
internal workspace (`private: true`), not a public npm artifact. It may be
packed and installed by local security/consumer tests to verify its boundary;
that does not authorize registry publication or make it part of the six public
Aeliqo packages.
