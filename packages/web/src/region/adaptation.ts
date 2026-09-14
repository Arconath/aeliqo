import type {PresentationEnvironment} from '@aeliqo/core';
import {
  createCallbackPresentationRenderer,
  createPresentationAdaptationController,
  type PresentationAdaptationContextSource,
  type PresentationAdaptationController,
  type PresentationAdaptationReadInput,
  type PresentationAdaptationRequestOptions,
  type PresentationAdaptationResult,
  type PresentationAdaptationStatus,
  type PresentationNavigationState,
  type PresentationRenderer as RuntimePresentationRenderer,
} from '@aeliqo/runtime/presentation';
import type {AeliqoRegionElement} from './aeliqo-region.js';
import type {RegionHandle, RegionOutcome} from '@aeliqo/runtime/regions';

const KNOWN = (value: number): {readonly state: 'known'; readonly value: number} => ({state: 'known', value});
const UNKNOWN = {state: 'unknown'} as const;

export interface AeliqoEnvironmentMeasurementOptions {
  readonly locale?: string;
  readonly direction?: 'ltr' | 'rtl';
  readonly textScale?: number;
  readonly pointer?: PresentationEnvironment['pointer'];
  readonly hover?: PresentationEnvironment['hover'];
  readonly keyboard?: PresentationEnvironment['keyboard'];
}

function boundedLocale(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64 || /[\u0000-\u001f\u007f]/u.test(value)) return 'en-US';
  try { return new Intl.Locale(value).toString(); } catch { return 'en-US'; }
}

function media(target: Window | undefined, query: string): boolean | undefined {
  try { return target?.matchMedia(query).matches; } catch { return undefined; }
}

/**
 * Read only platform facts. The helper never infers that a coarse pointer has
 * no keyboard, and returns unknown sizes when no browser measurement exists.
 */
export function measureAeliqoRegionEnvironment(
  element: Element | undefined,
  options: AeliqoEnvironmentMeasurementOptions = {},
): PresentationEnvironment {
  const ownerDocument = element?.ownerDocument;
  const windowObject = ownerDocument?.defaultView ?? (typeof window === 'undefined' ? undefined : window);
  let inlineSize: PresentationEnvironment['inlineSize'] = UNKNOWN;
  let blockSize: PresentationEnvironment['blockSize'] = UNKNOWN;
  let textScale: PresentationEnvironment['textScale'] = UNKNOWN;
  let direction: PresentationEnvironment['direction'] = options.direction ?? 'ltr';
  let locale = boundedLocale(options.locale ?? ownerDocument?.documentElement.lang ?? windowObject?.navigator.language);
  try {
    const rect = element?.getBoundingClientRect();
    const style = element === undefined || windowObject === undefined ? undefined : windowObject.getComputedStyle(element);
    const verticalWriting = style?.writingMode !== undefined && /^(vertical|sideways)/u.test(style.writingMode);
    if (rect !== undefined && Number.isFinite(verticalWriting ? rect.height : rect.width) && (verticalWriting ? rect.height : rect.width) >= 0)
      inlineSize = KNOWN(verticalWriting ? rect.height : rect.width);
    if (rect !== undefined && Number.isFinite(verticalWriting ? rect.width : rect.height) && (verticalWriting ? rect.width : rect.height) >= 0)
      blockSize = KNOWN(verticalWriting ? rect.width : rect.height);
    if (style !== undefined) {
      if (options.direction === undefined && (style.direction === 'ltr' || style.direction === 'rtl')) direction = style.direction;
      const fontSize = Number.parseFloat(style.fontSize);
      if (options.textScale === undefined && Number.isFinite(fontSize) && fontSize > 0) textScale = KNOWN(fontSize / 16);
    }
    if (options.textScale !== undefined && Number.isFinite(options.textScale) && options.textScale > 0) textScale = KNOWN(options.textScale);
    if (ownerDocument?.documentElement.lang !== undefined && options.locale === undefined) locale = boundedLocale(ownerDocument.documentElement.lang || locale);
  } catch { /* unknown measurement is safe and explicit */ }
  const primaryFine = media(windowObject, '(pointer: fine)');
  const primaryCoarse = media(windowObject, '(pointer: coarse)');
  const anyFine = media(windowObject, '(any-pointer: fine)');
  const anyCoarse = media(windowObject, '(any-pointer: coarse)');
  const pointer: PresentationEnvironment['pointer'] = options.pointer ??
    (anyFine === true && anyCoarse === true ? 'mixed' : primaryFine === true ? 'fine' : primaryCoarse === true ? 'coarse' : 'unknown');
  const hover: PresentationEnvironment['hover'] = options.hover ??
    (media(windowObject, '(hover: hover)') === true ? 'available' : media(windowObject, '(hover: none)') === true ? 'unavailable' : 'unknown');
  const reducedMotion = media(windowObject, '(prefers-reduced-motion: reduce)') === true;
  const forcedColors = media(windowObject, '(forced-colors: active)') === true;
  return {
    inlineSize,
    blockSize,
    textScale,
    pointer,
    hover,
    keyboard: options.keyboard ?? 'unknown',
    locale,
    direction,
    reducedMotion,
    forcedColors,
  };
}

