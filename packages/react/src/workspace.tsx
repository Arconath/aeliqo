import {
  Component,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  nodeDatasetIds,
  suggestViews,
  viewTasks,
  type ViewTask,
} from "@aeliqo/core";
import type {
  PresentationTracker,
  RendererConnection,
  WorkspaceNode,
  WorkspaceStore,
} from "@aeliqo/core";
import { Comparison } from "./comparison";
import { Delta } from "./delta";
import { Detail } from "./detail";
import { Distribution } from "./distribution";
import { EventTimeline } from "./event-timeline";
import { Explorer } from "./explorer";
import { Filter } from "./filter";
import { Matrix } from "./matrix";
import { Metric } from "./metric";
import { MetricBreakdown } from "./metric-breakdown";
import { Overview } from "./overview";
import { QualityPanel } from "./quality-panel";
import { Ranking } from "./ranking";
import { RecordList } from "./record-list";
import { Relationship } from "./relationship";
import { Scatter } from "./scatter";
import { SelectionSummary } from "./selection-summary";
import { Table } from "./table";
import { TimeInvestigation } from "./time-investigation";
import { Trend } from "./trend";
import {
  safeSnapshot,
  useDatasetSnapshot,
  useSelection,
  type AdaptationEvent,
  type SemanticProps,
} from "./shared";
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
export interface WorkspaceProps {
  store: WorkspaceStore;
  onRender?: (id: string) => void;
  onPresented?: (revision: number) => void;
  presentation?: PresentationTracker;
  rendererId?: string;
  renderers?: Readonly<Record<string, ComponentType<SemanticProps>>>;
  instrumentation?: boolean;
  onAdaptation?: (event: AdaptationEvent) => void;
}
const components: Readonly<Record<string, ComponentType<SemanticProps>>> = {
  Delta,
  RecordList,
  SelectionSummary,
  Overview,
  Filter,
  Metric,
  Ranking,
  Trend,
  Table,
  Detail,
  Scatter,
  Distribution,
  Relationship,
  Matrix,
  Comparison,
  Explorer,
  MetricBreakdown,
  EventTimeline,
  TimeInvestigation,
  QualityPanel,
};
type Failures = Map<string, string>;
class Boundary extends Component<
  { node: WorkspaceNode; failures: Failures; children: ReactNode },
  { node: WorkspaceNode; failed: boolean }
