import {AeliqoInputElement} from "@aeliqo/web/input";
import {AeliqoTableElement} from "@aeliqo/web/table";
import {
  LARGE_POPULATION_COUNT,
  LARGE_TRANSFERRED_ROW_COUNT,
  MEDIUM_ROW_COUNT,
  MEDIUM_VIEW_COUNT,
  SMALL_ROW_COUNT,
  coldWarm,
  environmentSnapshot,
  makeRows,
  runMediumPlanner,
  runTargetedReducer,
} from "./workloads.mjs";

declare global {
  interface Window {
    aeliqoPerformance?: {
      smallStandalone: (options?: {timed?: boolean}) => Promise<unknown>;
      mediumViews: (options?: {timed?: boolean}) => Promise<unknown>;
      targetedReducer: (options?: {timed?: boolean}) => Promise<unknown>;
      boundedGeometry: () => Promise<unknown>;
      mountDispose: () => Promise<unknown>;
      runAll: (options?: {timed?: boolean}) => Promise<unknown>;
      ready: boolean;
    };
  }
}

const root: HTMLElement = document.querySelector<HTMLElement>("#fixture") ?? (() => { throw new Error("Performance fixture root is missing."); })();

if (!customElements.get("aeliqo-input")) customElements.define("aeliqo-input", AeliqoInputElement);
if (!customElements.get("aeliqo-table")) customElements.define("aeliqo-table", AeliqoTableElement);

type TestTable = AeliqoTableElement & {readonly updateComplete: Promise<unknown>};

function resetFixture(): void {
  root.replaceChildren();
}

function table(rows: readonly Record<string, string | number>[], virtualized = false, totalRows?: number): TestTable {
  const element = document.createElement("aeliqo-table") as TestTable;
  element.caption = "Performance records";
  element.columns = [
    {key: "id", label: "ID"},
    {key: "label", label: "Label"},
    {key: "value", label: "Value"},
  ];
  element.identity = ["id"];
  element.rows = rows;
  element.virtualized = virtualized;
  element.virtualCount = 40;
  element.overscan = 4;
  if (totalRows !== undefined) element.totalRows = totalRows;
  root.append(element);
  return element;
}

async function settle(element: TestTable | AeliqoInputElement): Promise<void> {
  await element.updateComplete;
}

async function smallOnce(): Promise<{readonly rowCount: number; readonly renderedRows: number; readonly inputValue: string}> {
  resetFixture();
  const rows = makeRows(SMALL_ROW_COUNT);
  const control = document.createElement("aeliqo-input") as AeliqoInputElement;
  control.label = "Standalone value";
  control.value = "ready";
  const dataTable = table(rows);
  root.prepend(control);
  await Promise.all([settle(control), settle(dataTable)]);
  const renderedRows = dataTable.shadowRoot?.querySelectorAll("tbody tr").length ?? 0;
  const input = control.shadowRoot?.querySelector("input") as HTMLInputElement | null;
  return {rowCount: rows.length, renderedRows, inputValue: input?.value ?? ""};
}

async function mediumOnce(): Promise<{readonly rowCount: number; readonly views: number; readonly virtualRows: number; readonly plan: ReturnType<typeof runMediumPlanner>}> {
  resetFixture();
  const rows = makeRows(MEDIUM_ROW_COUNT);
  const views = Array.from({length: MEDIUM_VIEW_COUNT}, () => table(rows, true, MEDIUM_ROW_COUNT));
  await Promise.all(views.map((view) => settle(view)));
  const virtualRows = views.reduce((total, view) => total + (view.shadowRoot?.querySelectorAll("tbody tr").length ?? 0), 0);
  const plan = runMediumPlanner();
  return {rowCount: rows.length, views: views.length, virtualRows, plan};
}

async function largeOnce(): Promise<{readonly populationRows: number; readonly transferredRows: number; readonly mountedRows: number; readonly totalRows: number}> {
  resetFixture();
  const rows = makeRows(LARGE_TRANSFERRED_ROW_COUNT);
  const dataTable = table(rows, true, LARGE_POPULATION_COUNT);
  await settle(dataTable);
  const mountedRows = dataTable.shadowRoot?.querySelectorAll("tbody tr").length ?? 0;
  return {populationRows: LARGE_POPULATION_COUNT, transferredRows: rows.length, mountedRows, totalRows: dataTable.totalRows ?? 0};
}

