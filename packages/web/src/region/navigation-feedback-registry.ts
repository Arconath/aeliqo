import {
  parseWireValue,
  type InteractionPort,
  type Outcome,
  type PresentationManifest,
  type PresentationNode,
  type PresentationValues,
  type Scalar,
  type VersionRef,
} from "@aeliqo/core";
import type {AeliqoEmptyStateKind} from "../feedback/empty-state.js";

/**
 * Host-owned references used by the navigation and feedback region adapters.
 *
 * A presentation proposal contains only `bindingRevision` and `bindingRef`.
 * Labels, messages, routes, actions and tree/tab/menu item definitions are
 * resolved from this immutable host table. This keeps model-authored wire data
 * from becoming a destination, business action or trusted copy source.
 */
export interface AeliqoNavigationFeedbackBindings {
  readonly revision: string;
  readonly contents?: readonly AeliqoNavigationFeedbackContent[];
  readonly routes?: readonly AeliqoNavigationFeedbackRoute[];
  readonly actions?: readonly AeliqoNavigationFeedbackAction[];
  readonly breadcrumbs?: readonly AeliqoBreadcrumbBinding[];
  readonly menus?: readonly AeliqoMenuBinding[];
  readonly pagination?: readonly AeliqoPaginationBinding[];
  readonly tabs?: readonly AeliqoTabsBinding[];
  readonly trees?: readonly AeliqoTreeBinding[];
  readonly feedback?: readonly AeliqoFeedbackBinding[];
}

export interface AeliqoNavigationFeedbackContent {
  readonly id: string;
  readonly text: string;
}

export interface AeliqoNavigationFeedbackRoute {
  readonly id: string;
  readonly route: VersionRef;
  readonly params: Readonly<Record<string, Scalar>>;
  /** A browser destination resolved by the application, never by a proposal. */
  readonly href: string;
}

export interface AeliqoNavigationFeedbackAction {
  readonly id: string;
  readonly action: VersionRef;
  readonly input: Readonly<Record<string, Scalar>>;
}

export interface AeliqoBreadcrumbBinding {
  readonly id: string;
  readonly labelRef: string;
  readonly items: readonly AeliqoBreadcrumbBindingItem[];
}

export interface AeliqoBreadcrumbBindingItem {
  readonly id: string;
  readonly labelRef: string;
  readonly routeRef?: string;
  readonly current?: boolean;
}

export interface AeliqoMenuBinding {
  readonly id: string;
  readonly labelRef: string;
  readonly items: readonly AeliqoMenuBindingItem[];
}

export interface AeliqoMenuBindingItem {
  readonly id: string;
  readonly labelRef: string;
  readonly actionRef?: string;
  readonly routeRef?: string;
  readonly disabled?: boolean;
}

export interface AeliqoPaginationBinding {
  readonly id: string;
  readonly labelRef: string;
  readonly outputId: string;
  readonly queryDigest: string;
  readonly page: number;
  readonly pageCount?: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly pending?: boolean;
  readonly cursors: readonly AeliqoPaginationCursor[];
}

export interface AeliqoPaginationCursor {
  readonly page: number;
  readonly cursor: string;
}

export interface AeliqoTabsBinding {
  readonly id: string;
  readonly items: readonly AeliqoTabsBindingItem[];
}

export interface AeliqoTabsBindingItem {
  readonly id: string;
  readonly labelRef: string;
  readonly contentRef?: string;
  readonly disabled?: boolean;
}

export interface AeliqoTreeBinding {
  readonly id: string;
  readonly labelRef: string;
  readonly nodes: readonly AeliqoTreeBindingNode[];
}

export interface AeliqoTreeBindingNode {
  readonly id: string;
  readonly labelRef: string;
  readonly children?: readonly AeliqoTreeBindingNode[];
  readonly disabled?: boolean;
  readonly actionRef?: string;
  readonly routeRef?: string;
}

/** Shared host text and action references for feedback primitives. */
export interface AeliqoFeedbackBinding {
  readonly id: string;
  readonly labelRef?: string;
  readonly contentRef?: string;
  readonly headingRef?: string;
  readonly messageRef?: string;
  readonly actionLabelRef?: string;
  readonly actionRef?: string;
  readonly kind?: AeliqoEmptyStateKind;
  readonly progressValue?: number;
  readonly progressMax?: number;
}

export const AELIQO_NAVIGATION_FEEDBACK_REFS = Object.freeze({
  tabs: {id: "navigation.tabs", revision: "1"},
  breadcrumb: {id: "navigation.breadcrumb", revision: "1"},
  pagination: {id: "navigation.pagination", revision: "1"},
  menu: {id: "navigation.menu", revision: "1"},
  treeNav: {id: "navigation.tree-nav", revision: "1"},
  tooltip: {id: "feedback.tooltip", revision: "1"},
  popover: {id: "feedback.popover", revision: "1"},
  dialog: {id: "feedback.dialog", revision: "1"},
  drawer: {id: "feedback.drawer", revision: "1"},
  toast: {id: "feedback.toast", revision: "1"},
  alert: {id: "feedback.alert", revision: "1"},
  progress: {id: "feedback.progress", revision: "1"},
  skeleton: {id: "feedback.skeleton", revision: "1"},
  emptyState: {id: "feedback.empty-state", revision: "1"},
} satisfies Record<string, VersionRef>);

export const AELIQO_NAVIGATION_FEEDBACK_CONFIG_SCHEMAS = Object.freeze(
  Object.fromEntries(Object.entries(AELIQO_NAVIGATION_FEEDBACK_REFS).map(([key, ref]) => [
    key,
    {id: `${ref.id}.config`, revision: "1"},
  ])) as Record<keyof typeof AELIQO_NAVIGATION_FEEDBACK_REFS, VersionRef>,
);

export const AELIQO_NAVIGATION_FEEDBACK_OPERATION_REFS = Object.freeze({
  page: {id: "navigation.page", revision: "1"},
} satisfies Record<string, VersionRef>);

const MAX_ITEMS = 128;
const MAX_TREE_NODES = 512;
const MAX_TEXT = 4_096;
const MAX_PAGE = 1_000_000;
const EMPTY_STATE_KINDS: readonly AeliqoEmptyStateKind[] = ["no-records", "no-matches", "forbidden", "loading", "failure"];
const FEEDBACK_TONES = ["neutral", "info", "success", "warning", "danger"] as const;

type RecordValue = Record<string, unknown>;

const fail = <T>(code: string, message: string): Outcome<T> => ({
  ok: false,
  diagnostics: [{code: `web.presentation.navigation-feedback.${code}`, message, retryable: false}],
});

function record(value: unknown): RecordValue | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : undefined;
}

function bounded(value: unknown, maximum = 160): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value);
}

function ref(value: unknown): value is VersionRef {
  const candidate = record(value);
  return candidate !== undefined && Object.keys(candidate).length === 2 && bounded(candidate.id) && bounded(candidate.revision);
}

function scalar(value: unknown): value is Scalar {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= MAX_TEXT;
  const candidate = record(value);
  return candidate !== undefined && Object.keys(candidate).length === 1 && typeof candidate.decimal === "string"
    && candidate.decimal.length <= 512 && /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(candidate.decimal);
}

function scalarRecord(value: unknown): value is Readonly<Record<string, Scalar>> {
  const candidate = record(value);
  return candidate !== undefined && Object.keys(candidate).length <= MAX_ITEMS
    && Object.entries(candidate).every(([key, item]) => bounded(key) && scalar(item));
}