> {
  state = { node: this.props.node, failed: false };
  static getDerivedStateFromProps(
    props: { node: WorkspaceNode },
    state: { node: WorkspaceNode; failed: boolean },
  ) {
    return props.node !== state.node
      ? { node: props.node, failed: false }
      : null;
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.failures.set(this.props.node.id, error.message);
  }
  componentWillUnmount() {
    this.props.failures.delete(this.props.node.id);
  }
  render() {
    return this.state.failed ? (
      <p role="alert">This component could not be rendered.</p>
    ) : (
      <>
        {this.props.children}
        <Succeeded id={this.props.node.id} failures={this.props.failures} />
      </>
    );
  }
}
function Succeeded({ id, failures }: { id: string; failures: Failures }) {
  useIsomorphicLayoutEffect(() => {
    failures.delete(id);
  });
  return null;
}
const Block = memo(function Block({
  store,
  id,
  instrumentation,
  onRender,
  onAdaptation,
  renderers,
  failures,
}: WorkspaceProps & { id: string; failures: Failures }) {
  const node = useSyncExternalStore(
    useCallback((listener) => store.subscribeNode(id, listener), [store, id]),
    useCallback(() => store.getNode(id), [store, id]),
    () => store.getNode(id),
  );
  useSelection(store, id);
  const count = useRef(0);
  const [adaptation, setAdaptation] = useState<AdaptationEvent | null>(null);
  const reportAdaptation = useCallback(
    (event: AdaptationEvent) => {
      setAdaptation((previous) =>
        previous?.mode === event.mode &&
        previous.reason === event.reason &&
        previous.visibleRecords === event.visibleRecords &&
        previous.totalRecords === event.totalRecords
          ? previous
          : event,
      );
      onAdaptation?.(event);
    },
    [onAdaptation],
  );
  count.current++;
  useEffect(() => {
    onRender?.(id);
  });
  if (!node) return null;
  const Renderer =
    components[node.component] ??
    (store.registry.get(node.component)
      ? renderers?.[node.component]
      : undefined);
  return (
    <div
      className="aeliqo-block"
      data-node-id={id}
      data-component={node.component}
      data-span={node.span}
      data-density={node.density ?? "comfortable"}
      style={{ "--aeliqo-block-span": node.span } as CSSProperties}
      data-render-count={count.current}
    >
      {Renderer ? (
        <Boundary node={node} failures={failures}>
          <Renderer store={store} node={node} onAdaptation={reportAdaptation} />
        </Boundary>
      ) : (
        <p role="alert">No renderer is registered for {node.component}.</p>
      )}
      <button
        type="button"
        className="aeliqo-pin"
        aria-pressed={node.pinned === true}
        aria-label={`${node.pinned ? "Unpin" : "Pin"} ${node.title ?? node.id}`}
        onClick={() =>
          store.apply(
            {
              version: 1,
              baseRevision: store.getState().revision,
              operations: [{ type: "pin", id, pinned: !node.pinned }],
            },
            { actor: "human" },
          )
        }
      >
        {node.pinned ? "Unpin" : "Pin"}
      </button>
      {instrumentation && (
        <span className="aeliqo-render-count">
          {id} · {count.current} renders
        </span>
      )}
      <details className="aeliqo-view-explanation">
        <summary>Why this view?</summary>
        <p>{store.registry.get(node.component)?.purpose}</p>
        <p>
          {adaptation
            ? `Presentation: ${adaptation.mode}. ${adaptation.reason === "explicit_preference" ? "Your explicit density setting takes precedence." : adaptation.reason === "record_density" ? "Record density determines label detail." : "Container width determines label detail; a stable threshold prevents repeated switching."}`
            : (store.registry.get(node.component)?.adaptation ??
              "This view preserves declared values and uses the available container space.")}
        </p>
        <ViewSuggestions store={store} node={node} />
      </details>
    </div>
  );
});
function ViewSuggestions({
  store,
  node,
}: {
  store: WorkspaceStore;
  node: WorkspaceNode;
}) {
  const [task, setTask] = useState<ViewTask>("inspect");
  const [message, setMessage] = useState("");
  const dataset = store.dataPort.getDataset(node.datasetId);
  if (!dataset) return null;
  const suggestions = suggestViews(dataset, task, store.registry);
  return (
    <div>
      <label>
        Investigate this data{" "}
        <select
          value={task}
          onChange={(event) => setTask(event.currentTarget.value as ViewTask)}
        >
          {viewTasks.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <ul>
        {suggestions.map((suggestion, index) => (
          <li key={`${suggestion.node.component}-${index}`}>
            <p>{suggestion.reason}</p>
            <button
              type="button"
              onClick={() => {
                const revision = store.getState().revision;
                const result = store.apply(
                  {
                    version: 1,
                    baseRevision: revision,
                    operations: [
                      {
                        type: "mount",
                        node: {
                          ...suggestion.node,
                          id: `suggested-${revision}-${index}`,
                        },
                      },
                    ],
                  },
                  { actor: "human" },
                );
                setMessage(
                  result.ok
                    ? `Added ${suggestion.node.component}. Your existing views are preserved.`
                    : result.error,
                );
              }}
            >
              Add {suggestion.node.component}
            </button>
          </li>
        ))}
      </ul>
      {!suggestions.length && (
        <p>
          No compatible view is available for this task and the declared fields.
        </p>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
function DatasetPresentation({
  store,
  datasetId,
  acknowledge,
}: {
  store: WorkspaceStore;
  datasetId: string;
  acknowledge: () => void;
}) {
  const snapshot = useDatasetSnapshot(store, datasetId);
  useIsomorphicLayoutEffect(acknowledge, [snapshot, acknowledge]);
  return null;
}
function Presentation({
  store,
  presentation,
  onPresented,
  renderers,
  failures,
  rendererId = "react-workspace",
}: WorkspaceProps & { failures: Failures }) {
  const revision = useSyncExternalStore(
      store.subscribe,
      () => store.getState().revision,
      () => store.getState().revision,
    ),
    connection = useRef<RendererConnection | undefined>(undefined);
  useIsomorphicLayoutEffect(() => {
    connection.current = presentation?.connect(rendererId);
    return () => {
      connection.current?.disconnect();
      connection.current = undefined;
    };
  }, [presentation, rendererId]);
  const acknowledge = useCallback(() => {
    for (const id of store.getState().order) {
      const node = store.getNode(id)!,
        failure =
          failures.get(id) ??
          (!(components[node.component] ?? renderers?.[node.component])
            ? `No renderer is registered for ${node.component}.`
            : undefined),
        snapshots = nodeDatasetIds(node).map((datasetId) =>
          safeSnapshot(
            store.dataPort.getDataset(datasetId),
            store.dataPort.getSnapshot(datasetId),
          ),
        ),
        snapshot =
          snapshots.find((snapshot) => snapshot.status === "error") ??
          snapshots[0]!;
      if (failure || snapshot.status === "error") {
        connection.current?.fail(
          revision,
          failure ?? snapshot.error ?? "Data could not be rendered.",
        );
        return;
      }
    }
    connection.current?.acknowledge(revision, {
      visible:
        typeof document !== "undefined" &&
        document.visibilityState === "visible",
    });
    onPresented?.(revision);
  }, [revision, onPresented, store, renderers, failures]);
  useIsomorphicLayoutEffect(acknowledge);
  useEffect(() => {
    document.addEventListener("visibilitychange", acknowledge);
    return () => document.removeEventListener("visibilitychange", acknowledge);
  }, [acknowledge]);
  const datasets = [
    ...new Set(
      store.getState().order.flatMap((id) => {
        const node = store.getNode(id);
        return node ? nodeDatasetIds(node) : [];
      }),
    ),
  ];
  return (
    <>
      {datasets.map((id) => (
        <DatasetPresentation
          key={id}
          store={store}
          datasetId={id}
          acknowledge={acknowledge}
        />
      ))}
    </>
  );
}
function History({ store }: { store: WorkspaceStore }) {
  useSyncExternalStore(
    store.subscribe,
    () => store.getState().revision,
    () => store.getState().revision,
  );
  return (
    <div
      className="aeliqo-workspace-history"
      role="group"
      aria-label="Workspace history"
      style={{ gridColumn: "1 / -1" }}
    >
      <button
        type="button"
        disabled={!store.canUndo()}
        onClick={() =>
          store.apply(
            {
              version: 1,
              baseRevision: store.getState().revision,
              operations: [{ type: "undo" }],
            },
            { actor: "human" },
          )
        }
      >
        Undo
      </button>
      <button
        type="button"
        disabled={!store.canRedo()}
        onClick={() =>
          store.apply(
            {
              version: 1,
              baseRevision: store.getState().revision,
              operations: [{ type: "redo" }],
            },
            { actor: "human" },
          )
        }
      >
        Redo
      </button>
    </div>
  );
}
export function Workspace(props: WorkspaceProps) {
  const failures = useRef<Failures>(new Map()).current,
    order = useSyncExternalStore(
      props.store.subscribeOrder,
      () => props.store.getState().order,
      () => props.store.getState().order,
    );
  return (
    <div className="aeliqo-workspace">
      <History store={props.store} />
      {order.map((id) => (
        <Block key={id} {...props} id={id} failures={failures} />
      ))}
      {(props.presentation || props.onPresented) && (
        <Presentation {...props} failures={failures} />
      )}
    </div>
  );
}
