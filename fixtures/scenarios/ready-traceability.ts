export interface ScenarioSourceAssertion {
  readonly path: string;
  readonly marker: string;
}

export interface ScenarioEvidenceReference {
  readonly taskId: string;
  readonly path: string;
}

export interface ReadyScenarioTrace {
  readonly id: string;
  readonly sources: readonly ScenarioSourceAssertion[];
  readonly evidence: readonly ScenarioEvidenceReference[];
}

/**
 * Scenario-level links to assertions that already exercise production code.
 *
 * This is intentionally a traceability index, not a second implementation of
 * the underlying product tests. The scenario audit verifies that every exact
 * assertion remains present and that its frozen evidence is still referenced
 * by the owning task.
 */
export const readyScenarioTraceability: readonly ReadyScenarioTrace[] = [
  {
    id: 'S01',
    sources: [
      {
        path: 'tests/vertical-slice/hr-browser.spec.ts',
        marker: 'actual raw-data view supports selection, queryless reorder, stale refusal and revocation',
      },
    ],
    evidence: [{ taskId: 'T39', path: 'harness/evidence/t39/5fc97e0ce95e/manifest.json' }],
  },
  {
    id: 'S02',
    sources: [
      {
        path: 'tests/query/hr-production.test.ts',
        marker: 'binds every per-employee count and rate to the raw fixture',
      },
      { path: 'tests/query/oracle.test.ts', marker: 'retains the HR unknown-versus-approved-leave binding mutations' },
    ],
    evidence: [{ taskId: 'T07', path: 'harness/evidence/t07/57ce3745e69d/manifest.json' }],
  },
  {
    id: 'S03',
    sources: [
      {
        path: 'tests/vertical-slice/integration/hr-runtime.test.ts',
        marker: 'evaluates ranking before weekly trend and binds original ADC descriptors to the semantic task',
      },
      {
        path: 'tests/query/oracle.test.ts',
        marker: 'selects a fixed full-period top-K population before temporal evaluation',
      },
    ],
    evidence: [{ taskId: 'T31', path: 'harness/evidence/t31/5e37b53-explicit-mcp/manifest.json' }],
  },
  {
    id: 'S04',
    sources: [
      {
        path: 'tests/query/oracle-production.test.ts',
        marker: 'evaluates an exact decimal aggregate and pooled ratio',
      },
    ],
    evidence: [{ taskId: 'T07', path: 'harness/evidence/t07/57ce3745e69d/manifest.json' }],
  },
  {
    id: 'S07',
    sources: [
      {
        path: 'tests/agents/containment/binder.test.ts',
        marker: 'distinguishes needs-meaning and needs-choice from planner diagnostics',
      },
      {
        path: 'tests/meaning-authoring/meaning-authoring.test.ts',
        marker: 'rejects shared AI hypotheses and keeps code definitions read-only',
      },
    ],
    evidence: [{ taskId: 'T23', path: 'harness/evidence/t23/26f15f38f12a/manifest.json' }],
  },
  {
    id: 'S08',
    sources: [
      {
        path: 'tests/task-experience/experience.test.ts',
        marker: 'cannot remove comparisons by injecting mobile or keyboard claims',
      },
      { path: 'tests/adaptation-semantic/browser.spec.ts', marker: 'proof.request(320)' },
    ],
    evidence: [{ taskId: 'T20', path: 'harness/evidence/t20/d55929134cdc/manifest.json' }],
  },
  {
    id: 'S09',
    sources: [
      {
        path: 'tests/adaptation-semantic/browser.spec.ts',
        marker: 'IME and active pointer defer changes until their native event ends',
      },
    ],
    evidence: [{ taskId: 'T20', path: 'harness/evidence/t20/d55929134cdc/manifest.json' }],
  },
  {
    id: 'S10',
    sources: [
      {
        path: 'tests/task-experience/experience.test.ts',
        marker: 'treats explicit representation as hard and preferred representation as soft',
      },
    ],
    evidence: [{ taskId: 'T19', path: 'harness/evidence/t19/291ba1f603ae/manifest.json' }],
  },
  {
    id: 'S12',
    sources: [
      {
        path: 'tests/runtime-regions/regions.test.ts',
        marker: 'allows a disjoint result refresh when the proposal read set omits that output',
      },
    ],
    evidence: [{ taskId: 'T10', path: 'harness/evidence/t10/2524bf9a4d46/manifest.json' }],
  },
  {
    id: 'S13',
    sources: [
      {
        path: 'tests/runtime-results/results.test.ts',
        marker: 'preserves authorized data on refresh failure while newer generations win',
      },
      {
        path: 'tests/runtime-regions/regions.test.ts',
        marker: 'does not resurrect a region when post-authorization authority reenters revoke',
      },
    ],
    evidence: [{ taskId: 'T09', path: 'harness/evidence/t09/7beeab22ef99/manifest.json' }],
  },
  {
    id: 'S14',
    sources: [
      {
        path: 'tests/runtime-results/results.test.ts',
        marker: 'pulls one bounded event at a time and wins an abort race without awaiting cleanup',
      },
      {
        path: 'tests/runtime-regions/regions.test.ts',
        marker: 'closes existing observers when the region is disposed',
      },
    ],
    evidence: [{ taskId: 'T09', path: 'harness/evidence/t09/7beeab22ef99/manifest.json' }],
  },
  {
    id: 'S15',
    sources: [
      {
        path: 'tests/query/oracle-production.test.ts',
        marker: 'uses an identity-preserving semijoin and rejects a fanout join',
      },
    ],
    evidence: [{ taskId: 'T07', path: 'harness/evidence/t07/57ce3745e69d/manifest.json' }],
  },
  {
    id: 'S16',
    sources: [
      {
        path: 'tests/query/civil-weekly.test.ts',
        marker: 'requires explicit week start and coherent source/calendar/timezone policy',
      },
      { path: 'tests/query/oracle-production.test.ts', marker: 'applies half-open instant bounds' },
    ],
    evidence: [{ taskId: 'T07', path: 'harness/evidence/t07/57ce3745e69d/manifest.json' }],
  },
  {
    id: 'S17',
    sources: [
      {
        path: 'tests/runtime-results/results.test.ts',
        marker: 'keeps partial coverage separate from ready completeness and rejects terminal promotion',
      },
    ],
    evidence: [{ taskId: 'T09', path: 'harness/evidence/t09/7beeab22ef99/manifest.json' }],
  },
  {
    id: 'S18',
    sources: [
      {
        path: 'tests/query/oracle-production.test.ts',
        marker: 'keeps decimal sums exact and accepts only safe integer source values',
      },
      {
        path: 'tests/semantics/semantic.test.ts',
        marker: 'treats unit symbols and currency qualifiers as part of unit identity',
      },
    ],
    evidence: [{ taskId: 'T04', path: 'harness/evidence/t04/f1848485a702/manifest.json' }],
  },
  {
    id: 'S20',
    sources: [
      { path: 'tests/platform/ssr.test.ts', marker: 'window.serverSecret' },
      {
        path: 'tests/security/package-boundaries.test.ts',
        marker: 'rejects traversal, dynamic imports and ambient effects while allowing explicit input dates',
      },
    ],
    evidence: [{ taskId: 'T28', path: 'harness/evidence/t28/54bb823-sourcebound/manifest.json' }],
  },
  {
    id: 'S21',
    sources: [
      {
        path: 'tests/runtime-actions/actions.test.ts',
        marker: 'requires a trusted positive confirmation for required actions and rechecks after it',
      },
      {
        path: 'tests/runtime-interaction/controller.test.ts',
        marker: 'keeps action requests proposal-only and derives actor from host context',
      },
    ],
    evidence: [{ taskId: 'T11', path: 'harness/evidence/t11/1fb2bf0b46df/manifest.json' }],
  },
  {
    id: 'S22',
    sources: [
      { path: 'tests/consumers/protocol-tarballs.mjs', marker: 'BYOK real dispatcher parity' },
      { path: 'tests/consumers/protocol-tarballs.mjs', marker: 'Installed actual MCP failed' },
    ],
    evidence: [{ taskId: 'T40', path: 'harness/evidence/t40/final-release-smoke/manifest.json' }],
  },
  {
    id: 'S23',
    sources: [
      {
        path: 'tests/protocol-webmcp/webmcp.test.ts',
        marker: 'feature-detects document.modelContext and does not shim an absent host',
      },
    ],
    evidence: [{ taskId: 'T24', path: 'harness/evidence/t24/8ddad0da180c/manifest.json' }],
  },
  {
    id: 'S25',
    sources: [{ path: 'tests/framework-consumers/framework-tarballs.mjs', marker: 'Vanilla shell is incomplete' }],
    evidence: [{ taskId: 'T25', path: 'harness/evidence/t25/44fccb94ca19/manifest.json' }],
  },
  {
    id: 'S26',
    sources: [{ path: 'tests/framework-consumers/framework-tarballs.mjs', marker: 'React declarative Shadow DOM SSR' }],
    evidence: [{ taskId: 'T25', path: 'harness/evidence/t25/44fccb94ca19/manifest.json' }],
  },
  {
    id: 'S27',
    sources: [{ path: 'tests/framework-consumers/framework-tarballs.mjs', marker: 'createApp(VueFixture).mount' }],
    evidence: [{ taskId: 'T25', path: 'harness/evidence/t25/44fccb94ca19/manifest.json' }],
  },
  {
    id: 'S29',
    sources: [
      {
        path: 'tests/foundation/browser.spec.ts',
        marker: 'forced colors, RTL and large text preserve visible controls',
      },
      { path: 'tests/visual/data-interactions.spec.ts', marker: 'selected state remains visible in forced colors' },
    ],
    evidence: [{ taskId: 'T29', path: 'harness/evidence/t29/afa1f19-family-behavior/manifest.json' }],
  },
  {
    id: 'S30',
    sources: [
      {
        path: 'tests/compound/browser.spec.ts',
        marker: 'comparison and breakdown use shared bounded tables and host evaluated values',
      },
      {
        path: 'tests/compound/browser.spec.ts',
        marker: 'search results hide stale materialization and restore the matching revision',
      },
    ],
    evidence: [{ taskId: 'T31', path: 'harness/evidence/t31/5e37b53-explicit-mcp/manifest.json' }],
  },
  {
    id: 'S31',
    sources: [
      {
        path: 'tests/compound/browser.spec.ts',
        marker: 'record editor validates slotted fields and includes the explicit draft receipt',
      },
      {
        path: 'tests/input/browser.spec.ts',
        marker: 'form wrapper validates drafts before emitting its explicit host action',
      },
    ],
    evidence: [
      { taskId: 'T31', path: 'harness/evidence/t31/5e37b53-explicit-mcp/manifest.json' },
      { taskId: 'T25', path: 'harness/evidence/t25/44fccb94ca19/manifest.json' },
    ],
  },
  {
    id: 'S33',
    sources: [
      {
        path: 'tests/runtime-presentation/adaptation.test.ts',
        marker: 'rolls back a renderer failure without publishing canonical state',
      },
      {
        path: 'tests/runtime-presentation/adaptation.test.ts',
        marker: 'clears renderer content when attached to an already closed region',
      },
    ],
    evidence: [{ taskId: 'T20', path: 'harness/evidence/t20/d55929134cdc/manifest.json' }],
  },
  {
    id: 'S34',
    sources: [
      {
        path: 'tests/runtime-regions/regions.test.ts',
        marker: 'serializes A/B tokens so the second stale token cannot overwrite A',
      },
      {
        path: 'tests/runtime-regions/regions.test.ts',
        marker: 'does not undo an atomic commit when an observer cancels afterward',
      },
    ],
    evidence: [{ taskId: 'T10', path: 'harness/evidence/t10/2524bf9a4d46/manifest.json' }],
  },
  {
    id: 'S35',
    sources: [
      { path: 'tests/catalog-examples/catalog.test.ts', marker: 'toHaveLength(71)' },
      { path: 'tests/catalog-examples/browser.spec.ts', marker: 'toHaveCount(71)' },
    ],
    evidence: [{ taskId: 'T29', path: 'harness/evidence/t29/86884f8-catalog-coverage/manifest.json' }],
  },
  {
    id: 'S37',
    sources: [
      {
        path: 'tests/meaning-authoring/activation.test.ts',
        marker: 'never substitutes allowlisted contents at an existing immutable version',
      },
      { path: 'tests/meaning-authoring/activation.test.ts', marker: 'reports all scope-revoked dependents' },
    ],
    evidence: [{ taskId: 'T23', path: 'harness/evidence/t23/26f15f38f12a/manifest.json' }],
  },
  {
    id: 'S38',
    sources: [
      {
        path: 'tests/meaning-authoring/dynamic-catalog.test.ts',
        marker: 'accepts schema-loaded field names while retaining literal-catalog typo checks',
      },
      { path: 'fixtures/evaluation/t40-data-query-heldout.manifest.json', marker: 'service-support' },
    ],
    evidence: [{ taskId: 'T31', path: 'harness/evidence/t31/5e37b53-explicit-mcp/manifest.json' }],
  },
  {
    id: 'S39',
    sources: [
      {
        path: 'tests/vertical-slice/integration/hr-presentation.test.ts',
        marker: 'composes without a preset, preserves selection across queryless reorder and refuses a stale proposal',
      },
    ],
    evidence: [{ taskId: 'T39', path: 'harness/evidence/t39/5fc97e0ce95e/manifest.json' }],
  },
  {
    id: 'S40',
    sources: [
      {
        path: 'tests/task-experience/task.test.ts',
        marker: 'orders multiple grains and delayed outputs without flattening their queries',
      },
      {
        path: 'fixtures/evaluation/t40-data-query-heldout.manifest.json',
        marker: 'commerce-multigrain-orders-markets',
      },
    ],
    evidence: [
      { taskId: 'T39', path: 'harness/evidence/t39/5fc97e0ce95e/manifest.json' },
      { taskId: 'T31', path: 'harness/evidence/t31/5e37b53-explicit-mcp/manifest.json' },
    ],
  },
  {
    id: 'S42',
    sources: [
      {
        path: 'tests/agent-evaluation/ui-development/host.test.ts',
        marker: 'keeps the committed region and read set unchanged while a fresh evaluation is prospective',
      },
    ],
    evidence: [{ taskId: 'T40', path: 'harness/evidence/t40/final-release-smoke/manifest.json' }],
  },
  {
    id: 'S43',
    sources: [
      {
        path: 'tests/runtime-regions/regions.test.ts',
        marker: 'checks host scope/policy/catalog/profile and the complete dependency read set',
      },
      {
        path: 'tests/runtime-results/lifecycle-regressions.test.ts',
        marker: 'does not accept evidence from a source revision outside the descriptor pins',
      },
    ],
    evidence: [{ taskId: 'T10', path: 'harness/evidence/t10/2524bf9a4d46/manifest.json' }],
  },
  {
    id: 'S45',
    sources: [
      { path: 'tests/agents/narrative/claims.test.ts', marker: 'rejects a mismatched %s' },
      { path: 'tests/agents/narrative/claims.test.ts', marker: 'does not turn cited prose into verified truth' },
    ],
    evidence: [{ taskId: 'T40', path: 'harness/evidence/t40/final-release-smoke/manifest.json' }],
  },
  {
    id: 'S46',
    sources: [
      {
        path: 'tests/agents/dispatch/composition.test.ts',
        marker: 'resolves the same graph, actual fields and descriptors as manual authoring',
      },
      { path: 'tests/agents/dispatch/composition.test.ts', marker: '<script>code</script>' },
    ],
    evidence: [{ taskId: 'T22', path: 'harness/evidence/t22/098d39bb5c19/manifest.json' }],
  },
  {
    id: 'S47',
    sources: [
      {
        path: 'tests/runtime-interaction/controller.test.ts',
        marker: 'uses a real local-data and ResultStore population for selection and filter state',
      },
      {
        path: 'tests/runtime-interaction/controller.test.ts',
        marker: 'preserves the committed draft and task layout on an entity revision conflict',
      },
    ],
    evidence: [{ taskId: 'T11', path: 'harness/evidence/t11/1fb2bf0b46df/manifest.json' }],
  },
  {
    id: 'S48',
    sources: [
      { path: 'tests/harness/test_r2.py', marker: 'test_sibling_prefix_not_ownership' },
      { path: 'tests/harness/test_r2.py', marker: 'test_acceptance_changes_invalidate' },
    ],
    evidence: [{ taskId: 'T01', path: 'harness/evidence/preflight/runtime.json' }],
  },
  {
    id: 'S49',
    sources: [
      {
        path: 'tests/contracts/presentation.test.ts',
        marker:
          'finishes a feasible first candidate within one expansion instead of spending the budget on preparation',
      },
      { path: 'tests/contracts/presentation.test.ts', marker: "status:'search-exhausted'" },
    ],
    evidence: [{ taskId: 'T19', path: 'harness/evidence/t19/291ba1f603ae/manifest.json' }],
  },
  {
    id: 'S50',
    sources: [
      {
        path: 'tests/vertical-slice/integration/hr-runtime.test.ts',
        marker: 'keeps a fixed cohort after a source revision while a live task recomputes membership',
      },
      {
        path: 'tests/runtime-evaluation/task-evaluator.test.ts',
        marker: 'executes a live-output dependency in topological order',
      },
    ],
    evidence: [{ taskId: 'T39', path: 'harness/evidence/t39/5fc97e0ce95e/manifest.json' }],
  },
  {
    id: 'S51',
    sources: [
      {
        path: 'tests/agents/dispatch/capabilities.test.ts',
        marker: 'does not turn result inspection into model egress',
      },
      { path: 'tests/security/adc-boundary.test.ts', marker: 'rechecks a principal-specific row policy' },
    ],
    evidence: [{ taskId: 'T28', path: 'harness/evidence/t28/54bb823-sourcebound/manifest.json' }],
  },
  {
    id: 'S53',
    sources: [
      {
        path: 'tests/agents/containment/binder.test.ts',
        marker: 'returns invalid for malformed, unknown-field, and unit-incompatible query plans',
      },
      { path: 'tests/contracts/presentation.test.ts', marker: '<script>bad</script>' },
    ],
    evidence: [{ taskId: 'T41', path: 'harness/evidence/t13-t41/d149adb10f03/manifest.json' }],
  },
  {
    id: 'S54',
    sources: [
      {
        path: 'tests/agents/containment/binder.test.ts',
        marker: 'binds a valid query while preserving valid-but-wrong meaning as residual risk',
      },
    ],
    evidence: [{ taskId: 'T40', path: 'harness/evidence/t40/final-release-smoke/manifest.json' }],
  },
  {
    id: 'S55',
    sources: [
      {
        path: 'tests/contracts/agent.test.ts',
        marker: 'recognizes independent grants and rejects authority presets or model labels',
      },
      {
        path: 'tests/agents/dispatch/capabilities.test.ts',
        marker: 'does not invoke a handler without its independent grant',
      },
    ],
    evidence: [{ taskId: 'T41', path: 'harness/evidence/t13-t41/d149adb10f03/manifest.json' }],
  },
  {
    id: 'S56',
    sources: [
      {
        path: 'tests/runtime-actions/actions.test.ts',
        marker: 'requires proposal and execution grants independently and derives actor from host context',
      },
      {
        path: 'tests/runtime-actions/actions.test.ts',
        marker: 'requires a trusted positive confirmation for required actions and rechecks after it',
      },
    ],
    evidence: [{ taskId: 'T41', path: 'harness/evidence/t13-t41/d149adb10f03/manifest.json' }],
  },
  {
    id: 'S57',
    sources: [
      {
        path: 'tests/agents/recovery/lifecycle.test.ts',
        marker: 'retains the actual incumbent and manual controls when the model is unavailable',
      },
      { path: 'tests/agents/containment/loop.test.ts', marker: 'stops repeated candidate fingerprints as no-progress' },
    ],
    evidence: [{ taskId: 'T41', path: 'harness/evidence/t13-t41/d149adb10f03/manifest.json' }],
  },
  {
    id: 'S58',
    sources: [
      {
        path: 'tests/security/revocation-materialization.test.ts',
        marker: 'clears result rows, dependent region state and evidence verification together',
      },
      {
        path: 'tests/runtime-presentation/adaptation.test.ts',
        marker: 'keeps revoked content cleared when a failed commit rolls back an applied renderer',
      },
    ],
    evidence: [{ taskId: 'T28', path: 'harness/evidence/t28/54bb823-sourcebound/manifest.json' }],
  },
  {
    id: 'S59',
    sources: [
      { path: 'tests/agents/narrative/claims.test.ts', marker: 'does not turn cited prose into verified truth' },
      { path: 'tests/visual/compound-interactions.spec.ts', marker: 'do not establish causal claims' },
    ],
    evidence: [{ taskId: 'T40', path: 'harness/evidence/t40/final-release-smoke/manifest.json' }],
  },
  {
    id: 'S64',
    sources: [
      { path: 'docs/39-discussion-ledger.md', marker: '| D38 |' },
      {
        path: 'tests/task-experience/experience.test.ts',
        marker: 'preserves bounded no-preset composition when there are no named patterns',
      },
    ],
    evidence: [{ taskId: 'T32', path: 'harness/evidence/t32/c5b33c1-independent-audit/manifest.json' }],
  },
  {
    id: 'S67',
    sources: [
      {
        path: 'tests/framework-consumers/framework-tarballs.mjs',
        marker: 'Manual meaning path coupled to model, Studio, chart, or layout',
      },
      {
        path: 'tests/meaning-authoring/dynamic-catalog.test.ts',
        marker: 'accepts schema-loaded field names while retaining literal-catalog typo checks',
      },
    ],
    evidence: [
      { taskId: 'T25', path: 'harness/evidence/t25/44fccb94ca19/manifest.json' },
      { taskId: 'T23', path: 'harness/evidence/t23/26f15f38f12a/manifest.json' },
    ],
  },
] as const;
