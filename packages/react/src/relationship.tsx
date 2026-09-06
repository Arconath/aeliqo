import { useMemo } from "react";
import { scalePoint } from "d3-scale";
import { type DataSnapshot, type Dataset } from "@aeliqo/core";
import {
  Card,
  DataState,
  DataWarnings,
  ready,
  safeSnapshot,
  select,
  useData,
  useDatasetSnapshot,
  useSelection,
  type SemanticProps,
} from "./shared";
export interface RelationshipProps {
  dataset: Dataset;
  snapshot: DataSnapshot;
  relationship: string;
  targetDataset: Dataset;
  targetSnapshot: DataSnapshot;
  limit?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  title?: string;
}
export function Relationship(props: RelationshipProps | SemanticProps) {
  return "store" in props ? (
    <SemanticRelationship {...props} />
  ) : (
    <StandaloneRelationship {...props} />
  );
}
function SemanticRelationship(props: SemanticProps) {
  const { data, dataset } = useData(props);
  const relation = dataset?.relationships?.find(
      (item) => item.id === props.node.relationship,
    ),
    targetDataset = relation
      ? props.store.dataPort.getDataset(relation.targetDatasetId)
      : undefined,
    targetSnapshot = useDatasetSnapshot(
      props.store,
      relation?.targetDatasetId ?? props.node.datasetId,
    ),
    selectedId = useSelection(props.store, props.node.id);
  return (
    <RelationshipView
      data={data}
      dataset={dataset}
      relationship={props.node.relationship}
      targetDataset={targetDataset}
      targetSnapshot={targetSnapshot}
      limit={props.node.limit}
      selectedId={selectedId}
      onSelect={(id) => select(props.store, props.node, id)}
      title={props.node.title}
    />
  );
}
function StandaloneRelationship(props: RelationshipProps) {
  return (
    <RelationshipView
      data={safeSnapshot(props.dataset, props.snapshot)}
      dataset={props.dataset}
      relationship={props.relationship}
      targetDataset={props.targetDataset}
      targetSnapshot={safeSnapshot(props.targetDataset, props.targetSnapshot)}
      limit={props.limit}
      selectedId={props.selectedId}
      onSelect={props.onSelect}
      title={props.title}
    />
  );
}
function RelationshipView({
  data,
  dataset,
  relationship,
  targetDataset,
  targetSnapshot,
  limit,
  selectedId,
  onSelect,
  title,
}: {
  data: DataSnapshot;
  dataset?: Dataset;
  relationship?: string;
  targetDataset?: Dataset;
  targetSnapshot: DataSnapshot;
  limit?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  title?: string;
}) {
  const relation = dataset?.relationships?.find(
    (item) => item.id === relationship,
  );
  const rows = useMemo(
    () =>
      !dataset || !targetDataset || !relation
        ? []
        : data.records.slice(0, limit ?? data.records.length).map((source) => ({
            source,
            target: targetSnapshot.records.find(
              (target) =>
                target[relation.targetField ?? targetDataset.identity] ===
                source[relation.field],
            ),
          })),
    [
      data.records,
      dataset,
      targetDataset,
      targetSnapshot.records,
      relation,
      limit,
    ],
  );
  return (
    <Card
      title={title ?? `${dataset?.entity ?? "Entity"} relationships`}
      subtitle={
        relation
          ? `${dataset?.label} → ${targetDataset?.label}`
          : dataset?.label
      }
      badge="Declared graph"
    >
      {!ready(data) ||
      targetSnapshot.status !== "ready" ||
      !dataset ||
      !targetDataset ||
      !relation ? (
        <DataState
          data={targetSnapshot.status !== "ready" ? targetSnapshot : data}
        />
      ) : (
        <>
          {(() => {
            const targets = [
                ...new Map(
                  rows.flatMap(({ target }) =>
                    target
                      ? [
                          [
                            String(target[targetDataset.identity]),
                            target,
                          ] as const,
                        ]
                      : [],
                  ),
                ).values(),
              ],
              sourceY = scalePoint<string>()
                .domain(
                  rows.map(({ source }) => String(source[dataset.identity])),
                )
                .range([20, 184])
                .padding(0.45),
              targetY = scalePoint<string>()
                .domain(
                  targets.map((target) =>
                    String(target[targetDataset.identity]),
                  ),
                )
                .range([20, 184])
                .padding(0.8);
            return (
              <svg
                className="aeliqo-relationship"
                viewBox="0 0 540 205"
                role="img"
                aria-label={`${dataset.entity} to ${targetDataset.entity} relationship`}
              >
                <title>{`${dataset.entity} to ${targetDataset.entity} relationship`}</title>
                {rows.map(({ source, target }) => {
                  const id = String(source[dataset.identity]),
                    targetId = target
                      ? String(target[targetDataset.identity])
                      : null,
                    y = sourceY(id) ?? 0;
                  return (
                    <g key={id}>
                      <path
                        data-selected={selectedId === id}
                        d={
                          targetId
                            ? `M 196 ${y} C 278 ${y}, 278 ${targetY(targetId) ?? 0}, 355 ${targetY(targetId) ?? 0}`
                            : ""
                        }
                      />
                      <text x="184" y={y + 4} textAnchor="end">
                        {String(source[dataset.labelField])}
                      </text>
                      <circle cx="196" cy={y} r={selectedId === id ? 7 : 5} />
                    </g>
                  );
                })}
                {targets.map((target) => {
                  const id = String(target[targetDataset.identity]),
                    y = targetY(id) ?? 0;
                  return (
                    <g key={id}>
                      <circle cx="370" cy={y} r="6" />
                      <text x="382" y={y + 4}>
                        {String(target[targetDataset.labelField])}
                      </text>
                    </g>
                  );
                })}
              </svg>
            );
          })()}
          <ul className="aeliqo-relationship-list">
            {rows.map(({ source, target }) => {
              const id = String(source[dataset.identity]);
              return (
                <li key={id}>
                  <button
                    type="button"
                    aria-pressed={selectedId === id}
                    onClick={() => onSelect?.(id)}
                  >
                    <span>{String(source[dataset.labelField])}</span>
                    <span aria-hidden="true">→</span>
                    <span>
                      {target
                        ? String(target[targetDataset.labelField])
                        : "No related record"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <DataWarnings data={data} />
      <DataWarnings data={targetSnapshot} />
    </Card>
  );
}
