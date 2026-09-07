export type TableCell = string | number | boolean | null;

export interface AeliqoTableColumn {
  readonly key: string;
  readonly label: string;
}

export type AeliqoTableRow = Readonly<Record<string, TableCell>>;

export interface AeliqoChartPoint {
  readonly label: string;
  readonly value: number;
}

export interface AeliqoInputChangeDetail {
  readonly value: string;
  readonly source: "user";
}
