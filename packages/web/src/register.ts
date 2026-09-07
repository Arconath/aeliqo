import {AeliqoChartElement} from "./elements/aeliqo-chart.js";
import {AeliqoInputElement} from "./elements/aeliqo-input.js";
import {AeliqoTableElement} from "./elements/aeliqo-table.js";

export const AELIQO_WEB_VERSION = "0.1.0-m0";

type AeliqoElementConstructor = CustomElementConstructor & {
  readonly aeliqoVersion?: string;
};

interface ElementRegistration {
  readonly name: string;
  readonly constructor: AeliqoElementConstructor;
}

const REGISTRATIONS: readonly ElementRegistration[] = [
  {name: "aeliqo-input", constructor: AeliqoInputElement},
  {name: "aeliqo-table", constructor: AeliqoTableElement},
  {name: "aeliqo-chart", constructor: AeliqoChartElement},
];

/** Register the shared elements exactly once in the supplied browser registry. */
export function registerAeliqoElements(registry?: CustomElementRegistry): void {
  const target = registry ?? globalThis.customElements;
  if (target === undefined) {
    throw new Error("Aeliqo web elements require a CustomElementRegistry.");
  }

  for (const registration of REGISTRATIONS) {
    const current = target.get(registration.name) as AeliqoElementConstructor | undefined;
    if (current === undefined) {
      target.define(registration.name, registration.constructor);
      continue;
    }

    if (current !== registration.constructor && current.aeliqoVersion !== AELIQO_WEB_VERSION) {
      throw new Error(
        `Cannot register ${registration.name}: an incompatible custom element is already defined.`,
      );
    }
  }
}
