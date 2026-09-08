import {AeliqoTextControlElement} from "./text-control.js";

/** Single-line native text field with controlled/uncontrolled IME-safe editing. */
export class AeliqoTextFieldElement extends AeliqoTextControlElement {
  static readonly aeliqoVersion = "0.1.0-m0";

  protected readonly multiline = false;
}
