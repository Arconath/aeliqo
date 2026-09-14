# Next.js platform proof

This narrow App Router fixture server-renders a trusted Lit template through the
built web package, then imports hydration support before element registration.
Its client host accepts typed input proposals and owns form state. It is a
platform test, not the public site or a claim that all Aeliqo components support
Next.js. The HTML insertion contains only the trusted renderer's escaped output.

Run the root `test:next-platform` command after building the web package. The
separate Lit hydration fixture covers pre-upgrade draft/focus preservation.

This import order follows [Lit client hydration documentation](https://lit.dev/docs/ssr/client-usage/).
The server package isolation uses [Next serverExternalPackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages).
These upstream mechanisms still require the actual fixture tests to pass.
