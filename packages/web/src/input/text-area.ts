import {AeliqoTextControlElement} from "./text-control.js";

/** Multiline native textarea preserving draft, caret and composition state. */
export class AeliqoTextAreaElement extends AeliqoTextControlElement {
  static readonly aeliqoVersion = "0.1.0";

  protected readonly multiline = true;
}
