import type {AeliqoInputChangeDetail} from "./types.js";

export class AeliqoInputEvent extends CustomEvent<AeliqoInputChangeDetail> {
  constructor(detail: AeliqoInputChangeDetail) {
    super("aeliqo-input", {
      bubbles: true,
      composed: true,
      detail,
    });
  }
}