export interface AeliqoRegionAdaptationOptions {
  readonly element: AeliqoRegionElement;
  readonly region: RegionHandle;
  readonly registry: Parameters<typeof createPresentationAdaptationController>[0]['registry'];
  readonly baseContext: PresentationAdaptationContextSource;
  readonly readContext?: PresentationAdaptationContextSource;
  readonly renderer?: RuntimePresentationRenderer;
  readonly readNavigation?: () => PresentationNavigationState | undefined;
  readonly autoObserve?: boolean;
  readonly measure?: () => PresentationEnvironment;
  readonly requestOptions?: PresentationAdaptationRequestOptions;
  readonly now?: () => number;
  readonly schedule?: (callback: () => void, delayMilliseconds: number) => unknown;
  readonly cancelSchedule?: (handle: unknown) => void;
  readonly dwellMs?: number;
  readonly hysteresisPx?: number;
  readonly maxPendingRequests?: number;
  /** Host sets this while a focused editor, drag or IME composition owns the view. */
  readonly transitionBlocked?: () => boolean;
}

export interface AeliqoRegionAdaptation {
  readonly controller: PresentationAdaptationController;
  readonly request: (
    environment?: PresentationEnvironment,
    options?: PresentationAdaptationRequestOptions,
  ) => Promise<RegionOutcome<PresentationAdaptationResult>>;
  measure(): PresentationEnvironment;
  disconnect(): void;
}

function editableTarget(value: Element | undefined): boolean {
  if (value === undefined) return false;
  const tag = value.localName;
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return !value.hasAttribute('disabled') && !value.hasAttribute('readonly') && value.getAttribute('aria-readonly') !== 'true';
  }
  const contentEditable = value.getAttribute('contenteditable');
  if (contentEditable !== null && contentEditable !== 'false') return true;
  return value.getAttribute('role') === 'textbox' || value.getAttribute('role') === 'combobox' || value.getAttribute('role') === 'spinbutton';
}

function deepestActive(root: Document | Element): Element | undefined {
  const isDocument = typeof Document !== 'undefined' && root instanceof Document;
  let active: Element | undefined;
  if (isDocument) active = root.activeElement ?? undefined;
  else active = (root as Element).shadowRoot?.activeElement ?? undefined;
  while (active?.shadowRoot?.activeElement !== null && active?.shadowRoot?.activeElement !== undefined)
    active = active.shadowRoot.activeElement;
  return active;
}

function composedContains(container: Element, value: Element): boolean {
  let current: Node | null = value;
  while (current !== null) {
    if (current === container) return true;
    const root: Node = current.getRootNode();
    const host: unknown = (root as {readonly host?: unknown}).host;
    current = host !== undefined && host !== null ? host as Node : current.parentNode;
  }
  return false;
}

function hasFocusedEditable(element: AeliqoRegionElement): boolean {
  const active = element.ownerDocument === undefined ? undefined : deepestActive(element.ownerDocument);
  // Focus inside nested shadow trees is reported by document.activeElement as
  // the outermost host. Walk the composed tree from the deepest active node so
  // the guard also covers regions mounted inside a consumer shadow root.
  return active !== undefined && composedContains(element, active) && editableTarget(active);
}

