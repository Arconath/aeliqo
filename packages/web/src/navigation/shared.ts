import {css} from "lit";

export const aeliqoNavigationStyles = css`
  :host {
    color: var(--aeliqo-color-text, #111827);
    display: block;
    font: inherit;
    max-inline-size: 100%;
  }

  :is(button, a, [role="treeitem"], [role="tab"]):focus-visible {
    outline: var(--aeliqo-focus-width, 0.1875rem) solid var(--aeliqo-color-focus, #4338ca);
    outline-offset: var(--aeliqo-focus-offset, 0.125rem);
  }

  button {
    color: inherit;
    font: inherit;
  }
`;

export const interactiveSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Collect focusable controls through slots and nested open shadow roots. */
export function focusableElements(root: ParentNode): HTMLElement[] {
  const result: HTMLElement[] = [];
  const visit = (node: ParentNode): void => {
    if (node instanceof HTMLElement && node.matches(interactiveSelector)) result.push(node);
    if (node instanceof HTMLSlotElement) {
      for (const assigned of node.assignedElements({flatten: true})) visit(assigned);
    }
    if (node instanceof HTMLElement && node.shadowRoot !== null) {
      visit(node.shadowRoot);
      return;
    }
    for (const child of Array.from(node.children)) {
      visit(child);
    }
  };
  visit(root);
  return result;
}

export function focusFirst(root: ParentNode): HTMLElement | undefined {
  const target = focusableElements(root)[0];
  target?.focus();
  return target ?? undefined;
}

export function focusLast(root: ParentNode): HTMLElement | undefined {
  const targets = focusableElements(root);
  const target = targets.at(-1);
  target?.focus();
  return target ?? undefined;
}

export function activeElement(owner?: HTMLElement): HTMLElement | undefined {
  const shadowElement = owner?.shadowRoot?.activeElement;
  if (shadowElement instanceof HTMLElement && shadowElement !== owner) return shadowElement;
  const documentElement = globalThis.document?.activeElement;
  if (owner !== undefined && documentElement === owner) {
    const focused = focusableElements(owner).find((candidate) => candidate.matches(":focus"));
    if (focused !== undefined) return focused;
  }
  const element = documentElement;
  return element instanceof HTMLElement ? element : undefined;
}

export function restoreFocus(element: HTMLElement | undefined): void {
  if (element?.isConnected) element.focus();
}

export function listenOutside(owner: HTMLElement, dismiss: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const listener = (event: PointerEvent): void => {
    if (!event.composedPath().includes(owner)) dismiss();
  };
  document.addEventListener("pointerdown", listener, true);
  return () => document.removeEventListener("pointerdown", listener, true);
}

export function nextFrame(callback: () => void): void {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
  else queueMicrotask(callback);
}

export function emitAction(
  target: EventTarget,
  type: string,
  detail: Record<string, unknown>,
): boolean {
  return target.dispatchEvent(new CustomEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: true,
    detail: Object.freeze({...detail, source: "user"}),
  }));
}

export function safeElementId(value: string, fallback: string): string {
  const normalized = [...value].map((character) => {
    if (/^[a-zA-Z0-9]$/u.test(character)) return character;
    const codePoint = character.codePointAt(0);
    return `_x${codePoint === undefined ? "0" : codePoint.toString(16)}_`;
  }).join("");
  return normalized.length > 0 ? normalized : fallback;
}
