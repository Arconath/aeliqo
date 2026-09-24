---
id: 'scopes'
path: '/guides/scopes/'
section: 'Build'
title: 'Application scopes'
description: 'Bind surfaces to a host-authorized workspace and fence stale work across voluntary switches and revocation.'
---

<p class="lead">A workspace ID selects a candidate context; it is never a permission grant. The application owns identity, policy, data access, drafts, navigation, and effects. Aeliqo binds each child surface and its work to one authorized scope activation.</p>

## Resolve and authorize in the host

Create a scope at the application composition root with `runtime.createScope({ initial, binding })`. The binding resolves the selector and authorizes the target using current host state. `prepareActivation` synchronously rechecks the target and captured previous revisions before acceptance; `activate` commits host effects; `deactivate` compensates them. `attach()` starts the initially inert scope. The full typed binding example and lifecycle contract are in the [runtime package guide](/reference/packages/).

Keep the host's data and action permissions on every request. A child Result, cursor, proposal, action, subscription, and renderer address carries the activation it started under. A later activation with the same workspace ID has a new epoch: late work from A1 cannot commit to A2 after a switch through B.

## Voluntary switch and dirty work

For a user-requested switch, call `requestChange(selector)`. A dirty form may ask the host to Save, Discard, or Stay through `readLeaveState` and `beforeLeave`. While that decision is pending, the old authorized subtree remains labeled with its old workspace. Failed or stale save and denied target resolution leave it in place. Once acceptance succeeds, the old activation is fenced before the new one starts effects.

## Forced revocation

Call `invalidate('logout' | 'revoked' | 'expired' | 'external-switch')` when authority is lost. Invalidation masks the scope and fences children synchronously, even when a voluntary dirty-work guard is open. A recovery hook may navigate afterward, but cannot delay the fence. Do not show cached rows from the revoked activation as a failure fallback.

## Layout remains within one scope

Changing a workspace from single to split or compare changes presentation, not tenancy. Child surfaces keep stable identities and one owner each. A proposed composition with a cross-scope child, cycle, duplicate owner, stale child revision, or exceeded depth/node/fan-out bound must be rejected. See [workspace composition](/guides/workspace/) for the presentation side and [permissions](/guides/permissions/) for the authority boundary.

The public 0.5 scope API does not make a client-supplied workspace selector trustworthy or replace host authentication and server authorization.
