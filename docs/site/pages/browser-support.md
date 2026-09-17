---
id: "browser-support"
path: "/ship/browser-support/"
section: "Ship"
title: "Browser support"
description: "Separate required web-platform behavior, verified journey coverage, and experimental WebMCP availability."
---

The web package targets current evergreen browsers with Custom Elements, Shadow
DOM, ES modules, `AbortController`, `ResizeObserver`, and modern CSS. The public
site and component library are exercised in Chromium, Firefox, and WebKit.

## Browser behavior

- Components use native controls where they fit and preserve keyboard access.
- Reduced motion and forced colors follow the matching browser preferences.
- Layout adapts to container width and text direction rather than user-agent
  detection.
- Server imports do not register custom elements or read browser globals. Call
  `registerAeliqoElements()` at the client entry point.

## Optional WebMCP

WebMCP is experimental and depends on native browser support. When the browser
does not expose the capability, the playground reports that state and keeps
guided and manual use available. See [WebMCP](/agents/webmcp/) for its limits.
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/agents/webmcp/"><span>WebMCP</span><small>Implement capability detection and manual fallback.</small><b aria-hidden="true">→</b></a><a href="/ship/"><span>Release gate</span><small>Review the full browser and accessibility matrix.</small><b aria-hidden="true">→</b></a></nav>