function copyVersionRef(value: VersionRef): VersionRef {
  return {id: value.id, revision: value.revision};
}

function copyScalar(value: Scalar): Scalar {
  if (value === null || typeof value !== "object") return value;
  return {decimal: value.decimal};
}

function copyScalarRecord(value: Readonly<Record<string, Scalar>>): Readonly<Record<string, Scalar>> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyScalar(item)]));
}

function safeHref(value: unknown): value is string {
  if (!bounded(value, 4_096)) return false;
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(new URL(value, "https://aeliqo.invalid").protocol);
  } catch {
    return false;
  }
}

function exactKeys(value: RecordValue, allowed: readonly string[]): boolean {
  const permitted = new Set(allowed);
  return Object.keys(value).every((key) => permitted.has(key));
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function uniqueRefs(values: readonly VersionRef[]): readonly VersionRef[] {
  return [...new Map(values.map((value) => [JSON.stringify([value.id, value.revision]), value])).values()];
}

function contentMap(bindings: AeliqoNavigationFeedbackBindings): Map<string, AeliqoNavigationFeedbackContent> {
  return new Map((bindings.contents ?? []).map((entry) => [entry.id, entry]));
}

function routeMap(bindings: AeliqoNavigationFeedbackBindings): Map<string, AeliqoNavigationFeedbackRoute> {
  return new Map((bindings.routes ?? []).map((entry) => [entry.id, entry]));
}

function actionMap(bindings: AeliqoNavigationFeedbackBindings): Map<string, AeliqoNavigationFeedbackAction> {
  return new Map((bindings.actions ?? []).map((entry) => [entry.id, entry]));
}

function requireContent(contents: Map<string, AeliqoNavigationFeedbackContent>, value: unknown): boolean {
  return bounded(value) && contents.has(value);
}

function requireRoute(routes: Map<string, AeliqoNavigationFeedbackRoute>, value: unknown): boolean {
  return bounded(value) && routes.has(value);
}

function requireAction(actions: Map<string, AeliqoNavigationFeedbackAction>, value: unknown): boolean {
  return bounded(value) && actions.has(value);
}

function normalizeContents(value: unknown): Outcome<readonly AeliqoNavigationFeedbackContent[]> {
  if (value === undefined) return {ok: true, value: []};
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return fail("bindings", "contents must be a bounded array.");
  const seen = new Set<string>();
  const result: AeliqoNavigationFeedbackContent[] = [];
  for (const item of value) {
    const candidate = record(item);
    if (candidate === undefined || !exactKeys(candidate, ["id", "text"]) || !bounded(candidate.id) || !bounded(candidate.text, MAX_TEXT) || seen.has(candidate.id))
      return fail("bindings", "Content bindings must have unique bounded IDs and text.");
    seen.add(candidate.id);
    result.push({id: candidate.id, text: candidate.text});
  }
  return {ok: true, value: result};
}

function normalizeRoutes(value: unknown): Outcome<readonly AeliqoNavigationFeedbackRoute[]> {
  if (value === undefined) return {ok: true, value: []};
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return fail("bindings", "routes must be a bounded array.");
  const seen = new Set<string>();
  const result: AeliqoNavigationFeedbackRoute[] = [];
  for (const item of value) {
    const candidate = record(item);
    if (candidate === undefined || !exactKeys(candidate, ["id", "route", "params", "href"])
      || !bounded(candidate.id) || seen.has(candidate.id) || !ref(candidate.route) || !scalarRecord(candidate.params) || !safeHref(candidate.href))
      return fail("bindings", "Route bindings require unique IDs, versioned routes, scalar params and safe host destinations.");
    seen.add(candidate.id);
    result.push({id: candidate.id, route: copyVersionRef(candidate.route), params: copyScalarRecord(candidate.params), href: candidate.href});
  }
  return {ok: true, value: result};
}

function normalizeActions(value: unknown): Outcome<readonly AeliqoNavigationFeedbackAction[]> {
  if (value === undefined) return {ok: true, value: []};
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return fail("bindings", "actions must be a bounded array.");
  const seen = new Set<string>();
  const result: AeliqoNavigationFeedbackAction[] = [];
  for (const item of value) {
    const candidate = record(item);
    if (candidate === undefined || !exactKeys(candidate, ["id", "action", "input"])
      || !bounded(candidate.id) || seen.has(candidate.id) || !ref(candidate.action) || !scalarRecord(candidate.input))
      return fail("bindings", "Action bindings require unique IDs, versioned actions and scalar input.");
    seen.add(candidate.id);
    result.push({id: candidate.id, action: copyVersionRef(candidate.action), input: copyScalarRecord(candidate.input)});
  }
  return {ok: true, value: result};
}

function normalizeBreadcrumbs(value: unknown, contents: Map<string, AeliqoNavigationFeedbackContent>, routes: Map<string, AeliqoNavigationFeedbackRoute>): Outcome<readonly AeliqoBreadcrumbBinding[]> {
  if (value === undefined) return {ok: true, value: []};
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return fail("bindings", "breadcrumbs must be a bounded array.");
  const seen = new Set<string>();
  const result: AeliqoBreadcrumbBinding[] = [];
  for (const item of value) {
    const candidate = record(item);
    if (candidate === undefined || !exactKeys(candidate, ["id", "labelRef", "items"]) || !bounded(candidate.id)
      || seen.has(candidate.id) || !requireContent(contents, candidate.labelRef) || !Array.isArray(candidate.items) || candidate.items.length > MAX_ITEMS)
      return fail("bindings", "Breadcrumb bindings require unique IDs, host labels and bounded items.");
    const itemIds = new Set<string>();
    const items: AeliqoBreadcrumbBindingItem[] = [];
    for (const rawItem of candidate.items) {
      const itemValue = record(rawItem);
      if (itemValue === undefined || !exactKeys(itemValue, ["id", "labelRef", "routeRef", "current"])
        || !bounded(itemValue.id) || itemIds.has(itemValue.id) || !requireContent(contents, itemValue.labelRef)
        || (itemValue.routeRef !== undefined && !requireRoute(routes, itemValue.routeRef))
        || (itemValue.current !== undefined && typeof itemValue.current !== "boolean"))
        return fail("bindings", "Breadcrumb items must use unique host labels and registered routes.");
      itemIds.add(itemValue.id);
      const id = itemValue.id as string;
      const labelRef = itemValue.labelRef as string;
      const routeRef = itemValue.routeRef as string | undefined;
      items.push({id, labelRef, ...(routeRef === undefined ? {} : {routeRef}), ...(itemValue.current === undefined ? {} : {current: itemValue.current as boolean})});
    }
    seen.add(candidate.id);
    result.push({id: candidate.id as string, labelRef: candidate.labelRef as string, items});
  }
  return {ok: true, value: result};
}

function normalizeMenus(value: unknown, contents: Map<string, AeliqoNavigationFeedbackContent>, routes: Map<string, AeliqoNavigationFeedbackRoute>, actions: Map<string, AeliqoNavigationFeedbackAction>): Outcome<readonly AeliqoMenuBinding[]> {
  if (value === undefined) return {ok: true, value: []};
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return fail("bindings", "menus must be a bounded array.");
  const seen = new Set<string>();
  const result: AeliqoMenuBinding[] = [];
  for (const item of value) {
    const candidate = record(item);
    if (candidate === undefined || !exactKeys(candidate, ["id", "labelRef", "items"]) || !bounded(candidate.id)
      || seen.has(candidate.id) || !requireContent(contents, candidate.labelRef) || !Array.isArray(candidate.items) || candidate.items.length > MAX_ITEMS)
      return fail("bindings", "Menu bindings require unique IDs, host labels and bounded items.");
    const itemIds = new Set<string>();
    const items: AeliqoMenuBindingItem[] = [];
    for (const rawItem of candidate.items) {
      const itemValue = record(rawItem);
      const hasAction = itemValue !== undefined && itemValue.actionRef !== undefined;
      const hasRoute = itemValue !== undefined && itemValue.routeRef !== undefined;
      if (itemValue === undefined || !exactKeys(itemValue, ["id", "labelRef", "actionRef", "routeRef", "disabled"])
        || !bounded(itemValue.id) || itemIds.has(itemValue.id) || !requireContent(contents, itemValue.labelRef)
        || (hasAction === hasRoute) || (hasAction && !requireAction(actions, itemValue.actionRef))
        || (hasRoute && !requireRoute(routes, itemValue.routeRef))
        || (itemValue.disabled !== undefined && typeof itemValue.disabled !== "boolean"))
        return fail("bindings", "Menu items require exactly one registered action or route.");
      itemIds.add(itemValue.id);
      const id = itemValue.id as string;
      const labelRef = itemValue.labelRef as string;
      const actionRef = itemValue.actionRef as string | undefined;
      const routeRef = itemValue.routeRef as string | undefined;
      items.push({id, labelRef, ...(hasAction && actionRef !== undefined ? {actionRef} : {}), ...(hasRoute && routeRef !== undefined ? {routeRef} : {}), ...(itemValue.disabled === undefined ? {} : {disabled: itemValue.disabled as boolean})});
    }
    seen.add(candidate.id);
    result.push({id: candidate.id as string, labelRef: candidate.labelRef as string, items});
  }
  return {ok: true, value: result};
}

function normalizePagination(value: unknown, contents: Map<string, AeliqoNavigationFeedbackContent>): Outcome<readonly AeliqoPaginationBinding[]> {
  if (value === undefined) return {ok: true, value: []};
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return fail("bindings", "pagination must be a bounded array.");
  const seen = new Set<string>();
  const result: AeliqoPaginationBinding[] = [];
  for (const item of value) {
    const candidate = record(item);
    if (candidate === undefined || !exactKeys(candidate, ["id", "labelRef", "outputId", "queryDigest", "page", "pageCount", "hasPrevious", "hasNext", "pending", "cursors"])
      || !bounded(candidate.id) || seen.has(candidate.id) || !requireContent(contents, candidate.labelRef) || !bounded(candidate.outputId)
      || !bounded(candidate.queryDigest) || !Number.isSafeInteger(candidate.page) || (candidate.page as number) < 1 || (candidate.page as number) > MAX_PAGE
      || (candidate.pageCount !== undefined && (!Number.isSafeInteger(candidate.pageCount) || (candidate.pageCount as number) < (candidate.page as number) || (candidate.pageCount as number) > MAX_PAGE))
      || typeof candidate.hasPrevious !== "boolean" || typeof candidate.hasNext !== "boolean"
      || (candidate.pending !== undefined && typeof candidate.pending !== "boolean") || !Array.isArray(candidate.cursors) || candidate.cursors.length > MAX_ITEMS)
      return fail("bindings", "Pagination bindings require bounded page scope and cursor metadata.");
    const cursorPages = new Set<number>();
    const cursors: AeliqoPaginationCursor[] = [];
    for (const rawCursor of candidate.cursors) {
      const cursor = record(rawCursor);
      if (cursor === undefined || !exactKeys(cursor, ["page", "cursor"]) || !Number.isSafeInteger(cursor.page) || (cursor.page as number) < 1 || (cursor.page as number) > MAX_PAGE
        || cursorPages.has(cursor.page as number) || !bounded(cursor.cursor, MAX_TEXT)) return fail("bindings", "Pagination cursors must have unique bounded page numbers.");
      cursorPages.add(cursor.page as number);
      cursors.push({page: cursor.page as number, cursor: cursor.cursor as string});
    }
    const page = candidate.page as number;
    const pageCount = candidate.pageCount as number | undefined;
    const nextPage = page + 1;
    const previousPage = page - 1;
    if ((candidate.hasNext && !cursorPages.has(nextPage)) || (candidate.hasPrevious && previousPage > 0 && !cursorPages.has(previousPage)))
      return fail("bindings", "Pagination movement requires a host cursor for every enabled adjacent page.");
    seen.add(candidate.id);
    result.push({id: candidate.id as string, labelRef: candidate.labelRef as string, outputId: candidate.outputId as string, queryDigest: candidate.queryDigest as string,
      page, ...(pageCount === undefined ? {} : {pageCount}), hasPrevious: candidate.hasPrevious as boolean,
      hasNext: candidate.hasNext as boolean, ...(candidate.pending === undefined ? {} : {pending: candidate.pending as boolean}), cursors});
  }
  return {ok: true, value: result};
}

function normalizeTabs(value: unknown, contents: Map<string, AeliqoNavigationFeedbackContent>): Outcome<readonly AeliqoTabsBinding[]> {
  if (value === undefined) return {ok: true, value: []};
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return fail("bindings", "tabs must be a bounded array.");
  const seen = new Set<string>();
  const result: AeliqoTabsBinding[] = [];
  for (const item of value) {
    const candidate = record(item);
    if (candidate === undefined || !exactKeys(candidate, ["id", "items"]) || !bounded(candidate.id) || seen.has(candidate.id)
      || !Array.isArray(candidate.items) || candidate.items.length === 0 || candidate.items.length > 32)
      return fail("bindings", "Tab bindings require unique IDs and one to thirty-two items.");
    const itemIds = new Set<string>();
    const items: AeliqoTabsBindingItem[] = [];
    for (const rawItem of candidate.items) {
      const tab = record(rawItem);
      if (tab === undefined || !exactKeys(tab, ["id", "labelRef", "contentRef", "disabled"]) || !bounded(tab.id) || itemIds.has(tab.id)
        || !requireContent(contents, tab.labelRef) || (tab.contentRef !== undefined && !requireContent(contents, tab.contentRef))
        || (tab.disabled !== undefined && typeof tab.disabled !== "boolean")) return fail("bindings", "Tab items must use unique host labels and optional host content.");
      itemIds.add(tab.id);
      items.push({id: tab.id as string, labelRef: tab.labelRef as string, ...(tab.contentRef === undefined ? {} : {contentRef: tab.contentRef as string}), ...(tab.disabled === undefined ? {} : {disabled: tab.disabled as boolean})});
    }
    if (!items.some((tab) => tab.disabled !== true)) return fail("bindings", "A tab set requires at least one enabled tab.");
    seen.add(candidate.id);
    result.push({id: candidate.id, items});
  }
  return {ok: true, value: result};
}

function normalizeTrees(value: unknown, contents: Map<string, AeliqoNavigationFeedbackContent>, routes: Map<string, AeliqoNavigationFeedbackRoute>, actions: Map<string, AeliqoNavigationFeedbackAction>): Outcome<readonly AeliqoTreeBinding[]> {
  if (value === undefined) return {ok: true, value: []};
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return fail("bindings", "trees must be a bounded array.");
  const seenTrees = new Set<string>();
  const result: AeliqoTreeBinding[] = [];
  for (const item of value) {
    const candidate = record(item);
    if (candidate === undefined || !exactKeys(candidate, ["id", "labelRef", "nodes"]) || !bounded(candidate.id) || seenTrees.has(candidate.id)
      || !requireContent(contents, candidate.labelRef) || !Array.isArray(candidate.nodes)) return fail("bindings", "Tree bindings require unique IDs, host labels and node arrays.");
    const nodeIds = new Set<string>();
    const ancestors = new Set<object>();
    let count = 0;
    const walk = (rawNodes: readonly unknown[]): Outcome<readonly AeliqoTreeBindingNode[]> => {
      if (rawNodes.length > MAX_TREE_NODES) return fail("bindings", "A tree exceeds its bounded node limit.");
      const nodes: AeliqoTreeBindingNode[] = [];
      for (const rawNode of rawNodes) {
        const node = record(rawNode);
        if (node === undefined || !exactKeys(node, ["id", "labelRef", "children", "disabled", "actionRef", "routeRef"])
          || !bounded(node.id) || nodeIds.has(node.id) || !requireContent(contents, node.labelRef)
          || (node.disabled !== undefined && typeof node.disabled !== "boolean")) return fail("bindings", "Tree nodes require unique IDs and host labels.");
        if (++count > MAX_TREE_NODES) return fail("bindings", "A tree exceeds its bounded node limit.");
        if (ancestors.has(node)) return fail("bindings", "Tree bindings cannot contain cycles.");
        const hasAction = node.actionRef !== undefined;
        const hasRoute = node.routeRef !== undefined;
        if (hasAction && hasRoute) return fail("bindings", "A tree node cannot bind both an action and a route.");
        if (hasAction && !requireAction(actions, node.actionRef)) return fail("bindings", "Tree nodes may reference only registered actions.");
        if (hasRoute && !requireRoute(routes, node.routeRef)) return fail("bindings", "Tree nodes may reference only registered routes.");
        if (node.children !== undefined && !Array.isArray(node.children)) return fail("bindings", "Tree node children must be arrays.");
        nodeIds.add(node.id);
        ancestors.add(node);
        const children = node.children === undefined ? undefined : walk(node.children);
        ancestors.delete(node);
        if (children !== undefined && !children.ok) return children;
        nodes.push({id: node.id as string, labelRef: node.labelRef as string, ...(children === undefined ? {} : {children: children.value}), ...(node.disabled === undefined ? {} : {disabled: node.disabled as boolean}), ...(hasAction && typeof node.actionRef === "string" ? {actionRef: node.actionRef} : {}), ...(hasRoute && typeof node.routeRef === "string" ? {routeRef: node.routeRef} : {})});
      }
      return {ok: true, value: nodes};
    };
    const nodes = walk(candidate.nodes);
    if (!nodes.ok) return nodes;
    seenTrees.add(candidate.id);
    result.push({id: candidate.id as string, labelRef: candidate.labelRef as string, nodes: nodes.value});
  }
  return {ok: true, value: result};
}

function normalizeFeedback(value: unknown, contents: Map<string, AeliqoNavigationFeedbackContent>, actions: Map<string, AeliqoNavigationFeedbackAction>): Outcome<readonly AeliqoFeedbackBinding[]> {
  if (value === undefined) return {ok: true, value: []};
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return fail("bindings", "feedback must be a bounded array.");
  const seen = new Set<string>();
  const result: AeliqoFeedbackBinding[] = [];
  for (const item of value) {
    const candidate = record(item);
    if (candidate === undefined || !exactKeys(candidate, ["id", "labelRef", "contentRef", "headingRef", "messageRef", "actionLabelRef", "actionRef", "kind", "progressValue", "progressMax"])
      || !bounded(candidate.id) || seen.has(candidate.id)) return fail("bindings", "Feedback bindings require unique bounded IDs.");
    for (const key of ["labelRef", "contentRef", "headingRef", "messageRef", "actionLabelRef"] as const) {
      if (candidate[key] !== undefined && !requireContent(contents, candidate[key])) return fail("bindings", "Feedback text must use registered content references.");
    }
    if (candidate.actionRef !== undefined && !requireAction(actions, candidate.actionRef)) return fail("bindings", "Feedback actions must use registered action references.");
    if (candidate.kind !== undefined && (typeof candidate.kind !== "string" || !EMPTY_STATE_KINDS.includes(candidate.kind as AeliqoEmptyStateKind))) return fail("bindings", "Empty-state kind is not supported.");
    if (candidate.progressValue !== undefined && (typeof candidate.progressValue !== "number" || !Number.isFinite(candidate.progressValue) || candidate.progressValue < 0)) return fail("bindings", "Progress values must be finite and nonnegative.");
    if (candidate.progressMax !== undefined && (typeof candidate.progressMax !== "number" || !Number.isFinite(candidate.progressMax) || candidate.progressMax <= 0)) return fail("bindings", "Progress max must be finite and positive.");
    if (candidate.progressValue !== undefined && candidate.progressMax !== undefined && candidate.progressValue > candidate.progressMax) return fail("bindings", "Progress value cannot exceed its host max.");
    seen.add(candidate.id);
    result.push({id: candidate.id as string, ...(candidate.labelRef === undefined ? {} : {labelRef: candidate.labelRef as string}), ...(candidate.contentRef === undefined ? {} : {contentRef: candidate.contentRef as string}), ...(candidate.headingRef === undefined ? {} : {headingRef: candidate.headingRef as string}), ...(candidate.messageRef === undefined ? {} : {messageRef: candidate.messageRef as string}), ...(candidate.actionLabelRef === undefined ? {} : {actionLabelRef: candidate.actionLabelRef as string}), ...(candidate.actionRef === undefined ? {} : {actionRef: candidate.actionRef as string}), ...(candidate.kind === undefined ? {} : {kind: candidate.kind as AeliqoEmptyStateKind}), ...(candidate.progressValue === undefined ? {} : {progressValue: candidate.progressValue as number}), ...(candidate.progressMax === undefined ? {} : {progressMax: candidate.progressMax as number})});
  }
  return {ok: true, value: result};
}

function copyBindings(input: AeliqoNavigationFeedbackBindings | undefined): Outcome<AeliqoNavigationFeedbackBindings> {
  if (input === undefined) return {ok: true, value: {revision: "unconfigured"}};
  const parsed = parseWireValue(input);
  if (!parsed.ok) return fail("bindings", "Navigation and feedback bindings must be bounded JSON data.");
  let value: unknown;
  try { value = JSON.parse(JSON.stringify(parsed.value)); } catch { return fail("bindings", "Navigation and feedback bindings could not be copied."); }
  const candidate = record(value);
  const allowed = ["revision", "contents", "routes", "actions", "breadcrumbs", "menus", "pagination", "tabs", "trees", "feedback"] as const;
  if (candidate === undefined || !exactKeys(candidate, allowed) || !bounded(candidate.revision)) return fail("bindings", "Binding metadata requires a bounded revision and known collections.");
  const contents = normalizeContents(candidate.contents); if (!contents.ok) return contents;
  const routes = normalizeRoutes(candidate.routes); if (!routes.ok) return routes;
  const actions = normalizeActions(candidate.actions); if (!actions.ok) return actions;
  const contentIndex = new Map(contents.value.map((entry) => [entry.id, entry]));
  const routeIndex = new Map(routes.value.map((entry) => [entry.id, entry]));
  const actionIndex = new Map(actions.value.map((entry) => [entry.id, entry]));
  const breadcrumbs = normalizeBreadcrumbs(candidate.breadcrumbs, contentIndex, routeIndex); if (!breadcrumbs.ok) return breadcrumbs;
  const menus = normalizeMenus(candidate.menus, contentIndex, routeIndex, actionIndex); if (!menus.ok) return menus;
  const pagination = normalizePagination(candidate.pagination, contentIndex); if (!pagination.ok) return pagination;
  const tabs = normalizeTabs(candidate.tabs, contentIndex); if (!tabs.ok) return tabs;
  const trees = normalizeTrees(candidate.trees, contentIndex, routeIndex, actionIndex); if (!trees.ok) return trees;
  const feedback = normalizeFeedback(candidate.feedback, contentIndex, actionIndex); if (!feedback.ok) return feedback;
  return {ok: true, value: freeze({revision: candidate.revision, contents: contents.value, routes: routes.value, actions: actions.value,
    breadcrumbs: breadcrumbs.value, menus: menus.value, pagination: pagination.value, tabs: tabs.value, trees: trees.value, feedback: feedback.value})};
}

function configRecord(values: PresentationValues, allowed: readonly string[], bindings: AeliqoNavigationFeedbackBindings): Outcome<{readonly input: RecordValue; readonly bindingRef: string}> {
  const input = record(values);
  if (input === undefined || !exactKeys(input, allowed)) return fail("config", "The navigation or feedback configuration contains an unknown field.");
  if (input.bindingRevision !== bindings.revision || typeof input.bindingRevision !== "string") return fail("binding", "The binding revision is stale or does not match the host table.");
  if (!bounded(input.bindingRef)) return fail("binding", "A navigation or feedback representation requires a bounded bindingRef.");
  return {ok: true, value: {input, bindingRef: input.bindingRef}};
}

function content(contents: Map<string, AeliqoNavigationFeedbackContent>, id: string | undefined, field: string, required = true): Outcome<string | undefined> {
  if (id === undefined) return required ? fail("binding", `${field} requires a registered host content reference.`) : {ok: true, value: undefined};
  const value = contents.get(id);
  return value === undefined ? fail("binding", `${field} does not name registered host content.`) : {ok: true, value: value.text};
}

function routeValue(route: AeliqoNavigationFeedbackRoute): RecordValue {
  return {route: route.route, params: route.params, href: route.href};
}

function actionValue(action: AeliqoNavigationFeedbackAction): RecordValue {
  return {action: action.action, input: action.input};
}

function baseValues(bindings: AeliqoNavigationFeedbackBindings, bindingRef: string): RecordValue {
  return {bindingRevision: bindings.revision, bindingRef};
}

function resolved(values: RecordValue, fields: readonly string[] = [], ports: readonly InteractionPort[] = [], operations: readonly VersionRef[] = []): Outcome<{readonly values: PresentationValues; readonly fields: readonly string[]; readonly ports: readonly InteractionPort[]; readonly operations: readonly VersionRef[]}> {
  return {ok: true, value: {values: values as PresentationValues, fields, ports, operations}};
}

function navPort(id: string, payload: InteractionPort["payload"]): InteractionPort {
  return {id, direction: "output", payload};
}

function breadcrumbConfig(values: PresentationValues, bindings: AeliqoNavigationFeedbackBindings): Outcome<ReturnType<typeof resolved> extends Outcome<infer T> ? T : never> {
  const checked = configRecord(values, ["bindingRevision", "bindingRef"], bindings); if (!checked.ok) return checked;
  const entry = bindings.breadcrumbs?.find((candidate) => candidate.id === checked.value.bindingRef); if (entry === undefined) return fail("binding", "Breadcrumb bindingRef is not registered.");
  const contents = contentMap(bindings); const routes = routeMap(bindings);
  const items: RecordValue[] = []; const operations: VersionRef[] = [];
  const hasExplicitCurrent = entry.items.some((item) => item.current === true);
  for (const [index, item] of entry.items.entries()) {
    const label = content(contents, item.labelRef, "breadcrumb label"); if (!label.ok) return label;
    const route = item.routeRef === undefined ? undefined : routes.get(item.routeRef); if (item.routeRef !== undefined && route === undefined) return fail("binding", "Breadcrumb routeRef is not registered.");
    const current = item.current === true || (!hasExplicitCurrent && index === entry.items.length - 1);
    if (route !== undefined && !current) operations.push(route.route);
    items.push({id: item.id, label: label.value!, ...(route === undefined || current ? {} : routeValue(route)), ...(item.current === undefined ? {} : {current: item.current})});
  }
  const label = content(contents, entry.labelRef, "breadcrumb label"); if (!label.ok) return label;
  return resolved({...baseValues(bindings, entry.id), label: label.value!, items}, [], operations.length === 0 ? [] : [navPort("navigate", "navigate")], uniqueRefs(operations));
}

function menuConfig(values: PresentationValues, bindings: AeliqoNavigationFeedbackBindings): Outcome<ReturnType<typeof resolved> extends Outcome<infer T> ? T : never> {
  const checked = configRecord(values, ["bindingRevision", "bindingRef"], bindings); if (!checked.ok) return checked;
  const entry = bindings.menus?.find((candidate) => candidate.id === checked.value.bindingRef); if (entry === undefined) return fail("binding", "Menu bindingRef is not registered.");
  const contents = contentMap(bindings); const routes = routeMap(bindings); const actions = actionMap(bindings);
  const items: RecordValue[] = []; const operations: VersionRef[] = [];
  let hasRoute = false; let hasAction = false;
  for (const item of entry.items) {
    const label = content(contents, item.labelRef, "menu label"); if (!label.ok) return label;
    const route = item.routeRef === undefined ? undefined : routes.get(item.routeRef); const action = item.actionRef === undefined ? undefined : actions.get(item.actionRef);
    if (item.routeRef !== undefined && route === undefined) return fail("binding", "Menu routeRef is not registered.");
    if (item.actionRef !== undefined && action === undefined) return fail("binding", "Menu actionRef is not registered.");
    if (item.disabled !== true) {
      if (route !== undefined) { operations.push(route.route); hasRoute = true; }
      if (action !== undefined) { operations.push(action.action); hasAction = true; }
    }
    items.push({id: item.id, label: label.value!, ...(route === undefined || item.disabled === true ? {} : routeValue(route)), ...(action === undefined || item.disabled === true ? {} : actionValue(action)), ...(item.disabled === undefined ? {} : {disabled: item.disabled})});
  }
  const label = content(contents, entry.labelRef, "menu label"); if (!label.ok) return label;
  return resolved({...baseValues(bindings, entry.id), label: label.value!, items}, [], [
    ...(hasAction ? [navPort("action", "action-request")] : []),
    ...(hasRoute ? [navPort("navigate", "navigate")] : []),
  ], uniqueRefs(operations));
}

function paginationConfig(values: PresentationValues, bindings: AeliqoNavigationFeedbackBindings): Outcome<ReturnType<typeof resolved> extends Outcome<infer T> ? T : never> {
  const checked = configRecord(values, ["bindingRevision", "bindingRef"], bindings); if (!checked.ok) return checked;
  const entry = bindings.pagination?.find((candidate) => candidate.id === checked.value.bindingRef); if (entry === undefined) return fail("binding", "Pagination bindingRef is not registered.");
  const label = content(contentMap(bindings), entry.labelRef, "pagination label"); if (!label.ok) return label;
  const pending = entry.pending ?? false;
  const previousAvailable = !pending && entry.hasPrevious && entry.page > 1;
  const nextAvailable = !pending && entry.hasNext && (entry.pageCount === undefined || entry.page < entry.pageCount);
  const canMove = previousAvailable || nextAvailable;
  return resolved({...baseValues(bindings, entry.id), label: label.value!, outputId: entry.outputId, queryDigest: entry.queryDigest, page: entry.page,
    ...(entry.pageCount === undefined ? {} : {pageCount: entry.pageCount}), hasPrevious: entry.hasPrevious, hasNext: entry.hasNext, pending,
    cursors: entry.cursors}, [], canMove ? [navPort("page", "page")] : [], canMove ? [AELIQO_NAVIGATION_FEEDBACK_OPERATION_REFS.page] : []);
}

function tabsConfig(values: PresentationValues, bindings: AeliqoNavigationFeedbackBindings, node?: PresentationNode): Outcome<ReturnType<typeof resolved> extends Outcome<infer T> ? T : never> {
  const checked = configRecord(values, ["bindingRevision", "bindingRef", "value", "defaultValue", "activation", "orientation", "idPrefix"], bindings); if (!checked.ok) return checked;
  const entry = bindings.tabs?.find((candidate) => candidate.id === checked.value.bindingRef); if (entry === undefined) return fail("binding", "Tabs bindingRef is not registered.");
  if (node !== undefined && (node.children.length > entry.items.length || node.children.some((_, index) => entry.items[index]?.disabled === true))) return fail("children", "Tabs cannot bind child panels to disabled or missing tab items.");
  const input = checked.value.input;
  for (const key of ["value", "defaultValue"] as const) if (input[key] !== undefined && (!bounded(input[key]) || !entry.items.some((item) => item.id === input[key] && item.disabled !== true))) return fail("config", `${key} must identify an enabled item in the registered tab set.`);
  if (input.activation !== undefined && input.activation !== "automatic" && input.activation !== "manual") return fail("config", "Tabs activation must be automatic or manual.");
  if (input.orientation !== undefined && input.orientation !== "horizontal" && input.orientation !== "vertical") return fail("config", "Tabs orientation must be horizontal or vertical.");
  const contents = contentMap(bindings);
  const items: RecordValue[] = [];
  for (const item of entry.items) {
    const label = content(contents, item.labelRef, "tab label"); if (!label.ok) return label;
    const panel = content(contents, item.contentRef, "tab content", false); if (!panel.ok) return panel;
    items.push({id: item.id, label: label.value!, ...(panel.value === undefined ? {} : {content: panel.value}), ...(item.disabled === undefined ? {} : {disabled: item.disabled})});
  }
  const out: RecordValue = {...baseValues(bindings, entry.id), items, ...(input.value === undefined ? {} : {value: input.value}), ...(input.defaultValue === undefined ? {} : {defaultValue: input.defaultValue}), ...(input.activation === undefined ? {} : {activation: input.activation}), ...(input.orientation === undefined ? {} : {orientation: input.orientation}), ...(input.idPrefix === undefined ? {} : {idPrefix: input.idPrefix})};
  if (out.idPrefix !== undefined && !bounded(out.idPrefix)) return fail("config", "Tabs idPrefix must be bounded text.");
  return resolved(out, [], [], []);
}

function treeConfig(values: PresentationValues, bindings: AeliqoNavigationFeedbackBindings): Outcome<ReturnType<typeof resolved> extends Outcome<infer T> ? T : never> {
  const checked = configRecord(values, ["bindingRevision", "bindingRef", "expandedIds", "selectedId"], bindings); if (!checked.ok) return checked;
  const entry = bindings.trees?.find((candidate) => candidate.id === checked.value.bindingRef); if (entry === undefined) return fail("binding", "Tree bindingRef is not registered.");
  const input = checked.value.input;
  const ids = new Set<string>(); const operations: VersionRef[] = []; const contents = contentMap(bindings); const routes = routeMap(bindings); const actions = actionMap(bindings);
  let hasRoute = false; let hasAction = false;
  const renderNodes = (source: readonly AeliqoTreeBindingNode[], reachable = true): RecordValue[] => source.map((item) => {
    const available = reachable && item.disabled !== true;
    const childrenReachable = reachable && (item.disabled !== true || (Array.isArray(input.expandedIds) && input.expandedIds.includes(item.id)));
    ids.add(item.id);
    const route = item.routeRef === undefined ? undefined : routes.get(item.routeRef); const action = item.actionRef === undefined ? undefined : actions.get(item.actionRef);
    if (available) {
      if (route !== undefined) { operations.push(route.route); hasRoute = true; }
      if (action !== undefined) { operations.push(action.action); hasAction = true; }
    }
    const label = contents.get(item.labelRef)!.text;
    return {id: item.id, label, ...(item.children === undefined ? {} : {children: renderNodes(item.children, childrenReachable)}), ...(item.disabled === undefined ? {} : {disabled: item.disabled}), ...(route === undefined || !available ? {} : routeValue(route)), ...(action === undefined || !available ? {} : actionValue(action))};
  });
  const nodes = renderNodes(entry.nodes);
  if (input.expandedIds !== undefined && (!Array.isArray(input.expandedIds) || input.expandedIds.length > MAX_TREE_NODES || input.expandedIds.some((id) => typeof id !== "string" || !ids.has(id)) || new Set(input.expandedIds).size !== input.expandedIds.length)) return fail("config", "expandedIds must name unique registered tree nodes.");
  if (input.selectedId !== undefined && (typeof input.selectedId !== "string" || !ids.has(input.selectedId))) return fail("config", "selectedId must name a registered tree node.");
  const label = content(contents, entry.labelRef, "tree label"); if (!label.ok) return label;
  return resolved({...baseValues(bindings, entry.id), label: label.value!, nodes, ...(input.expandedIds === undefined ? {} : {expandedIds: input.expandedIds}), ...(input.selectedId === undefined ? {} : {selectedId: input.selectedId})}, [], [
    ...(hasRoute ? [navPort("navigate", "navigate")] : []),
    ...(hasAction ? [navPort("action", "action-request")] : []),
  ], uniqueRefs(operations));
}

function feedbackBase(values: PresentationValues, allowed: readonly string[], bindings: AeliqoNavigationFeedbackBindings): Outcome<{readonly input: RecordValue; readonly entry: AeliqoFeedbackBinding; readonly contents: Map<string, AeliqoNavigationFeedbackContent>; readonly actions: Map<string, AeliqoNavigationFeedbackAction>}> {
  const checked = configRecord(values, allowed, bindings); if (!checked.ok) return checked;
  const entry = bindings.feedback?.find((candidate) => candidate.id === checked.value.bindingRef); if (entry === undefined) return fail("binding", "Feedback bindingRef is not registered.");
  return {ok: true, value: {input: checked.value.input, entry, contents: contentMap(bindings), actions: actionMap(bindings)}};
}

function feedbackConfig(values: PresentationValues, kind: keyof typeof AELIQO_NAVIGATION_FEEDBACK_REFS, bindings: AeliqoNavigationFeedbackBindings, node?: PresentationNode): Outcome<ReturnType<typeof resolved> extends Outcome<infer T> ? T : never> {
  const refs = AELIQO_NAVIGATION_FEEDBACK_REFS;
  switch (kind) {
    case "tooltip": {
      const checked = feedbackBase(values, ["bindingRevision", "bindingRef", "open"], bindings); if (!checked.ok) return checked;
      const label = content(checked.value.contents, checked.value.entry.labelRef, "tooltip label"); if (!label.ok) return label;
      const body = content(checked.value.contents, checked.value.entry.contentRef, "tooltip content"); if (!body.ok) return body;
      if (checked.value.input.open !== undefined && typeof checked.value.input.open !== "boolean") return fail("config", "Tooltip open must be boolean.");
      return resolved({...baseValues(bindings, checked.value.entry.id), label: label.value!, content: body.value!, open: checked.value.input.open ?? false});
    }
    case "popover": {
      const checked = feedbackBase(values, ["bindingRevision", "bindingRef", "open", "modal", "closeOnOutside"], bindings); if (!checked.ok) return checked;
      const label = content(checked.value.contents, checked.value.entry.labelRef, "popover label"); if (!label.ok) return label;
      const body = content(checked.value.contents, checked.value.entry.contentRef, "popover content"); if (!body.ok) return body;
      for (const key of ["open", "modal", "closeOnOutside"] as const) if (checked.value.input[key] !== undefined && typeof checked.value.input[key] !== "boolean") return fail("config", `Popover ${key} must be boolean.`);
      return resolved({...baseValues(bindings, checked.value.entry.id), label: label.value!, content: body.value!, open: checked.value.input.open ?? false, modal: checked.value.input.modal ?? false, closeOnOutside: checked.value.input.closeOnOutside ?? true});
    }
    case "dialog": {
      const checked = feedbackBase(values, ["bindingRevision", "bindingRef", "open", "modal", "closeOnEscape"], bindings); if (!checked.ok) return checked;
      const heading = content(checked.value.contents, checked.value.entry.headingRef, "dialog heading"); if (!heading.ok) return heading;
      for (const key of ["open", "modal", "closeOnEscape"] as const) if (checked.value.input[key] !== undefined && typeof checked.value.input[key] !== "boolean") return fail("config", `Dialog ${key} must be boolean.`);
      const open = checked.value.input.open ?? false;
      if (node !== undefined && node.children.length > 0 && !open) return fail("children", "A closed dialog cannot claim child content before its host opens it.");
      return resolved({...baseValues(bindings, checked.value.entry.id), heading: heading.value!, open, modal: checked.value.input.modal ?? true, closeOnEscape: checked.value.input.closeOnEscape ?? true});
    }
    case "drawer": {
      const checked = feedbackBase(values, ["bindingRevision", "bindingRef", "open", "mode", "side"], bindings); if (!checked.ok) return checked;
      const heading = content(checked.value.contents, checked.value.entry.headingRef, "drawer heading"); if (!heading.ok) return heading;
      if (checked.value.input.open !== undefined && typeof checked.value.input.open !== "boolean") return fail("config", "Drawer open must be boolean.");
      if (checked.value.input.mode !== undefined && checked.value.input.mode !== "inline" && checked.value.input.mode !== "modal") return fail("config", "Drawer mode must be inline or modal.");
      if (checked.value.input.side !== undefined && checked.value.input.side !== "start" && checked.value.input.side !== "end") return fail("config", "Drawer side must be start or end.");
      const open = checked.value.input.open ?? false;
      if (node !== undefined && node.children.length > 0 && !open) return fail("children", "A closed drawer cannot claim child content before its host opens it.");
      return resolved({...baseValues(bindings, checked.value.entry.id), heading: heading.value!, open, mode: checked.value.input.mode ?? "inline", side: checked.value.input.side ?? "end"});
    }
    case "toast": {
      const checked = feedbackBase(values, ["bindingRevision", "bindingRef", "open", "tone", "duration", "dismissible"], bindings); if (!checked.ok) return checked;
      const message = content(checked.value.contents, checked.value.entry.messageRef, "toast message"); if (!message.ok) return message;
      if (checked.value.input.open !== undefined && typeof checked.value.input.open !== "boolean") return fail("config", "Toast open must be boolean.");
      if (checked.value.input.tone !== undefined && (typeof checked.value.input.tone !== "string" || !FEEDBACK_TONES.includes(checked.value.input.tone as typeof FEEDBACK_TONES[number]))) return fail("config", "Toast tone is unsupported.");
      if (checked.value.input.duration !== undefined && (typeof checked.value.input.duration !== "number" || !Number.isSafeInteger(checked.value.input.duration) || checked.value.input.duration < 0 || checked.value.input.duration > 60_000)) return fail("config", "Toast duration must be a bounded nonnegative integer.");
      if (checked.value.input.dismissible !== undefined && typeof checked.value.input.dismissible !== "boolean") return fail("config", "Toast dismissible must be boolean.");
      return resolved({...baseValues(bindings, checked.value.entry.id), message: message.value!, open: checked.value.input.open ?? false, tone: checked.value.input.tone ?? "info", duration: checked.value.input.duration ?? 5_000, dismissible: checked.value.input.dismissible ?? true});
    }
    case "alert": {
      const checked = feedbackBase(values, ["bindingRevision", "bindingRef", "open", "tone", "dismissible"], bindings); if (!checked.ok) return checked;
      const heading = content(checked.value.contents, checked.value.entry.headingRef, "alert heading", false); if (!heading.ok) return heading;
      const message = content(checked.value.contents, checked.value.entry.messageRef, "alert message"); if (!message.ok) return message;
      const actionLabel = content(checked.value.contents, checked.value.entry.actionLabelRef, "alert action label", false); if (!actionLabel.ok) return actionLabel;
      if (checked.value.entry.actionLabelRef !== undefined && checked.value.entry.actionRef === undefined) return fail("binding", "An alert action label requires a registered action.");
      if (checked.value.entry.actionRef !== undefined && checked.value.entry.actionLabelRef === undefined) return fail("binding", "An alert action requires a host action label.");
      if (checked.value.input.open !== undefined && typeof checked.value.input.open !== "boolean") return fail("config", "Alert open must be boolean.");
      if (checked.value.input.tone !== undefined && (typeof checked.value.input.tone !== "string" || !FEEDBACK_TONES.includes(checked.value.input.tone as typeof FEEDBACK_TONES[number]))) return fail("config", "Alert tone is unsupported.");
      if (checked.value.input.dismissible !== undefined && typeof checked.value.input.dismissible !== "boolean") return fail("config", "Alert dismissible must be boolean.");
      const action = checked.value.entry.actionRef === undefined ? undefined : checked.value.actions.get(checked.value.entry.actionRef); if (checked.value.entry.actionRef !== undefined && action === undefined) return fail("binding", "Alert actionRef is not registered.");
      const open = checked.value.input.open ?? true;
      const actionReachable = action !== undefined && open;
      return resolved({...baseValues(bindings, checked.value.entry.id), ...(heading.value === undefined ? {} : {heading: heading.value}), message: message.value!, ...(actionLabel.value === undefined || !actionReachable ? {} : {actionLabel: actionLabel.value}), ...(actionReachable ? actionValue(action) : {}), open, tone: checked.value.input.tone ?? "info", dismissible: checked.value.input.dismissible ?? false}, [], actionReachable ? [navPort("action", "action-request")] : [], actionReachable ? [action!.action] : []);
    }
    case "progress": {
      const checked = feedbackBase(values, ["bindingRevision", "bindingRef"], bindings); if (!checked.ok) return checked;
      const label = content(checked.value.contents, checked.value.entry.labelRef, "progress label"); if (!label.ok) return label;
      return resolved({...baseValues(bindings, checked.value.entry.id), label: label.value!, ...(checked.value.entry.progressValue === undefined ? {} : {progressValue: checked.value.entry.progressValue}), ...(checked.value.entry.progressMax === undefined ? {} : {progressMax: checked.value.entry.progressMax})});
    }
    case "skeleton": {
      const checked = feedbackBase(values, ["bindingRevision", "bindingRef", "lines", "variant", "animated"], bindings); if (!checked.ok) return checked;
      const label = content(checked.value.contents, checked.value.entry.labelRef, "skeleton label"); if (!label.ok) return label;
      const lines = checked.value.input.lines;
      if (lines !== undefined && (!Number.isSafeInteger(lines) || (lines as number) < 1 || (lines as number) > 12)) return fail("config", "Skeleton lines must be between one and twelve.");
      if (checked.value.input.variant !== undefined && !["text", "rect", "circle"].includes(checked.value.input.variant as string)) return fail("config", "Skeleton variant is unsupported.");
      if (checked.value.input.animated !== undefined && typeof checked.value.input.animated !== "boolean") return fail("config", "Skeleton animated must be boolean.");
      return resolved({...baseValues(bindings, checked.value.entry.id), label: label.value!, lines: (lines as number | undefined) ?? 3, variant: (checked.value.input.variant as string | undefined) ?? "text", animated: (checked.value.input.animated as boolean | undefined) ?? true});
    }
    case "emptyState": {
      const checked = feedbackBase(values, ["bindingRevision", "bindingRef"], bindings); if (!checked.ok) return checked;
      const heading = content(checked.value.contents, checked.value.entry.headingRef, "empty-state heading"); if (!heading.ok) return heading;
      const message = content(checked.value.contents, checked.value.entry.messageRef, "empty-state message"); if (!message.ok) return message;
      const actionLabel = content(checked.value.contents, checked.value.entry.actionLabelRef, "empty-state action label", false); if (!actionLabel.ok) return actionLabel;
      if (checked.value.entry.actionLabelRef !== undefined && checked.value.entry.actionRef === undefined) return fail("binding", "An empty-state action label requires a registered action.");
      if (checked.value.entry.actionRef !== undefined && checked.value.entry.actionLabelRef === undefined) return fail("binding", "An empty-state action requires a host action label.");
      if (checked.value.entry.kind === undefined || !EMPTY_STATE_KINDS.includes(checked.value.entry.kind)) return fail("binding", "Empty-state bindings require a truthful kind.");
      const action = checked.value.entry.actionRef === undefined ? undefined : checked.value.actions.get(checked.value.entry.actionRef); if (checked.value.entry.actionRef !== undefined && action === undefined) return fail("binding", "Empty-state actionRef is not registered.");
      return resolved({...baseValues(bindings, checked.value.entry.id), kind: checked.value.entry.kind, heading: heading.value!, message: message.value!, ...(actionLabel.value === undefined ? {} : {actionLabel: actionLabel.value}), ...(action === undefined ? {} : actionValue(action))}, [], action === undefined ? [] : [navPort("action", "action-request")], action === undefined ? [] : [action.action]);
    }
    default: return fail("config", `Unsupported feedback manifest ${String(refs[kind]?.id ?? kind)}.`);
  }
}

function manifest(refValue: VersionRef, role: string, children: {readonly min: number; readonly max: number}, visibility: PresentationManifest["visibility"], operations: readonly VersionRef[], resolveConfig: PresentationManifest["resolveConfig"]): PresentationManifest {
  return {ref: refValue, configSchema: {id: `${refValue.id}.config`, revision: "1"}, roles: [role], operations, result: "none", children, visibility, extension: false, resolveConfig};
}

/** Create the registered semantic adapters for one immutable host binding table. */
export function createNavigationFeedbackPresentationManifests(input?: AeliqoNavigationFeedbackBindings): Outcome<readonly PresentationManifest[]> {
  const copied = copyBindings(input); if (!copied.ok) return copied;
  const bindings = copied.value;
  const routes = bindings.routes ?? []; const actions = bindings.actions ?? [];
  const routeRefs = routes.map((route) => route.route); const actionRefs = actions.map((action) => action.action);
  const dynamicNavigation = uniqueRefs([...routeRefs, ...actionRefs]);
  const manifests: readonly PresentationManifest[] = [
    manifest(AELIQO_NAVIGATION_FEEDBACK_REFS.tabs, "navigation", {min: 0, max: 32}, "exclusive", [], (values, _result, node) => tabsConfig(values, bindings, node)),
    manifest(AELIQO_NAVIGATION_FEEDBACK_REFS.breadcrumb, "navigation", {min: 0, max: 0}, "leaf", uniqueRefs(routeRefs), (values) => breadcrumbConfig(values, bindings)),
    manifest(AELIQO_NAVIGATION_FEEDBACK_REFS.pagination, "navigation", {min: 0, max: 0}, "leaf", [AELIQO_NAVIGATION_FEEDBACK_OPERATION_REFS.page], (values) => paginationConfig(values, bindings)),
    manifest(AELIQO_NAVIGATION_FEEDBACK_REFS.menu, "navigation", {min: 0, max: 0}, "leaf", dynamicNavigation, (values) => menuConfig(values, bindings)),
    manifest(AELIQO_NAVIGATION_FEEDBACK_REFS.treeNav, "navigation", {min: 0, max: 0}, "leaf", dynamicNavigation, (values) => treeConfig(values, bindings)),
    manifest(AELIQO_NAVIGATION_FEEDBACK_REFS.tooltip, "feedback", {min: 0, max: 0}, "leaf", [], (values, _result, node) => feedbackConfig(values, "tooltip", bindings, node)),
    manifest(AELIQO_NAVIGATION_FEEDBACK_REFS.popover, "feedback", {min: 0, max: 16}, "exclusive", [], (values, _result, node) => feedbackConfig(values, "popover", bindings, node)),
    manifest(AELIQO_NAVIGATION_FEEDBACK_REFS.dialog, "feedback", {min: 0, max: 16}, "exclusive", [], (values, _result, node) => feedbackConfig(values, "dialog", bindings, node)),
    manifest(AELIQO_NAVIGATION_FEEDBACK_REFS.drawer, "feedback", {min: 0, max: 16}, "exclusive", [], (values, _result, node) => feedbackConfig(values, "drawer", bindings, node)),
    manifest(AELIQO_NAVIGATION_FEEDBACK_REFS.toast, "feedback", {min: 0, max: 0}, "leaf", [], (values, _result, node) => feedbackConfig(values, "toast", bindings, node)),
    manifest(AELIQO_NAVIGATION_FEEDBACK_REFS.alert, "feedback", {min: 0, max: 0}, "leaf", uniqueRefs(actionRefs), (values, _result, node) => feedbackConfig(values, "alert", bindings, node)),
    manifest(AELIQO_NAVIGATION_FEEDBACK_REFS.progress, "feedback", {min: 0, max: 0}, "leaf", [], (values, _result, node) => feedbackConfig(values, "progress", bindings, node)),
    manifest(AELIQO_NAVIGATION_FEEDBACK_REFS.skeleton, "feedback", {min: 0, max: 0}, "leaf", [], (values, _result, node) => feedbackConfig(values, "skeleton", bindings, node)),
    manifest(AELIQO_NAVIGATION_FEEDBACK_REFS.emptyState, "feedback", {min: 0, max: 0}, "leaf", uniqueRefs(actionRefs), (values, _result, node) => feedbackConfig(values, "emptyState", bindings, node)),
  ];
  return {ok: true, value: freeze(manifests)};
}

/** Default metadata is useful for discovery; host-bound nodes use the factory above. */
export const AELIQO_NAVIGATION_FEEDBACK_MANIFESTS: readonly PresentationManifest[] = (() => {
  const manifests = createNavigationFeedbackPresentationManifests();
  if (!manifests.ok) throw new Error("Default navigation and feedback manifests are invalid.");
  return manifests.value;
})();
