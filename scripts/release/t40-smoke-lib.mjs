const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function qualifyT40Smoke(report) {
  if (!object(report) || report.schemaVersion !== 1 || report.sourceChangedDuringRun !== false || report.mcpExplicit !== true) {
    throw new Error('T40 smoke report must be source-stable and include the actual MCP baseline');
  }
  const caseIds = report.corpus?.selection?.caseIds;
  const modelLabels = report.corpus?.selection?.modelLabels;
  if (!Array.isArray(caseIds) || caseIds.length < 3 || caseIds.length > 5 || new Set(caseIds).size !== caseIds.length) {
    throw new Error('T40 release smoke must select three to five distinct authorized cases');
  }
  if (!Array.isArray(modelLabels) || modelLabels.length !== 1 || modelLabels[0] !== 'weak') {
    throw new Error('T40 release smoke must select only the authorized Flash configuration');
  }
  if (!Array.isArray(report.rows)) throw new Error('T40 smoke rows are missing');
  const direct = report.rows.filter(row => row?.mode === 'explicit-task');
  const mcp = report.rows.filter(row => row?.mode === 'explicit-mcp');
  const live = report.rows.filter(row => row?.mode === 'governed-model-data');
  for (const [label, rows] of [['direct', direct], ['MCP', mcp]]) {
    if (rows.length !== caseIds.length || rows.some(row => row?.score?.dataCorrect !== true)) {
      throw new Error(`Every selected ${label} deterministic evaluation must match its oracle`);
    }
  }
  if (live.length < caseIds.length || live.some(row => row?.model !== 'deepseek-v4-flash'
    || row?.modelLabel !== 'weak' || row?.qualifiedModelSnapshot !== true || row?.status === 'provider-failed')) {
    throw new Error('Every live attempt must use a qualified DeepSeek V4 Flash snapshot');
  }
  const receipts = row => Array.isArray(row?.result?.receiptStates) ? row.result.receiptStates : [];
  const evaluated = live.filter(row => receipts(row).some(item => item?.operation === 'task.evaluate' && item?.state === 'data-ready'));
  const simpleQuery = evaluated.some(row => Array.isArray(row.observations)
    && row.observations.some(item => item?.stage === 'evaluate' && item?.rowCount > 0 && item?.diagnosticCodes?.length === 0));
  const repaired = live.some(row => {
    const states = receipts(row);
    const invalid = states.findIndex(item => item?.operation === 'task.evaluate' && item?.state === 'invalid');
    return invalid !== -1 && states.slice(invalid + 1).some(item => item?.operation === 'task.evaluate' && item?.state === 'data-ready');
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
      const invalid = states.findIndex(item => item?.operation === 'task.evaluate' && item?.state === 'invalid');
      return invalid !== -1 && states.slice(invalid + 1).some(item => item?.operation === 'task.evaluate' && item?.state === 'data-ready');
    }).length,
    textReadyMultiTurnAttempts: live.filter(row => row?.result?.ok === true && row.result.stop === 'text-ready' && row.result.turns >= 3 && row.result.toolCalls >= 2).length,
    usageEstimatedUSD,
    retainedProviderPayloads: 0,
  };
}
