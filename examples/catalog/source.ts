/**
 * Build a copyable TypeScript example from the same mount function used by
 * the catalog.  The generated snippet deliberately owns its host, fixture
 * helpers, registration call, and invocation so it can be pasted into a
 * small application without importing this examples package.
 */
export interface CatalogSourceOptions {
  readonly imports: string;
  readonly setup?: string;
  readonly mount: Function;
}

export function catalogSource({imports, setup = "", mount}: CatalogSourceOptions): string {
  // Vite's SSR transform rewrites imported bindings inside function source
  // strings.  Restore ordinary lexical references so the copied snippet uses
  // the helper and fixture declarations included below instead of an
  // internal Vite namespace that does not exist in a consumer bundle.
  const mountSource = mount.toString()
    .replace(/\(0,__vite_ssr_import_\d+__\./g, "(")
    .replace(/__vite_ssr_import_\d+__\./g, "")
    .replace(/document\.createElement\(([\"'`]aeliqo-[^\"'`]+[\"'`])\)/g, "document.createElement($1) as any");
  return `${imports.trim()}

${setup.trim()}

registerAeliqoElements();

const host = document.querySelector<HTMLElement>("#aeliqo-example") ?? (() => {
  const created = document.createElement("div");
  created.id = "aeliqo-example";
  (document.body ?? document.documentElement).append(created);
  return created;
})();

function createCatalogRoot(container: HTMLElement): HTMLElement {
  const root = document.createElement("div");
  root.dataset.catalogSourceRoot = "true";
  root.style.display = "grid";
  root.style.gap = "12px";
  container.append(root);
  return root;
}

type CatalogElement = HTMLElement & Record<string, any>;

function createCatalogElement<T extends HTMLElement = CatalogElement>(tagName: string, container: HTMLElement): T & CatalogElement {
  const element = document.createElement(tagName) as T & CatalogElement;
  container.append(element);
  return element;
}

function appendSlottedText(root: HTMLElement, slot: string, textContent: string): void {
  const content = document.createElement("span");
  content.slot = slot;
  content.textContent = textContent;
  root.append(content);
}

const root = createCatalogRoot(host);
(${mountSource})(root);
`;
}
