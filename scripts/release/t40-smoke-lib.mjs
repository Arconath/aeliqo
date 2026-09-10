const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const AUTHORIZED_CORPUS_SHA256 = '9b2fd53f8f9e15fdef2afd121e48ba22bad591ffd8b1ded1e5b5517fae5cbfa8';
const FORBIDDEN_LIVE_KEYS = new Set(['prompt', 'content', 'reasoningcontent', 'toolarguments', 'headers', 'credential', 'secret', 'outputs', 'textdraft', 'providerbody']);
function assertSanitized(value) {
  if (Array.isArray(value)) { for (const item of value) assertSanitized(item); return; }
  if (!object(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_LIVE_KEYS.has(key.toLowerCase().replaceAll('_', ''))) throw new Error(`Live report retains forbidden provider field ${key}`);
    assertSanitized(nested);
  }
}
function assertExactCaseRows(rows, caseIds, label) {
  if (rows.length !== caseIds.length || rows.some(row => !caseIds.includes(row?.caseId))) {
    throw new Error(`Every selected ${label} evaluation must appear exactly once`);
  }
  if (new Set(rows.map(row => row.caseId)).size !== caseIds.length || rows.some(row => row?.score?.dataCorrect !== true)) {
    throw new Error(`Every selected ${label} deterministic evaluation must match its oracle`);
  }
}

