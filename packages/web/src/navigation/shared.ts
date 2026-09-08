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

export function focusFirst(root: ParentNode): HTMLElement | undefined {
  const target = root.querySelector<HTMLElement>(interactiveSelector);
  target?.focus();
  return target ?? undefined;
}

export function focusLast(root: ParentNode): HTMLElement | undefined {
  const targets = [...root.querySelectorAll<HTMLElement>(interactiveSelector)];
  const target = targets.at(-1);
  target?.focus();
  return target ?? undefined;
}

export function activeElement(owner?: HTMLElement): HTMLElement | undefined {
  const element = owner?.shadowRoot?.activeElement ?? globalThis.document?.activeElement;
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
  const normalized = value.replace(/[^a-zA-Z0-9_-]/gu, "-");
  return normalized.length > 0 ? normalized : fallback;
}
