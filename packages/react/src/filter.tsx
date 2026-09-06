import { useId, useRef, useState } from "react";
import type { Dataset, Filter as SemanticFilter } from "@aeliqo/core";
import { Card, type SemanticProps } from "./shared";

export interface FilterProps {
  dataset: Dataset;
  filters: readonly SemanticFilter[];
  onChange: (filters: readonly SemanticFilter[]) => void;
  title?: string;
}
/** Draft text belongs to this control. Only explicit submission commits semantic filters. */
export function Filter(props: FilterProps | SemanticProps) {
  if ("store" in props) {
    const dataset = props.store.dataPort.getDataset(props.node.datasetId);
    if (!dataset) return <p role="alert">Dataset is unavailable.</p>;
    return <FilterControl dataset={dataset} filters={props.node.filters ?? []} title={props.node.title} onChange={filters => props.store.apply({ version: 1, baseRevision: props.store.getState().revision, operations: [{ type: "configure", id: props.node.id, patch: { filters } }] }, { actor: "human" })} />;
  }
  return <FilterControl {...props} />;
}
function FilterControl({ dataset, filters, onChange, title }: FilterProps) {
  const id = useId();
  const fields = [...dataset.dimensions, ...dataset.metrics, ...dataset.timeFields];
  const [field, setField] = useState(fields[0]?.key ?? "");
  const [operator, setOperator] = useState<SemanticFilter["operator"]>("eq");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const composing = useRef(false);
  const numeric = dataset.metrics.some(item => item.key === field);
  return <Card title={title ?? "Filter records"}>
    <form className="aeliqo-filter" onSubmit={event => {
      event.preventDefault();
      if (composing.current) return;
      if (!fields.some(item => item.key === field) || !draft.trim()) { setError("Choose a field and enter a value."); return; }
      const value = numeric ? Number(draft) : draft;
      if (typeof value === "number" && !Number.isFinite(value)) { setError("Enter a finite number."); return; }
      onChange([...filters.filter(item => item.field !== field), { field, operator: numeric ? operator : "eq", value }]);
      setError("");
    }}>
      <label htmlFor={`${id}-field`}>Field</label>
      <select id={`${id}-field`} value={field} onChange={event => { setField(event.target.value); setError(""); }}>
        {fields.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
      </select>
      {numeric && <><label htmlFor={`${id}-operator`}>Comparison</label><select id={`${id}-operator`} value={operator} onChange={event => setOperator(event.target.value as SemanticFilter["operator"])}>
        <option value="eq">Equals</option><option value="lt">Less than</option><option value="lte">At most</option><option value="gt">Greater than</option><option value="gte">At least</option>
      </select></>}
      <label htmlFor={`${id}-value`}>Value</label>
      <input id={`${id}-value`} value={draft} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={event => setDraft(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={event => { if (event.key === "Enter" && (composing.current || event.nativeEvent.isComposing)) event.preventDefault(); }} />
      <button type="submit">Apply filter</button>
      <button type="button" onClick={() => { onChange([]); setError(""); }}>Clear filters</button>
      {error && <p role="alert" id={`${id}-error`}>{error}</p>}
    </form>
    <ul aria-label="Committed filters">{filters.map((filter, index) => <li key={`${filter.field}-${index}`}>{fields.find(item => item.key === filter.field)?.label ?? filter.field} {filter.operator} {Array.isArray(filter.value) ? filter.value.join(", ") : String(filter.value)} <button type="button" aria-label={`Remove ${fields.find(item => item.key === filter.field)?.label ?? filter.field} filter`} onClick={() => onChange(filters.filter((_, position) => position !== index))}>Remove</button></li>)}</ul>
  </Card>;
}
