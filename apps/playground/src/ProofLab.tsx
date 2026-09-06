import { useSyncExternalStore } from "react";
import { capabilityContracts, catalog } from "@aeliqo/core";
import { dataPort } from "./data";
import { store } from "./runtime";
import { proof } from "./proof-store";
export function ProofLab() {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  );
  const evidence = useSyncExternalStore(
    proof.subscribe,
    proof.getSnapshot,
    proof.getSnapshot,
  );
  const latest = evidence.events.at(-1);
  return (
    <section className="proof-lab">
      <div className="section-title">
        <h2>Proof Lab</h2>
        <span className="sandbox">Observed runtime evidence</span>
      </div>
      <div className="proof-grid">
        <article>
          <h3>Semantic plan</h3>
          <p>{evidence.plan?.intent ?? "Choose a Showcase scenario or use a protocol."}</p>
          <pre>
            {JSON.stringify(
              evidence.plan
                ? {
                    semanticNeeds: evidence.plan.semanticNeeds,
                    contractsMatched: evidence.plan.contracts,
                    datasets: evidence.plan.datasets,
                    relationshipsFollowed: evidence.plan.relationships,
                    operations: evidence.plan.operations,
                    source: evidence.plan.source,
                  }
                : { status: "No semantic plan observed yet" },
              null,
              2,
            )}
          </pre>
        </article>
        <article>
          <h3>Mutation & update timing</h3>
          <p>Local measurements keep external-agent time separate.</p>
          <pre>
            {JSON.stringify(
              {
                capabilityValidationMs: latest?.validationMs ?? null,
                capabilityExecutionMs: latest?.executionMs ?? null,
                coreWorkspaceMutationMs: evidence.plan?.coreMutationMs ?? null,
                reactUpdateObservedMs: evidence.plan?.reactUpdateMs ?? null,
                componentsUpdated: evidence.plan?.updatedComponents ?? [],
                externalAgentMs: evidence.providerMs,
                transportMs: evidence.transportMs,
              },
              null,
              2,
            )}
          </pre>
        </article>
        <article>
          <h3>Workspace</h3>
          <p>
            Revision <b>{state.revision}</b> · {state.order.length} blocks ·{" "}
            {Object.keys(state.bindings).length} bindings
          </p>
          <pre>
            {JSON.stringify(
              {
                order: state.order,
                nodes: state.nodes,
                bindings: state.bindings,
                selections: state.selections,
              },
              null,
              2,
            )}
          </pre>
        </article>
        <article>
          <h3>Latest capability call</h3>
          <p>
            {latest
              ? `${latest.source} · ${latest.capability}`
              : "No capability calls yet"}
          </p>
          <pre>
            {JSON.stringify(
              latest ?? {
                status: "Use a direct operation or a connected protocol",
              },
              null,
              2,
            )}
          </pre>
        </article>
        <article>
          <h3>Rendering & adaptation</h3>
          <p>
            Committed workspace-block updates. Compact rankings preserve labels
            and values.
          </p>
          <pre>
            {JSON.stringify(
              { commits: evidence.renders, adaptations: evidence.adaptations },
              null,
              2,
            )}
          </pre>
          <p>
            React duration is unavailable in this standard production build.
            Counts are observed; no duration is fabricated.
          </p>
        </article>
        <article>
          <h3>AI latency is separate</h3>
          <p>
            Provider/network:{" "}
            {evidence.providerMs === null
              ? "not measured"
              : `${evidence.providerMs.toFixed(1)} ms`}
          </p>
          <p>
            Remaining tool/transport time:{" "}
            {evidence.transportMs === null
              ? "not measured"
              : `${evidence.transportMs.toFixed(1)} ms`}
          </p>
          <p>
            Core validation and execution timings are recorded per capability
            call. They exclude external reasoning and browser paint.
          </p>
        </article>
        <article>
          <h3>Trusted output boundary</h3>
          <p>The control plane accepts data queries and versioned semantic operations only.</p>
          <pre>{JSON.stringify({ generatedJSX: 0, generatedCSS: 0, generatedJavaScript: 0 }, null, 2)}</pre>
        </article>
      </div>
      <details>
        <summary>Dataset contracts & declared relationships</summary>
        <pre>{JSON.stringify(dataPort.listDatasets(), null, 2)}</pre>
      </details>
      <details>
        <summary>Component contracts · fixed catalog</summary>
        <pre>{JSON.stringify(catalog, null, 2)}</pre>
      </details>
      <details>
        <summary>Shared capability contracts</summary>
        <pre>
          {JSON.stringify(
            capabilityContracts.map(({ id, description, jsonSchema }) => ({
              id,
              description,
              jsonSchema,
            })),
            null,
            2,
          )}
        </pre>
      </details>
      <details>
        <summary>Direct primitive operations · source: direct</summary>
        <pre>{JSON.stringify(evidence.directOperations, null, 2)}</pre>
      </details>
      <details>
        <summary>Capability event log · last 100</summary>
        <pre>{JSON.stringify(evidence.events, null, 2)}</pre>
      </details>
    </section>
  );
}
