# Local-only agent configuration

No active model configuration is shipped because the user's client/model IDs and supported effort values have not been observed. Select Astra / medium in the actual client. Verify Luna / max and runtime concurrency support before delegating. See docs/19-harness.md.

`python3 scripts/configure_agents.py --capabilities path/to/verified.json` previews a local config; add `--apply` only after reviewing it. The generator refuses placeholders, unsupported keys/efforts and existing config files. It does not alter global plugins/skills or prove the client accepted a generated config. Run the client's supported validation and a small actual delegation smoke afterward.
