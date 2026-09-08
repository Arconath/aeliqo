import {AeliqoInputElement} from "@aeliqo/web/input";
import {AeliqoTableElement} from "@aeliqo/web/table";

export const STANDALONE_ROW_COUNT = 100;

type StandaloneRow = {readonly id: string; readonly label: string; readonly value: number};

type NavigationObservation = {
  readonly name: string;
  readonly type: string;
  readonly startTime: number;
  readonly duration: number;
  readonly domInteractive: number;
  readonly domContentLoadedEventEnd: number;
  readonly loadEventEnd: number;
  readonly transferSize: number;
  readonly encodedBodySize: number;
  readonly decodedBodySize: number;
};

type ResourceObservation = {
  readonly name: string;
  readonly initiatorType: string;
  readonly startTime: number;
  readonly duration: number;
  readonly transferSize: number;
  readonly encodedBodySize: number;
  readonly decodedBodySize: number;
};

type PaintObservation = {readonly name: string; readonly startTime: number; readonly duration: number};

type TimingObservation = {
  readonly navigation: NavigationObservation | undefined;
  readonly resources: readonly ResourceObservation[];
  readonly paints: readonly PaintObservation[];
  readonly fixtureReadyMs: number | undefined;
};

type StandaloneObservation = {
  readonly environment: {
    readonly userAgent: string;
    readonly platform: string;
    readonly language: string;
    readonly viewport: {readonly width: number; readonly height: number};
    readonly devicePixelRatio: number;
    readonly hardwareConcurrency: number | null;
  };
  readonly fixture: {
    readonly rowCount: number;
    readonly renderedRows: number;
    readonly controlValue: string;
    readonly inputPresent: boolean;
    readonly tablePresent: boolean;
  };
  readonly timing: TimingObservation;
  readonly resourceBytes: {
    readonly totalTransferBytes: number;
    readonly totalEncodedBytes: number;
    readonly totalDecodedBytes: number;
    readonly javascriptTransferBytes: number;
    readonly javascriptEncodedBytes: number;
    readonly javascriptDecodedBytes: number;
    readonly resourceCount: number;
    readonly javascriptResourceCount: number;
    readonly cachedResourceCount: number;
    readonly cachedJavascriptResourceCount: number;
    readonly revalidatedResourceCount: number;
    readonly revalidatedJavascriptResourceCount: number;
  };
};

declare global {
  interface Window {
    aeliqoStandalone?: {
      readonly ready: boolean;
      readonly collect: () => StandaloneObservation;
    };
  }
}

const fixture = document.querySelector<HTMLElement>("#fixture");
if (fixture === null) throw new Error("Standalone fixture root is missing.");

if (!customElements.get("aeliqo-input")) customElements.define("aeliqo-input", AeliqoInputElement);
if (!customElements.get("aeliqo-table")) customElements.define("aeliqo-table", AeliqoTableElement);

