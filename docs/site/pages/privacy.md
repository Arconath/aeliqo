---
id: "privacy"
path: "/legal/privacy/"
section: "About"
title: "Privacy"
description: "How the public documentation and synthetic playground handle data."
---

<p class="lead">The public playground is designed to run synthetic data without a model provider.</p><h2>Local state</h2><p>Filtering and evaluation run in the browser. Guided and manual demo state is local to the session and can be reset. Exports must never include provider keys or private records.</p><h2>Optional analytics</h2><p>If production analytics are enabled, the site asks before loading them. Aggregate events exclude form content, URL query parameters, credentials, and direct identity.</p><h2>Connected agents</h2><p>MCP or BYOK requires a user-run host. That host must disclose provider egress and retain keys only in the trusted process. Native WebMCP follows browser capability and policy.</p><h2>External links</h2><p>Opening GitHub, npm, or another external service sends a request to that destination.</p>
