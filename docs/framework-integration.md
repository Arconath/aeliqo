# Framework integration

Aeliqo has one browser implementation. `@aeliqo/sdk-web` owns the Lit custom
elements and their properties, events, form behavior, and rendering. React
uses thin `@lit/react` wrappers around those same elements. Vue and other
frameworks use the custom-element surface directly. There is no second
component implementation per framework.

The maintained runnable recipes are indexed by
[`frameworkRecipes`](../examples/framework-recipes.ts). The source paths in
that index point at the fixtures used by the browser and installed-package
checks.

## Vanilla

Install `@aeliqo/sdk-web`, register elements once at the application boundary, and
set typed properties on the element. A normal DOM listener receives the typed
`aeliqo-input` event; a native `FormData` submission remains available.

```ts
import {
  AeliqoInputEvent,
  registerAeliqoElements,
  type AeliqoInputElement,
} from "@aeliqo/sdk-web";

registerAeliqoElements();
const input = document.querySelector<AeliqoInputElement>("aeliqo-input");
if (!input) throw new Error("Input is missing");
input.addEventListener("aeliqo-input", (event) => {
  if (event instanceof AeliqoInputEvent) {
    input.value = event.detail.value;
  }
});
```

## React

Import the root binding or a family subpath. Call
`registerAeliqoReactElements()` once in the browser entry. React properties
are controlled by the host and custom-element events become typed callback
props.

```tsx
import {useState} from "react";
import {
  AeliqoInput,
  AeliqoTable,
  registerAeliqoReactElements,
} from "@aeliqo/sdk-react";

registerAeliqoReactElements();

export function PeopleForm() {
  const [name, setName] = useState("Ada");
  return <>
    <AeliqoInput
      label="Person"
      value={name}
      onAeliqoInput={(event) => setName(event.detail.value)}
    />
    <AeliqoTable
      caption="People"
      columns={[{key: "name", label: "Name"}]}
      rows={[{name}]}
    />
  </>;
}
```

The React package exports thin wrappers for all 71 catalog entries. The
`@aeliqo/sdk-react/foundation`, `/inputs`, `/navigation`, `/feedback`, `/data`,
`/plot`, `/visualization`, and `/compound` subpaths are available when a
consumer wants a narrower import boundary. A direct component stays direct:
it does not start a planner, a runtime region, an agent, or a model call.

### React server rendering and hydration

SSR is opt-in. Import `@aeliqo/sdk-react/ssr` before the bindings in the server
entry and in the client hydration entry. The server output contains Lit's
declarative shadow root; the host must preserve that markup and load Lit
hydration support before registering the browser elements. Ordinary imports do
not read browser globals or enable SSR as a side effect.

```tsx
// server entry
import "@aeliqo/sdk-react/ssr";
import {AeliqoInput} from "@aeliqo/sdk-react";
import {renderToString} from "react-dom/server";
import {createElement} from "react";

const html = renderToString(
  createElement(AeliqoInput, {label: "Person", value: "Ada"}),
);
```

The production-shaped App Router recipe is in
[`examples/next-platform`](../examples/next-platform). Its client entry loads
`@lit-labs/ssr-client/lit-element-hydrate-support.js` before registering the
elements and retains the host-owned event/property boundary.

## Vue

Vue embeds the same registered custom element. Keep data in Vue state and pass
element properties through `h` or a template. Use the event name in its DOM
form (`onAeliqo-input` for `aeliqo-input`).

```ts
import {createApp, h, ref} from "vue";
import {AeliqoInputEvent, registerAeliqoElements} from "@aeliqo/sdk-web";

registerAeliqoElements();
const App = {
  setup() {
    const value = ref("Vue");
    return () => h("aeliqo-input", {
      label: "Person",
      value: value.value,
      "onAeliqo-input": (event: Event) => {
        if (event instanceof AeliqoInputEvent) value.value = event.detail.value;
      },
    });
  },
};
createApp(App).mount(document.querySelector("#app")!);
```

## Meaning authoring is independent of the UI

Developer-authored meanings use `@aeliqo/sdk-core` and
`@aeliqo/sdk-runtime/meaning`. They reuse the application Catalog, preserve field
identity and type information, and return the same typed expression/evaluator
contracts used by other authoring surfaces. The path does not import a model,
Studio, chart, layout, or framework package.

```ts
import {createStandardFunctionRegistry, type Catalog} from "@aeliqo/sdk-core";
import {createMeaningAuthoring} from "@aeliqo/sdk-runtime/meaning";

const registry = createStandardFunctionRegistry("app-functions");
if (!registry.ok) throw new Error("Cannot create function registry");
const catalog = {
  version: "1",
  revision: "app-catalog",
  functionRegistryDigest: registry.value.digest,
  entities: [{
    id: "orders", label: "Orders", identity: ["id"], rowGrain: ["id"],
    fields: [
      {id: "id", label: "ID", role: "identity", type: {value: "text", nullable: false}},
      {id: "amount", label: "Amount", role: "measure", type: {value: "integer", nullable: false}},
    ],
  }],
  relationships: [], meanings: [], capabilities: [],
} as const satisfies Catalog;

const authoring = createMeaningAuthoring({catalog, registry: registry.value});
if (!authoring.ok) throw new Error("Catalog is invalid");
const amount = authoring.value.field("orders", "amount");
if (!amount.ok) throw new Error("Amount field is unavailable");
const total = authoring.value.call({id: "core.aggregate.sum", revision: "1"}, [amount]);
if (!total.ok) throw new Error("Meaning is invalid");
const definition = authoring.value.defineMeaning({
  id: "orders.total", label: "Order total", description: "Sum of order amounts",
  expression: total.value,
});
if (!definition.ok) throw new Error("Meaning definition is invalid");
```

With a literal Catalog, the field helper also gives useful compile-time
feedback:

```ts
// @ts-expect-error `missing` is not a field in the reused `orders` schema.
authoring.value.field("orders", "missing");
```

Meaning definitions contain semantic identity, units, grain, and dependencies;
they do not choose a chart or layout. The same definition can feed a table,
ranking, or trend after the host has authorized and evaluated the relevant
result.

## Verification

Run the focused external proof after dependencies are installed:

```sh
node tests/framework-consumers/framework-tarballs.mjs
```

It packs `@aeliqo/sdk-core`, `@aeliqo/sdk-runtime`, `@aeliqo/sdk-web`, and `@aeliqo/sdk-react`,
installs those exact tarballs in a temporary directory outside the workspace,
strictly type-checks vanilla/React/Vue plus the meaning quickstart, renders a
React SSR fixture, and exercises properties/events in Chromium. Existing
platform and Next fixtures add CSP, native form, and App Router hydration
coverage.