function makeRows(): readonly StandaloneRow[] {
  return Array.from({length: STANDALONE_ROW_COUNT}, (_, index) => ({
    id: `row-${index + 1}`,
    label: `Row ${index + 1}`,
    value: index,
  }));
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function navigationObservation(): NavigationObservation | undefined {
  const entry = performance.getEntriesByType("navigation").at(-1) as PerformanceNavigationTiming | undefined;
  if (entry === undefined) return undefined;
  return {
    name: entry.name,
    type: entry.type,
    startTime: toNumber(entry.startTime),
    duration: toNumber(entry.duration),
    domInteractive: toNumber(entry.domInteractive),
    domContentLoadedEventEnd: toNumber(entry.domContentLoadedEventEnd),
    loadEventEnd: toNumber(entry.loadEventEnd),
    transferSize: toNumber(entry.transferSize),
    encodedBodySize: toNumber(entry.encodedBodySize),
    decodedBodySize: toNumber(entry.decodedBodySize),
  };
}

function resourceObservations(): readonly ResourceObservation[] {
  return performance.getEntriesByType("resource").map((entry) => {
    const resource = entry as PerformanceResourceTiming;
    return {
      name: resource.name,
      initiatorType: resource.initiatorType,
      startTime: toNumber(resource.startTime),
      duration: toNumber(resource.duration),
      transferSize: toNumber(resource.transferSize),
      encodedBodySize: toNumber(resource.encodedBodySize),
      decodedBodySize: toNumber(resource.decodedBodySize),
    };
  });
}

function paintObservations(): readonly PaintObservation[] {
  return performance.getEntriesByType("paint").map((entry) => ({
    name: entry.name,
    startTime: toNumber(entry.startTime),
    duration: toNumber(entry.duration),
  }));
}

function isJavascript(resource: ResourceObservation): boolean {
  return resource.initiatorType === "script" || /\.js(?:[?#]|$)/u.test(resource.name);
}

function timingObservation(): TimingObservation {
  const resources = resourceObservations();
  const readyMark = performance.getEntriesByName("aeliqo-standalone-fixture-ready").at(-1);
  return {
    navigation: navigationObservation(),
    resources,
    paints: paintObservations(),
    fixtureReadyMs: readyMark === undefined ? undefined : toNumber(readyMark.startTime),
  };
}

function collect(): StandaloneObservation {
  const input = document.querySelector("aeliqo-input") as AeliqoInputElement | null;
  const table = document.querySelector("aeliqo-table") as AeliqoTableElement | null;
  const resources = resourceObservations();
  const javascript = resources.filter(isJavascript);
  const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
  return {
    environment: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      viewport: {width: globalThis.innerWidth, height: globalThis.innerHeight},
      devicePixelRatio: globalThis.devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    },
    fixture: {
      rowCount: table?.rows.length ?? 0,
      renderedRows: table?.shadowRoot?.querySelectorAll("tbody tr").length ?? 0,
      controlValue: input?.shadowRoot?.querySelector<HTMLInputElement>("input")?.value ?? "",
      inputPresent: input !== null,
      tablePresent: table !== null,
    },
    timing: timingObservation(),
    resourceBytes: {
      totalTransferBytes: sum(resources.map((resource) => resource.transferSize)),
      totalEncodedBytes: sum(resources.map((resource) => resource.encodedBodySize)),
      totalDecodedBytes: sum(resources.map((resource) => resource.decodedBodySize)),
      javascriptTransferBytes: sum(javascript.map((resource) => resource.transferSize)),
      javascriptEncodedBytes: sum(javascript.map((resource) => resource.encodedBodySize)),
      javascriptDecodedBytes: sum(javascript.map((resource) => resource.decodedBodySize)),
      resourceCount: resources.length,
      javascriptResourceCount: javascript.length,
      cachedResourceCount: resources.filter((resource) => resource.transferSize === 0 && resource.encodedBodySize > 0).length,
      cachedJavascriptResourceCount: javascript.filter((resource) => resource.transferSize === 0 && resource.encodedBodySize > 0).length,
      revalidatedResourceCount: resources.filter((resource) => resource.transferSize > 0 && resource.encodedBodySize === 0).length,
      revalidatedJavascriptResourceCount: javascript.filter((resource) => resource.transferSize > 0 && resource.encodedBodySize === 0).length,
    },
  };
}

const input = document.createElement("aeliqo-input") as AeliqoInputElement;
input.label = "Standalone value";
input.value = "ready";

const table = document.createElement("aeliqo-table") as AeliqoTableElement;
table.caption = "Standalone records";
table.columns = [
  {key: "id", label: "ID"},
  {key: "label", label: "Label"},
  {key: "value", label: "Value"},
];
table.identity = ["id"];
table.rows = makeRows();

fixture.replaceChildren(input, table);

await Promise.all([input.updateComplete, table.updateComplete]);
performance.mark("aeliqo-standalone-fixture-ready");
window.aeliqoStandalone = {ready: true, collect};
