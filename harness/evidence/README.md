# Evidence, not assertions

There are deliberately no passing product evidence files in this kit.

`gate.py` expects task/component references to real local artifacts with SHA-256 hashes, a product command ledger, and integrated candidate evidence. It checks structure and bytes, not whether a screenshot genuinely demonstrates good UX; CI and independent/human review remain essential. Never create a fake report to satisfy a field.

Per-task example shape: `{"path":"artifacts/tests/actual-log.txt","sha256":"<actual 64 hex digest>"}`. Examples are not evidence. Evidence outside the repository or following a symlink is rejected. Large artifacts may be downloaded from a verifiable CI run before the local gate; retain CI identities and artifact hashes.

The integrated report goes at `harness/evidence/integrated.json` and binds `subjectSha256` to `scripts/gate.py`'s current candidate digest. Its required claims are actual tests, browser matrix, visual review, package consumers, performance, security, real MCP/BYOK, and independent review. Manual assistive-technology certification is deferred beyond 0.1.0 and must not be claimed. Native WebMCP is required only when advertised as natively verified; otherwise keep it explicitly experimental/unverified.

For stable release, append actual source release, npm integrity, site digest and rollback verification claims. Evidence cannot silently convert blocked credential-dependent work into pass.


Completed tasks also record `review: {author, reviewer, status: "approved", artifacts: [...]}` with different real author/reviewer identities. Component evidence entries include `kind` matching every `evidenceRequired` category. Completed scenarios include evidence artifacts; only native-host scenario S24 may remain unverified while native WebMCP is explicitly experimental and not advertised as verified.