export function qualifyT40Smoke(report) {
  if (!object(report) || report.schemaVersion !== 1 || report.sourceChangedDuringRun !== false || report.mcpExplicit !== true) {
    throw new Error('T40 smoke report must be source-stable and include the actual MCP baseline');
  }
  if (!/^[0-9a-f]{64}$/.test(report.sourceDigest ?? '')) throw new Error('T40 smoke report has an invalid source digest');
  if (!Array.isArray(report.blocks) || report.blocks.some(block => typeof block !== 'string'
    || /^(?:Spend reservation|Missing or non-authorized|Provider trial failed|Source changed)/.test(block))) {
    throw new Error('T40 smoke report contains a live qualification blocker');
  }
  const caseIds = report.corpus?.selection?.caseIds;
  const modelLabels = report.corpus?.selection?.modelLabels;
  if (!Array.isArray(caseIds) || caseIds.length < 3 || caseIds.length > 5 || new Set(caseIds).size !== caseIds.length) {
    throw new Error('T40 release smoke must select three to five distinct authorized cases');
  }
  if (!Array.isArray(modelLabels) || modelLabels.length !== 1 || modelLabels[0] !== 'weak') {
    throw new Error('T40 release smoke must select only the authorized Flash configuration');
  }
  if (report.corpus?.sha256 !== AUTHORIZED_CORPUS_SHA256
    || report.authorization?.authorizedCorpusSha256 !== AUTHORIZED_CORPUS_SHA256
    || !Array.isArray(report.corpus?.cases)
    || caseIds.some(caseId => !report.corpus.cases.some(item => item?.id === caseId))) {
    throw new Error('T40 release smoke must remain bound to the exact authorized held-out corpus');
  }
  if (!Number.isFinite(report.authorization?.maximumUSD) || report.authorization.maximumUSD <= 0) {
    throw new Error('T40 release smoke lacks an explicit positive owner-authorized spend ceiling');
  }
  if (!Array.isArray(report.rows)) throw new Error('T40 smoke rows are missing');
  const direct = report.rows.filter(row => row?.mode === 'explicit-task');
  const mcp = report.rows.filter(row => row?.mode === 'explicit-mcp');
  const live = report.rows.filter(row => row?.mode === 'governed-model-data');
  assertExactCaseRows(direct, caseIds, 'direct');
  assertExactCaseRows(mcp, caseIds, 'MCP');
  if (live.length < caseIds.length || new Set(live.map(row => row?.caseId)).size !== caseIds.length
    || live.some(row => !caseIds.includes(row?.caseId) || row?.model !== 'deepseek-v4-flash'
    || row?.modelLabel !== 'weak' || row?.qualifiedModelSnapshot !== true || row?.status === 'provider-failed'
    || !Array.isArray(row?.snapshots) || row.snapshots.length === 0
    || row.snapshots.some(snapshot => snapshot?.matchesExpected !== true || snapshot?.reportedModel !== 'deepseek-flash'))) {
    throw new Error('Every live attempt must use a qualified DeepSeek V4 Flash snapshot');
  }
  for (const row of live) assertSanitized(row);
  const reservedUSD = live.reduce((sum, row) => sum + (typeof row.reservedUSD === 'number' ? row.reservedUSD : Number.NaN), 0);
  if (!Number.isFinite(reservedUSD) || reservedUSD <= 0 || reservedUSD > report.authorization.maximumUSD) {
    throw new Error('Live smoke reservations exceed or do not bind the authorized spend ceiling');
  }
  const receipts = row => Array.isArray(row?.result?.receiptStates) ? row.result.receiptStates : [];
  for (const row of live) {
    const states = receipts(row);
    const catalog = states.findIndex(item => item?.operation === 'catalog.read' && item?.state === 'data-ready');
    const evaluate = states.findIndex(item => item?.operation === 'task.evaluate');
    if (evaluate !== -1 && (catalog === -1 || catalog > evaluate)) throw new Error('Live tool receipts violate the host-required operation order');
  }
  const evaluated = live.filter(row => receipts(row).some(item => item?.operation === 'task.evaluate' && item?.state === 'data-ready'));
  const simpleQuery = evaluated.some(row => Array.isArray(row.observations)
    && row.observations.some(item => item?.stage === 'evaluate' && item?.rowCount > 0 && item?.diagnosticCodes?.length === 0));
  const repaired = live.some(row => {
    const states = receipts(row);
    const catalog = states.findIndex(item => item?.operation === 'catalog.read' && item?.state === 'data-ready');
    const invalid = states.findIndex(item => item?.operation === 'task.evaluate' && item?.state === 'invalid');
    return catalog !== -1 && catalog < invalid && states.slice(invalid + 1).some(item => item?.operation === 'task.evaluate' && item?.state === 'data-ready');
  });
  const multiTurn = live.some(row => row?.result?.ok === true && row.result.stop === 'text-ready'
    && row.result.turns >= 3 && row.result.toolCalls >= 2);
  if (!simpleQuery) throw new Error('No live attempt completed a non-empty deterministic query');
  if (!repaired) throw new Error('No live attempt repaired an invalid evaluation request');
  if (!multiTurn) throw new Error('No live attempt completed the governed multi-turn tool flow');
  const usageEstimatedUSD = live.reduce((sum, row) => sum + (typeof row.usageEstimatedUSD === 'number' ? row.usageEstimatedUSD : 0), 0);
  return {
    schema: 'aeliqo.t40-release-smoke.v1',
    status: 'passed',
    sourceDigest: report.sourceDigest,
    corpusSha256: report.corpus?.sha256,
    selectedCaseIds: caseIds,
    configuredModel: 'deepseek-v4-flash',
    observedModel: 'deepseek-flash',
    attempts: live.length,
    qualifiedSnapshots: live.filter(row => row.qualifiedModelSnapshot === true).length,
    deterministicDirectCorrect: direct.length,
    deterministicMcpCorrect: mcp.length,
    dataReadyAttempts: evaluated.length,
    invalidThenDataReadyAttempts: live.filter(row => {
      const states = receipts(row);
      const catalog = states.findIndex(item => item?.operation === 'catalog.read' && item?.state === 'data-ready');
      const invalid = states.findIndex(item => item?.operation === 'task.evaluate' && item?.state === 'invalid');
      return catalog !== -1 && catalog < invalid && states.slice(invalid + 1).some(item => item?.operation === 'task.evaluate' && item?.state === 'data-ready');
    }).length,
    textReadyMultiTurnAttempts: live.filter(row => row?.result?.ok === true && row.result.stop === 'text-ready' && row.result.turns >= 3 && row.result.toolCalls >= 2).length,
    usageEstimatedUSD,
    retainedProviderPayloads: 0,
  };
}