async function measured(label: string, once: () => Promise<unknown>, timed: boolean): Promise<unknown> {
  if (!timed) return once();
  const measurement = await coldWarm(label, async () => { await once(); }, {coldCount: 2, warmCount: 5});
  const sample = await once();
  return {sample, measurement};
}

async function boundedGeometry(): Promise<unknown> {
  const result = await largeOnce();
  const dataTable = root.querySelector("aeliqo-table") as TestTable | null;
  const bodyRows = dataTable?.shadowRoot?.querySelectorAll("tbody tr") ?? [];
  const rects = [...bodyRows].map((row) => row.getBoundingClientRect());
  return {result, geometry: {mountedRectCount: rects.length, maxMountedRows: 100, bounded: rects.length <= 100, totalWidth: dataTable?.getBoundingClientRect().width ?? 0}};
}

async function mountDispose(): Promise<unknown> {
  resetFixture();
  let activeListeners = 0;
  let trackedRegistrations = 0;
  let listenerId = 0;
  const ids = new WeakMap<object, number>();
  const registrations = new WeakMap<EventTarget, Set<string>>();
  const trackedTargets = new Set<EventTarget>();
  const originalAdd = EventTarget.prototype.addEventListener;
  const originalRemove = EventTarget.prototype.removeEventListener;
  const listenerKey = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): string => {
    if (listener === null) return `${type}:null:${Boolean(options === true || (typeof options === "object" && options.capture))}`;
    let id = ids.get(listener);
    if (id === undefined) { id = ++listenerId; ids.set(listener, id); }
    return `${type}:${id}:${Boolean(options === true || (typeof options === "object" && options.capture))}`;
  };
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    const key = listenerKey(type, listener, options);
    const set = registrations.get(this) ?? new Set<string>();
    if (!set.has(key)) { set.add(key); trackedRegistrations += 1; registrations.set(this, set); trackedTargets.add(this); }
    return originalAdd.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    const key = listenerKey(type, listener, options);
    const set = registrations.get(this);
    if (set?.delete(key)) trackedRegistrations -= 1;
    return originalRemove.call(this, type, listener, options);
  };
  try {
    for (let cycle = 0; cycle < 100; cycle += 1) {
      const field = document.createElement("aeliqo-input") as AeliqoInputElement;
      field.label = `Cycle ${cycle + 1}`;
      field.value = String(cycle);
      root.append(field);
      await field.updateComplete;
      field.remove();
    }
  } finally {
    EventTarget.prototype.addEventListener = originalAdd;
    EventTarget.prototype.removeEventListener = originalRemove;
  }
  for (const target of trackedTargets) {
    if (target instanceof Node && (target === document || document.documentElement.contains(target))) {
      activeListeners += registrations.get(target)?.size ?? 0;
    }
  }
  const detachedRegistrations = Math.max(0, trackedRegistrations - activeListeners);
  trackedTargets.clear();
  return {cycles: 100, activeListeners, detachedRegistrations, remainingElements: root.children.length, bounded: activeListeners === 0 && root.children.length === 0};
}

async function targetedReducer(options: {timed?: boolean} = {}): Promise<unknown> {
  if (!options.timed) return runTargetedReducer();
  return coldWarm("targeted-reducer", () => runTargetedReducer(), {coldCount: 2, warmCount: 5});
}

async function runAll(options: {timed?: boolean} = {}): Promise<unknown> {
  const timed = options.timed === true;
  const started = performance.now();
  const small = await measured("small-standalone", smallOnce, timed);
  const medium = await measured("medium-planner-and-views", mediumOnce, timed);
  const large = await measured("large-bounded-window", largeOnce, timed);
  const reducer = await targetedReducer({timed});
  const geometry = await boundedGeometry();
  const cleanup = await mountDispose();
  return {environment: environmentSnapshot(), elapsedMs: performance.now() - started, small, medium, large, reducer, geometry, cleanup,
    notes: ["Cold and warm samples are isolated within one browser tab.", "Layout and paint evidence belongs to the Playwright trace; requestAnimationFrame is not used as a paint measurement.", "Large workload transfers 100 rows while declaring a 1,000,000-row population.", "The teardown probe counts connected listeners separately from detached shadow-root registrations released with their owning elements."]};
}

window.aeliqoPerformance = {smallStandalone: (options = {}) => measured("small-standalone", smallOnce, options.timed === true),
  mediumViews: (options = {}) => measured("medium-planner-and-views", mediumOnce, options.timed === true),
  targetedReducer, boundedGeometry, mountDispose, runAll, ready: true};
