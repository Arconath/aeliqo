import type {CommitPreconditions, InteractionLink, PresentationPlan, ResultRef, Scalar, VersionRef} from "@aeliqo/core";
import type {AeliqoDataColumn, AeliqoDataRecord, AeliqoDataScope, AeliqoDataStatus, AeliqoFieldOption, AeliqoFilterPredicate} from "../data/types.js";

export type AeliqoCompoundStatus = AeliqoDataStatus;

/** A result identity is always paired with its trusted semantic entity and scope. */
export interface AeliqoCompoundResult {
  readonly result: ResultRef;
  readonly entity: string;
  readonly scope?: AeliqoDataScope;
}

export interface AeliqoCompoundIdentity extends AeliqoCompoundResult {
  readonly key: string;
}

export interface AeliqoCompoundAction {
  readonly id: string;
  readonly action: VersionRef;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface AeliqoCompoundRecipeOptions {
  readonly id: string;
  readonly revision: string;
  readonly preconditions: CommitPreconditions;
}

export interface AeliqoCompoundRecipeInput extends AeliqoCompoundRecipeOptions {
  readonly result?: ResultRef;
  readonly results?: readonly ResultRef[];
}

export interface AeliqoExplorerRecipeInput extends AeliqoCompoundRecipeInput {
  readonly entity?: string;
}
export interface AeliqoComparisonMetric {
  readonly id: string;
  readonly label: string;
  readonly unit?: string;
  readonly values: Readonly<Record<string, Scalar | undefined>>;
}
export interface AeliqoComparisonRecipeInput extends AeliqoCompoundRecipeInput {
  readonly entity?: string;
  readonly compareKeys?: readonly string[];
  readonly metrics?: readonly Pick<AeliqoComparisonMetric, "id" | "label" | "unit">[];
}
export interface AeliqoBreakdownGroup {
  readonly key: string;
  readonly label: string;
  readonly numerator?: number;
  readonly denominator?: number;
  readonly value?: Scalar;
  readonly recordCount?: number;
}
export interface AeliqoBreakdownRecipeInput extends AeliqoCompoundRecipeInput {
  readonly entity?: string;
  readonly groupField?: string;
  readonly metricId?: string;
}
export interface AeliqoInvestigationRecipeInput extends AeliqoCompoundRecipeInput {
  readonly entity?: string;
  readonly trendResult?: ResultRef;
  readonly eventResult?: ResultRef;
}
export interface AeliqoSearchResultsRecipeInput extends AeliqoCompoundRecipeInput {
  readonly entity?: string;
  readonly query?: string;
}
export interface AeliqoRecordEditorRecipeInput extends AeliqoCompoundRecipeInput {
  readonly entity?: string;
  readonly action?: VersionRef;
}
export interface AeliqoFormFlowRecipeInput extends AeliqoCompoundRecipeInput {
  readonly steps?: readonly string[];
}
export interface AeliqoQualityPanelRecipeInput extends AeliqoCompoundRecipeInput {
  readonly entity?: string;
}

export interface AeliqoCompoundRecipe {
  readonly plan: PresentationPlan;
  readonly childIds: readonly string[];
}

export interface AeliqoExplorerProps {
  readonly fields: readonly AeliqoFieldOption[];
  readonly predicate?: AeliqoFilterPredicate;
  readonly rows: readonly AeliqoDataRecord[];
  readonly columns: readonly AeliqoDataColumn[];
  readonly identity: readonly string[];
  readonly entity: string;
  readonly selectedKey?: string;
  readonly detailRecord?: AeliqoDataRecord;
  readonly detailFields?: readonly AeliqoDataColumn[];
  readonly result?: ResultRef;
  readonly scope?: AeliqoDataScope;
  readonly status: AeliqoCompoundStatus;
}

export interface AeliqoSearchResultState {
  readonly query: string;
  readonly queryRevision: string;
  readonly resultRevision?: string;
  readonly result?: ResultRef;
  readonly scope?: AeliqoDataScope;
}

export interface AeliqoQualityState {
  readonly source?: string;
  readonly freshness?: string;
  readonly completeness?: string;
  readonly provenance?: readonly string[];
  readonly unsupportedClaims?: readonly string[];
}

export interface AeliqoComparisonSetDetail {
  readonly source: "user";
  readonly entity: string;
  readonly keys: readonly string[];
  readonly result?: ResultRef;
}

export interface AeliqoRecordEditorSaveDetail {
  readonly source: "user";
  readonly entity: string;
  readonly key: string;
  readonly entityRevision: string;
  readonly action?: VersionRef;
}
export interface AeliqoRecordEditorCancelDetail {
  readonly source: "user";
  readonly entity: string;
  readonly key: string;
  readonly entityRevision: string;
}
export interface AeliqoFormFlowStepDetail {
  readonly source: "user";
  readonly from: string;
  readonly to: string;
  readonly direction: "next" | "back";
}
export interface AeliqoFormFlowCommitDetail {
  readonly source: "user";
  readonly step: string;
}

export type AeliqoCompoundInteractionLink = InteractionLink;
export type {AeliqoDataColumn, AeliqoDataRecord, AeliqoDataScope, AeliqoDataStatus, AeliqoFieldOption, AeliqoFilterPredicate};