function elementRenderer(element: AeliqoRegionElement): RuntimePresentationRenderer {
  let previous: {readonly presentation: AeliqoRegionElement['presentation']; readonly interaction: AeliqoRegionElement['interaction']} | undefined;
  return createCallbackPresentationRenderer({
    apply: (next) => {
      previous = {presentation: element.presentation, interaction: element.interaction};
      element.presentation = next.presentation;
      element.interaction = next.interaction;
      element.requestUpdate?.();
    },
    rollback: () => {
      if (previous === undefined) return;
      element.presentation = previous.presentation;
      element.interaction = previous.interaction;
      element.requestUpdate?.();
      previous = undefined;
    },
    clear: () => {
      previous = undefined;
      element.clear();
    },
  });
}

/** Bind a measured region element to the runtime adaptation transaction. */
export function createAeliqoRegionAdaptation(options: AeliqoRegionAdaptationOptions): AeliqoRegionAdaptation {
  const measure = options.measure ?? (() => measureAeliqoRegionEnvironment(options.element));
  const renderer = options.renderer ?? elementRenderer(options.element);
  const transitionBlocked = options.transitionBlocked;
  let compositionActive = false;
  let focusedEditable = false;
  const activePointers = new Set<number>();
  let latestEnvironment: PresentationEnvironment | undefined;
  let latestRequestOptions: PresentationAdaptationRequestOptions | undefined;
  let needsRetry = false;
  let disposed = false;
  let wasBlocked = false;
  const hostTransitionBlocked = (): boolean => {
    try { return transitionBlocked?.() === true; } catch { return true; }
  };
  const isBlocked = (): boolean => focusedEditable || compositionActive || activePointers.size > 0 || hostTransitionBlocked();
  const syncBlocked = (): void => {
    focusedEditable = hasFocusedEditable(options.element);
    const blocked = isBlocked();
    if (wasBlocked && !blocked && needsRetry) retryAfterInteraction();
    wasBlocked = blocked;
  };
  let retryAfterInteraction: () => void = () => {};
  const pointerEnd = (event: Event): void => {
    const pointerId = (event as PointerEvent).pointerId;
    if (Number.isSafeInteger(pointerId)) activePointers.delete(pointerId);
    else activePointers.clear();
    if (activePointers.size === 0) {
      const documentObject = options.element.ownerDocument;
      documentObject?.removeEventListener('pointerup', pointerEnd, true);
      documentObject?.removeEventListener('pointercancel', pointerEnd, true);
    }
    syncBlocked();
  };
  const pointerStart = (event: Event): void => {
    const pointerId = (event as PointerEvent).pointerId;
    if (activePointers.size < 16) activePointers.add(Number.isSafeInteger(pointerId) ? pointerId : -1);
    const documentObject = options.element.ownerDocument;
    documentObject?.addEventListener('pointerup', pointerEnd, true);
    documentObject?.addEventListener('pointercancel', pointerEnd, true);
    syncBlocked();
  };
  const onFocus = (): void => { queueMicrotask(syncBlocked); };
  const onCompositionStart = (): void => { compositionActive = true; syncBlocked(); };
  const onCompositionEnd = (): void => { compositionActive = false; syncBlocked(); };
  const onWindowBlur = (): void => {
    activePointers.clear();
    const documentObject = options.element.ownerDocument;
    documentObject?.removeEventListener('pointerup', pointerEnd, true);
    documentObject?.removeEventListener('pointercancel', pointerEnd, true);
    syncBlocked();
  };
  const onVisibilityChange = (): void => {
    if (documentObject?.visibilityState !== 'hidden') return;
    onWindowBlur();
  };
  const windowObject = options.element.ownerDocument?.defaultView;
  const documentObject = options.element.ownerDocument;
  options.element.addEventListener('focusin', onFocus, true);
  options.element.addEventListener('focusout', onFocus, true);
  options.element.addEventListener('compositionstart', onCompositionStart, true);
  options.element.addEventListener('compositionend', onCompositionEnd, true);
  options.element.addEventListener('pointerdown', pointerStart, true);
  windowObject?.addEventListener('blur', onWindowBlur, true);
  documentObject?.addEventListener('visibilitychange', onVisibilityChange, true);
  syncBlocked();
  const readContext = options.readContext === undefined && transitionBlocked === undefined
    ? undefined
    : ((input: PresentationAdaptationReadInput) => {
      const source = options.readContext ?? options.baseContext;
      const addGuard = (value: unknown): unknown => {
        if (value !== null && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value as object, 'ok')) {
          const outcome = value as {readonly ok?: unknown; readonly value?: unknown};
          if (outcome.ok === true) return {ok: true, value: addGuard(outcome.value)};
          return value;
        }
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
        return {...value as Record<string, unknown>, ...(hostTransitionBlocked() ? {transitionBlocked: true} : {})};
      };
      if (typeof source !== 'function') return addGuard(source) as PresentationAdaptationContextSource;
      const raw = source(input);
      return raw !== null && typeof raw === 'object' && typeof (raw as PromiseLike<unknown>).then === 'function'
        ? Promise.resolve(raw).then(addGuard)
        : addGuard(raw);
    }) as PresentationAdaptationContextSource;
  const controller = createPresentationAdaptationController({
    region: options.region,
    registry: options.registry,
    baseContext: options.baseContext,
    ...(readContext === undefined ? {} : {readContext}),
    renderer,
    transitionBlocked: isBlocked,
    ...(options.readNavigation === undefined ? {} : {readNavigation: options.readNavigation}),
    ...(options.now === undefined ? {} : {now: options.now}),
    ...(options.schedule === undefined ? {} : {schedule: options.schedule}),
    ...(options.cancelSchedule === undefined ? {} : {cancelSchedule: options.cancelSchedule}),
    ...(options.dwellMs === undefined ? {} : {dwellMs: options.dwellMs}),
    ...(options.hysteresisPx === undefined ? {} : {hysteresisPx: options.hysteresisPx}),
    ...(options.maxPendingRequests === undefined ? {} : {maxPendingRequests: options.maxPendingRequests}),
  });
  const request = (environment = measure(), requestOptions = options.requestOptions): Promise<RegionOutcome<PresentationAdaptationResult>> => {
    // A programmatic focus can occur without a bubbling focus event reaching
    // this host. Refresh the conservative default guard at request time.
    focusedEditable = hasFocusedEditable(options.element);
    const currentlyBlocked = isBlocked();
    wasBlocked = currentlyBlocked;
    latestEnvironment = environment;
    latestRequestOptions = requestOptions;
    if (currentlyBlocked) needsRetry = true;
    else needsRetry = false;
    const result = controller.request(environment, requestOptions);
    void result.then(outcome => {
      if (!outcome.ok && isBlocked()) needsRetry = true;
    });
    return result;
  };
  retryAfterInteraction = (): void => {
    if (disposed || !needsRetry || latestEnvironment === undefined || isBlocked()) return;
    needsRetry = false;
    const requestOptions = {...latestRequestOptions, force: true};
    const retry = request(latestEnvironment, requestOptions);
    void controller.flush();
    void retry;
  };
  let observer: ResizeObserver | undefined;
  if (options.autoObserve !== false && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => { void request(); });
    observer.observe(options.element);
  }
  return {
    controller,
    request,
    measure,
    disconnect: () => {
      disposed = true;
      observer?.disconnect();
      options.element.removeEventListener('focusin', onFocus, true);
      options.element.removeEventListener('focusout', onFocus, true);
      options.element.removeEventListener('compositionstart', onCompositionStart, true);
      options.element.removeEventListener('compositionend', onCompositionEnd, true);
      options.element.removeEventListener('pointerdown', pointerStart, true);
      windowObject?.removeEventListener('blur', onWindowBlur, true);
      documentObject?.removeEventListener('pointerup', pointerEnd, true);
      documentObject?.removeEventListener('pointercancel', pointerEnd, true);
      activePointers.clear();
      documentObject?.removeEventListener('visibilitychange', onVisibilityChange, true);
      controller.dispose();
    },
  };
}

export type {PresentationAdaptationResult, PresentationAdaptationStatus};
