# Local Studio and DevTools

`@aeliqo/devtools` is the local OSS authoring surface for Aeliqo. It has four
areas: **Data & Meaning**, **Experience**, **Component Gallery**, and
**Inspect**. It does not require an account, cloud service, model key, or
provider connection.

Studio and code/config edit one versioned document model. The application
catalog and function registry are passed into the package by the host. A
Studio export contains the canonical catalog reference, meaning drafts,
Experience profiles, active profile, and token profile. It deliberately omits
credentials and result rows.

```ts
import {createStudioDocument, createStudioSession} from '@aeliqo/devtools';

const document = createStudioDocument(input, {registry});
if (!document.ok) throw new Error(document.diagnostics[0].message);

const studio = createStudioSession(document.value, {registry});
const draft = studio.defineMeaning({
  id: 'employees.total',
  label: 'Total amount',
  description: 'Sum of employee amounts.',
  entity: 'employees',
  field: 'amount',
});
const exportFile = studio.exportDocument();
const exportCode = studio.exportCode();
```

Meaning edits use the same typed authoring and validation path as developer
code. Code-owned entries are marked read-only and can be inspected or turned
into a proposed diff; a Studio draft has its own ownership and revision. An
immutable ID/revision cannot silently acquire different canonical contents.

Experience controls are bounded to profile mode, approved representation and
pattern references, token theme, and preview state. The Gallery mounts the
actual shared web elements. Inspect exposes catalog/registry/profile revisions,
ownership counts, and the exact export so a reviewer can compare the document
before activation.

The checked-in app under `apps/studio` is a small Vite host for these APIs. A
release build should build `@aeliqo/core`, `@aeliqo/runtime`, `@aeliqo/web`,
`@aeliqo/devtools`, and then the Studio app. The Studio browser suite runs
against that local host and exercises all four areas, manual meaning creation,
and a file download export.
