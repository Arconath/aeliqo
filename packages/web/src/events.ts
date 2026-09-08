import type {AeliqoInputChangeDetail, AeliqoTableSelectionDetail} from "./types.js";

export class AeliqoInputEvent extends CustomEvent<AeliqoInputChangeDetail> {
  constructor(detail: AeliqoInputChangeDetail) {
    super("aeliqo-input", {
      bubbles: true,
      composed: true,
      detail,
    });
  }
}

/** A controlled table selection proposal identified by stable entity keys. */
export class AeliqoTableSelectionEvent extends CustomEvent<AeliqoTableSelectionDetail> {
  constructor(detail: AeliqoTableSelectionDetail) {
    super("aeliqo-table-selection", {
      bubbles: true,
      composed: true,
      detail,
    });
  }
}
