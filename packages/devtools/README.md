# `@aeliqo/devtools`

The local, OSS Studio document and authoring controller. It edits the same
versioned Catalog, meaning drafts, and Experience contracts used by code. The
package has no model, cloud, credential, filesystem, or DOM dependency.

`createStudioSession` is deliberately host-neutral: applications provide a
catalog and function registry, choose their local persistence, and decide when
an exported document is reviewed and activated.
