import type { AeliqoApp } from './types.js';
import type { AeliqoSemanticInteractionRequest } from '../region/types.js';
import { registerAeliqoElements } from '../register.js';
import { AeliqoRegionElement } from '../region/aeliqo-region.js';
import { bridgeRuntimeState } from './lifecycle.js';
import { category, diagnostic, interactionLocked, type WebAppContext, type WebRegion } from './context.js';
import type { WebMountInput } from './types.js';

type MountResult = ReturnType<AeliqoApp['mount']>;
type InteractionHandler = (region: WebRegion, request: AeliqoSemanticInteractionRequest) => Promise<void>;
type AdaptRegion = (region: WebRegion) => Promise<unknown>;
type ResizeObserverConstructor = new (callback: ResizeObserverCallback) => ResizeObserver;
type WindowWithResizeObserver = Window & { readonly ResizeObserver?: ResizeObserverConstructor };

function mountFailure(code: string, message: string): MountResult {
  return { ok: false, diagnostics: [diagnostic(code, message)] };
}

function targetWindow(input: WebMountInput): Window | undefined {
  const view = input.target?.ownerDocument?.defaultView;
  if (view === null || view === undefined || !(input.target instanceof view.HTMLElement)) return undefined;
  return view;
}

function registerElements(view: Window): boolean {
  try {
    registerAeliqoElements(view.customElements);
    return true;
  } catch {
    return false;
  }
}

function attachRegion(input: WebMountInput): AeliqoRegionElement | undefined {
  try {
    const element = input.target.ownerDocument.createElement('aeliqo-region') as AeliqoRegionElement;
    element.setAttribute('data-aeliqo-app-region', input.regionId);
    input.target.append(element);
    return element;
  } catch {
    return undefined;
  }
}

function createRegion(input: WebMountInput, element: AeliqoRegionElement): WebRegion {
  return {
    id: input.regionId,
    resourceId: input.resourceId,
    target: input.target,
    element,
    sequence: 0,
    category: category(input.target.getBoundingClientRect().width, 'unknown'),
    composing: false,
    pendingAdapt: false,
    actionPending: false,
    actionSequence: 0,
    values: new Map(),
    drafts: new Map(),
  };
}

function observeSize(region: WebRegion, view: Window, adapt: AdaptRegion): void {
  const Observer = (view as WindowWithResizeObserver).ResizeObserver;
  if (Observer === undefined) return;
  const resize = new Observer((entries) => {
    const width = entries[0]?.contentRect.width ?? region.target.getBoundingClientRect().width;
    const next = category(width, region.category);
    if (next === region.category) return;
    region.category = next;
    if (region.resizeFrame !== undefined) return;
    region.resizeFrame = view.requestAnimationFrame(() => {
      delete region.resizeFrame;
      if (region.resize === undefined) return;
      void adapt(region);
    });
  });
  region.resize = resize;
  resize.observe(region.target);
}

function releasePendingAdapt(region: WebRegion, adapt: AdaptRegion): void {
  if (!region.pendingAdapt) return;
  void adapt(region);
}

function installCompositionListeners(region: WebRegion, adapt: AdaptRegion): void {
  region.element.addEventListener('compositionstart', () => {
    region.composing = true;
  });
  region.element.addEventListener('compositionend', () => {
    region.composing = false;
    releasePendingAdapt(region, adapt);
  });
}

function installFocusListener(region: WebRegion, adapt: AdaptRegion): void {
  region.element.addEventListener('focusout', () => {
    if (!region.pendingAdapt) return;
    queueMicrotask(() => {
      if (!interactionLocked(region)) void adapt(region);
    });
  });
}

function installRegionListeners(
  region: WebRegion,
  view: Window,
  interaction: InteractionHandler,
  adapt: AdaptRegion,
): void {
  region.element.onSemanticInteraction = (request) => {
    void interaction(region, request);
  };
  observeSize(region, view, adapt);
  installCompositionListeners(region, adapt);
  installFocusListener(region, adapt);
}

function mountRegion(
  context: WebAppContext,
  input: WebMountInput,
  view: Window,
  interaction: InteractionHandler,
  adapt: AdaptRegion,
): MountResult {
  const mounted = context.runtime.mount({ regionId: input.regionId, resourceId: input.resourceId });
  if (!mounted.ok) return mounted;
  const element = attachRegion(input);
  if (element === undefined) {
    context.runtime.unmount(input.regionId);
    return mountFailure('web.app.mount', 'The Aeliqo Region could not be attached to the target.');
  }
  const region = createRegion(input, element);
  installRegionListeners(region, view, interaction, adapt);
  context.regions.set(input.regionId, region);
  bridgeRuntimeState(context, region);
  return { ok: true, value: element };
}

export function createMountHandler(
  context: WebAppContext,
  interaction: InteractionHandler,
  adapt: AdaptRegion,
): AeliqoApp['mount'] {
  return (input) => {
    if (context.disposed) return mountFailure('web.app.disposed', 'The Aeliqo app is disposed.');
    const view = targetWindow(input);
    if (view === undefined) return mountFailure('web.app.target', 'Mount target must be an HTMLElement.');
    if (context.regions.has(input.regionId))
      return mountFailure('web.app.duplicate', 'Region ' + input.regionId + ' is already mounted.');
    if (!registerElements(view))
      return mountFailure('web.app.registration', 'Aeliqo elements could not be registered in this document.');
    return mountRegion(context, input, view, interaction, adapt);
  };
}
