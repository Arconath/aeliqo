import {css} from "lit";

export const aeliqoNavigationStyles = css`
  :host {
    color: var(--aeliqo-color-text, #111827);
    display: block;
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

type FocusTraversalState = {
  readonly hidden: boolean;
  readonly disabled: boolean;
  readonly inert: boolean;
};

function elementState(element: HTMLElement, inherited: FocusTraversalState): FocusTraversalState {
  const style = typeof globalThis.getComputedStyle === "function" ? globalThis.getComputedStyle(element) : undefined;
  const hidden = Boolean(inherited.hidden || element.hidden || element.getAttribute("aria-hidden") === "true" || style?.display === "none" || style?.visibility === "hidden" || style?.visibility === "collapse");
  const disabled = Boolean(inherited.disabled || element.matches(":disabled") || element.getAttribute("aria-disabled") === "true");
  const inert = Boolean(inherited.inert || element.hasAttribute("inert") || ("inert" in element && Boolean((element as HTMLElement & {inert?: boolean}).inert)));
  return {hidden, disabled, inert};
}

function hasNegativeTabIndex(element: HTMLElement): boolean {
  const tabindex = element.getAttribute("tabindex");
  return tabindex !== null && Number.parseInt(tabindex, 10) < 0;
}

function focusableCandidate(element: HTMLElement, state: FocusTraversalState): boolean {
  return element.matches(interactiveSelector) && !state.hidden && !state.disabled && !state.inert && !hasNegativeTabIndex(element);
}

function ancestorState(element: HTMLElement): FocusTraversalState {
  const Element = globalThis.HTMLElement;
  if (Element === undefined) return {hidden: false, disabled: false, inert: false};
  let current: HTMLElement | null = element;
  let state: FocusTraversalState = {hidden: false, disabled: false, inert: false};
  while (current !== null) {
    state = elementState(current, state);
    const root = current.getRootNode();
    if (typeof globalThis.ShadowRoot !== "undefined" && root instanceof globalThis.ShadowRoot) {
      current = root.host instanceof Element ? root.host : null;
    } else current = current.parentElement;
  }
  return state;
}

/** Collect focusable controls through slots and nested open shadow roots. */
export function focusableElements(root: ParentNode): HTMLElement[] {
  const Element = globalThis.HTMLElement;
  if (Element === undefined) return [];
  const Slot = globalThis.HTMLSlotElement;
  const result: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  const initial = root instanceof Element ? ancestorState(root) : {hidden: false, disabled: false, inert: false};
  const visit = (node: ParentNode, inherited: FocusTraversalState): void => {
    if (node instanceof Element) {
      const state = elementState(node, inherited);
      if (focusableCandidate(node, state) && !seen.has(node)) {
        seen.add(node);
        result.push(node);
      }
      if (node.shadowRoot !== null) {
        visit(node.shadowRoot, state);
        return;
      }
      inherited = state;
    }
    if (Slot !== undefined && node instanceof Slot) {
      const assigned = node.assignedElements({flatten: true});
      if (assigned.length > 0) {
        for (const element of assigned) visit(element, inherited);
        return;
      }
    }
    for (const child of Array.from(node.children)) visit(child, inherited);
  };
  visit(root, initial);
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

function descendActive(element: HTMLElement): HTMLElement {
  const Element = globalThis.HTMLElement;
  const Slot = globalThis.HTMLSlotElement;
  if (Element === undefined) return element;
  if (Slot !== undefined && element instanceof Slot) {
    for (const assigned of element.assignedElements({flatten: true})) {
      if (!(assigned instanceof Element)) continue;
      if (assigned.matches(":focus")) return descendActive(assigned);
      if (assigned.shadowRoot !== null) {
        const nested = activeWithin(assigned.shadowRoot);
        if (nested !== undefined) return nested;
      }
    }
  }
  if (element.shadowRoot !== null) {
    const nested = activeWithin(element.shadowRoot);
    if (nested !== undefined) return nested;
  }
  return element;
}

function activeWithin(root: Document | ShadowRoot): HTMLElement | undefined {
  const Element = globalThis.HTMLElement;
  if (Element === undefined) return undefined;
  const active = root.activeElement;
  return active instanceof Element ? descendActive(active) : undefined;
}

export function activeElement(owner?: HTMLElement): HTMLElement | undefined {
  const Element = globalThis.HTMLElement;
  if (Element === undefined) return undefined;
  const nested = owner?.shadowRoot === null || owner?.shadowRoot === undefined ? undefined : activeWithin(owner.shadowRoot);
  if (nested !== undefined && nested !== owner) return nested;
  const documentElement = globalThis.document?.activeElement;
  if (owner !== undefined) {
    const focused = focusableElements(owner).find((candidate) => candidate.matches(":focus"));
    if (focused !== undefined) return focused;
    if (documentElement === owner) return owner;
  }
  return documentElement instanceof Element ? documentElement : undefined;
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
