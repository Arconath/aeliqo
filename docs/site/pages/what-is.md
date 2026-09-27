---
id: 'what-is'
path: '/start/what-is-aeliqo/'
section: 'Get started'
title: 'What is Aeliqo?'
description: 'Understand how application requests, registered data, and available space determine a view.'
---

## Follow a People request

Suppose your application has people with an ID, a name, and a team. A user wants
to browse the Engineering team. Your code submits a typed request containing
that resource and filter. Aeliqo checks the fields and current permissions,
reads a bounded result through your adapter, and selects an allowed view.

In a wide container that view can be a table. In a narrow container it can be
cards. The records still have the same identity. Resizing changes presentation;
it does not grant access or require a model call.

A button, a route, or an agent can submit the request. An agent is optional.
The [quickstart](/start/) starts with an even smaller local data surface so you
can see this adaptation before registering an application.

## The pieces you will use

| Piece | Its job | People example |
| --- | --- | --- |
| Resource | Declare fields, identity, meanings, and allowed presentation | A person has a stable `id`; `team` is a dimension |
| Data service | Evaluate a bounded request using application data | Read the permitted employees |
| Authority | Supply the current trusted application context | Identify the user and their allowed operations |
| Intent | Describe the requested task | Browse people filtered to Engineering |
| Region | Mount and manage one current presentation | The People panel in your existing page |
| View or recipe | Render approved results using registered UI | Choose a table or cards for the available space |

Start with one region. A [workspace](/guides/workspace/) can compose several
results and host-registered layouts as the application grows. State ownership,
draft exits, and scope changes must remain explicit across those transitions.

## Decide what to register

Use a local surface when the host already owns a read-only array. Register an
application when you need named resources, real authorization, actions, or
shared agent access. Register custom views when your domain requires a specific
presentation. The [component catalog](/components/) shows which built-in
components support standalone use, semantic binding, or automatic adaptation.

Your application continues to authenticate users, authorize server requests,
execute business commands, and own navigation. Aeliqo validates proposals and
coordinates its registered runtime and rendering paths. A model output remains
untrusted even if its JSON has the right shape.

## Recognize a successful request

A mounted request reports `renderer-ready` when its result has rendered.
Other outcomes can ask for input, deny access, reject an unsupported view,
report a failure, or cancel superseded work. Handle those outcomes in the host;
do not replace a valid authorized result with a blank screen after a failed
update. Forced revocation has a separate duty to remove access.

## Choose the first step

Run the [React quickstart](/start/) to filter five people and change the
presentation by resizing. If you already have an application, follow
[the adoption guide](/start/existing-app/). For the package boundaries and
request lifecycle, continue to [system concepts](/concepts/) afterward.
