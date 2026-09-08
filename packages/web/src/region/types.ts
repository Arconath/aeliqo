import type {AeliqoDataHostRequest} from "./data-renderer.js";
import type {InteractionPayload, ResultRef, ValidatedPresentation} from "@aeliqo/core";
import type {AeliqoTableColumn, AeliqoTableRow} from "../types.js";

/** Rows already resolved by the application for one exact authorized ResultRef. */
export interface AeliqoRegionResult {
  readonly ref: ResultRef;
  readonly rows: readonly AeliqoTableRow[];
  readonly columns?: readonly AeliqoTableColumn[];
}

/** A semantic request from a rendered node; the host wraps it in its event envelope. */
export interface AeliqoSemanticInteractionRequest {
  readonly nodeId: string;
  readonly portId: string;
  readonly payload: InteractionPayload;
}

export type AeliqoSemanticInteractionHandler = (request: AeliqoSemanticInteractionRequest) => void;

export interface AeliqoRegionSnapshot {
  readonly presentation: ValidatedPresentation;
  readonly results: readonly AeliqoRegionResult[];
}

/** Component-level data requests with no implicit query or runtime effect. */
export type AeliqoRegionDataRequest = Exclude<AeliqoDataHostRequest, {readonly kind: "selection" | "filter"}>;
export type AeliqoRegionDataRequestHandler = (request: AeliqoRegionDataRequest) => void;
