import type {ResultRef} from "@aeliqo/core";

export type TableCell = string | number | boolean | null;

export interface AeliqoTableColumn {
  readonly key: string;
  readonly label: string;
}

export type AeliqoTableRow = Readonly<Record<string, TableCell>>;

/** A stable identity is derived from these fields, never from a rendered row index. */
export type AeliqoIdentityFields = readonly string[];

export type AeliqoTableSelectionMode = "none" | "single" | "multiple";

export interface AeliqoTableSelectionDetail {
  readonly mode: "clear" | "ids";
  readonly entity: string;
  readonly keys: readonly string[];
  readonly result?: ResultRef;
}

export interface AeliqoChartPoint {
  readonly label: string;
  /** `null` is an unknown/missing point and creates a visible line gap. */
  readonly value: number | null;
}

export interface AeliqoChartSeries {
  readonly id: string;
  readonly label: string;
  readonly unit?: string;
  readonly points: readonly AeliqoChartPoint[];
}

export interface AeliqoInputChangeDetail {
  readonly value: string;
  readonly source: "user";
}
