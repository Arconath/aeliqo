# Aeliqo site working agreements

- This directory owns the `aeliqo.com` presentation and delivery shell inside
  the public `Arconath/aeliqo` repository. Do not copy or develop a second
  framework here.
- Public documentation source, API metadata, runnable examples, framework
  packages, docs and playground now share this repository. Update canonical
  framework/docs sources before refreshing the site's exact vendored input.
- Site builds must use one exact checksum-verified SDK/docs source identity.
  Never add workspace links, sibling-checkout imports, mutable branch URLs, or
  `latest` dependencies.
- Run `pnpm verify:inputs` before build/test. Preserve all routes, accessibility,
  local-draft behavior, disabled-by-default telemetry, and honest availability
  wording.
- Pull-request and main quality use GitHub-hosted runners with read-only source
  permissions. Never execute public pull-request code on the private R640 runner.
  Image publication remains an explicit owner-only exact-main effect, and GitOps
  promotion stays separate.
