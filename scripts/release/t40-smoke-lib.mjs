import {createHash} from 'node:crypto';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hex64 = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
const finite = (value, minimum = 0) => typeof value === 'number' && Number.isFinite(value) && value >= minimum;
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sha256 = value => createHash('sha256').update(value).digest('hex');

export const T40_OBSOLETE_SCOPE_BLOCK = 'This data-only runner does not establish full T40: UI completion, narrative review, fixed-template ablation, external MCP-host reasoning trials, and independently accepted held-out coverage remain separate requirements.';

function exactKeys(value, keys, label) {
  if (!object(value) || !same(Object.keys(value).sort(), [...keys].sort())) {
    throw new Error(`${label} does not match the closed evidence schema`);
  }
}

function exactOptionalKeys(value, required, optional, label) {
  if (!object(value)) throw new Error(`${label} does not match the closed evidence schema`);
  const present = Object.keys(value);
  if (required.some(key => !present.includes(key)) || present.some(key => !required.includes(key) && !optional.includes(key))) {
    throw new Error(`${label} does not match the closed evidence schema`);
  }
}

function assertScore(value, label, requireCorrect = false) {
  if (!object(value)) throw new Error(`${label} is missing`);
  if (same(Object.keys(value).sort(), ['dataCorrect'])) {
    if (typeof value.dataCorrect !== 'boolean' || requireCorrect) throw new Error(`${label} deterministic evaluation must match its oracle`);
    return;
  }
  exactKeys(value, ['dataCorrect', 'findings', 'uiTaskCompletion', 'narrativeGrounding'], label);
  if (typeof value.dataCorrect !== 'boolean' || !Array.isArray(value.findings) || !value.findings.every(item => typeof item === 'string')
    || value.uiTaskCompletion !== null || value.narrativeGrounding !== null || (requireCorrect && (value.dataCorrect !== true || value.findings.length !== 0))) {
    throw new Error(`${label} deterministic evaluation must match its oracle`);
  }
}

function assertModelConfig(value) {
  exactKeys(value, ['label', 'protocol', 'baseURL', 'model', 'expectedReportedModel', 'credentialEnvironment', 'auth', 'capabilities', 'inputUSDPerMillion', 'outputUSDPerMillion', 'priceSource'], 'Model configuration');
  if (!['weak', 'strong'].includes(value.label) || value.protocol !== 'openai-compatible-chat'
    || typeof value.baseURL !== 'string' || typeof value.model !== 'string' || typeof value.expectedReportedModel !== 'string'
    || typeof value.credentialEnvironment !== 'string' || !/^AELIQO_EVAL_[A-Z0-9_]{1,80}$/.test(value.credentialEnvironment)
    || !Array.isArray(value.capabilities) || value.capabilities.length === 0 || new Set(value.capabilities).size !== value.capabilities.length
    || !value.capabilities.every(item => ['tool-calls', 'usage', 'request-cancellation', 'input-token-estimate', 'request-retry'].includes(item))
    || !value.capabilities.includes('tool-calls') || !finite(value.inputUSDPerMillion, Number.MIN_VALUE)
    || !finite(value.outputUSDPerMillion, Number.MIN_VALUE) || typeof value.priceSource !== 'string' || value.priceSource.length === 0) {
    throw new Error('Model configuration is invalid');
  }
  let url;
  try { url = new URL(value.baseURL); } catch { throw new Error('Model configuration is invalid'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Model configuration is invalid');
  if (!object(value.auth) || !['bearer', 'header'].includes(value.auth.scheme)) throw new Error('Model configuration is invalid');
  if (value.auth.scheme === 'bearer') exactKeys(value.auth, ['scheme'], 'Model authentication configuration');
  else {
    exactKeys(value.auth, ['scheme', 'headerName'], 'Model authentication configuration');
    if (typeof value.auth.headerName !== 'string' || !/^[-A-Za-z0-9]+$/.test(value.auth.headerName)) throw new Error('Model configuration is invalid');
  }
}

function assertConfig(config, corpusSha256) {
  exactKeys(config, ['version', 'authorized', 'authorizationReference', 'authorizedCorpusSha256', 'maxUSD', 'trials', 'models', 'budget'], 'T40 configuration');
  if (config.version !== '1' || config.authorized !== true || typeof config.authorizationReference !== 'string'
    || config.authorizationReference.length === 0 || config.authorizedCorpusSha256 !== corpusSha256
    || !finite(config.maxUSD, Number.MIN_VALUE) || !integer(config.trials, 1) || config.trials > 20
    || !Array.isArray(config.models) || config.models.length !== 2) throw new Error('T40 configuration is not owner-authorized for the supplied corpus');
  config.models.forEach(assertModelConfig);
  if (new Set(config.models.map(model => model.label)).size !== 2) throw new Error('T40 configuration must contain distinct weak and strong models');
  const weak = config.models.find(model => model.label === 'weak');
  if (!weak || weak.model !== 'deepseek-v4-flash' || weak.expectedReportedModel !== 'deepseek-flash'
    || new URL(weak.baseURL).origin !== 'https://api.deepseek.com' || weak.auth.scheme !== 'bearer') {
    throw new Error('T40 release smoke must use the authorized DeepSeek V4 Flash configuration');
  }
  const budgetKeys = ['maxTurns', 'maxModelRequests', 'maxToolCalls', 'maxMilliseconds', 'maxInputTokens', 'maxOutputTokens', 'maxTotalTokens', 'maxInputBytes', 'maxOutputBytes', 'maxRepeatedCalls'];
  exactKeys(config.budget, budgetKeys, 'T40 model budget');
  if (budgetKeys.some(key => !integer(config.budget[key], 1))) throw new Error('T40 model budget is invalid');
  return weak;
}

function assertCorpusCases(reportCases, suppliedCases) {
  if (!Array.isArray(reportCases) || !Array.isArray(suppliedCases) || reportCases.length !== suppliedCases.length) {
    throw new Error('T40 report corpus inventory differs from the supplied corpus');
  }
  for (let index = 0; index < reportCases.length; index++) {
    const reported = reportCases[index];
    const supplied = suppliedCases[index];
    exactKeys(reported, ['id', 'partition', 'independentAuthor', 'exposure'], 'Corpus case metadata');
    if (!object(supplied) || !same(reported, {id: supplied.id, partition: supplied.partition, independentAuthor: supplied.independentAuthor, exposure: supplied.exposure})) {
      throw new Error('T40 report corpus inventory differs from the supplied corpus');
    }
  }
}

function assertDeterministicRow(row, caseId, mode) {
  const direct = mode === 'explicit-task';
  exactKeys(row, direct
    ? ['caseId', 'partition', 'mode', 'model', 'elapsedMs', 'score', 'observations']
    : ['caseId', 'partition', 'mode', 'model', 'score', 'observation', 'outputs'], `${mode} row`);
  if (row.caseId !== caseId || row.partition !== 'heldout' || row.mode !== mode || row.model !== null) {
    throw new Error(`Every selected ${mode} evaluation must appear exactly once`);
  }
  assertScore(row.score, `${mode} score`, true);
  if (direct) {
    if (!finite(row.elapsedMs) || !Array.isArray(row.observations) || row.observations.length === 0) throw new Error('Direct deterministic evidence is incomplete');
    return;
  }
  if (!Array.isArray(row.outputs) || row.outputs.length === 0) throw new Error('MCP deterministic evidence must contain non-empty validated outputs');
  const observation = row.observation;
  exactKeys(observation, ['transport', 'protocolPin', 'server', 'node', 'discoveredTools', 'toolSchemaSha256', 'receiptState', 'callElapsedMs', 'elapsedMs', 'transportDetached', 'childPid', 'childExited', 'cleanupSucceeded', 'stderrBytes', 'modelExecution', 'fixtureProjection', 'limits'], 'MCP observation');
  exactKeys(observation.server, ['name', 'version'], 'MCP server identity');
  if (observation.transport !== 'official-sdk-stdio' || observation.protocolPin !== '2026-07-28'
    || observation.server.name !== 'aeliqo-evaluation-baseline' || observation.server.version !== '0.1.0'
    || observation.node !== 'v24.20.0' || !same(observation.discoveredTools, ['read_catalog', 'evaluate_task'])
    || !hex64(observation.toolSchemaSha256) || observation.receiptState !== 'data-ready'
    || !finite(observation.callElapsedMs) || !finite(observation.elapsedMs) || observation.transportDetached !== true
    || !integer(observation.childPid, 1) || observation.childExited !== true || observation.cleanupSucceeded !== true
    || observation.stderrBytes !== 0 || observation.modelExecution !== 'No model adapter is configured.'
    || typeof observation.fixtureProjection !== 'string' || observation.fixtureProjection.length === 0
    || !Array.isArray(observation.limits) || observation.limits.length === 0 || !observation.limits.every(item => typeof item === 'string')) {
    throw new Error('MCP deterministic evidence lacks the required actual transport observation');
  }
}

function assertLiveRow(row, caseId, trial, weak, budget) {
  exactKeys(row, ['caseId', 'partition', 'mode', 'model', 'modelLabel', 'qualifiedModelSnapshot', 'connection', 'snapshots', 'trial', 'elapsedMs', 'reservedUSD', 'firstAttempt', 'score', 'result', 'observations', 'uiTaskCompletion', 'narrativeGrounding', 'chargedUSD', 'usageEstimatedUSD', 'priceSource'], 'Live row');
  if (row.caseId !== caseId || row.partition !== 'heldout' || row.mode !== 'governed-model-data'
    || row.model !== weak.model || row.modelLabel !== 'weak' || row.qualifiedModelSnapshot !== true || row.trial !== trial
    || !finite(row.elapsedMs) || row.elapsedMs > budget.maxMilliseconds || row.uiTaskCompletion !== null
    || row.narrativeGrounding !== null || row.chargedUSD !== null || row.priceSource !== weak.priceSource) {
    throw new Error('Every live attempt must use the configured held-out DeepSeek V4 Flash trial');
  }
  exactKeys(row.connection, ['protocol', 'origin', 'authScheme', 'capabilities'], 'Live connection');
  if (row.connection.protocol !== weak.protocol || row.connection.origin !== new URL(weak.baseURL).origin
    || row.connection.authScheme !== weak.auth.scheme || !same(row.connection.capabilities, weak.capabilities)) {
    throw new Error('Live connection differs from the authorized model configuration');
  }
  if (!Array.isArray(row.snapshots) || row.snapshots.length === 0) throw new Error('Live attempt lacks a qualified provider snapshot');
  for (const snapshot of row.snapshots) {
    exactKeys(snapshot, ['reportedModel', 'reportedModelSha256', 'matchesExpected', 'responseIdSha256'], 'Live provider snapshot');
    if (snapshot.reportedModel !== weak.expectedReportedModel || snapshot.reportedModelSha256 !== sha256(weak.expectedReportedModel)
      || snapshot.matchesExpected !== true || !hex64(snapshot.responseIdSha256)) throw new Error('Live attempt lacks a qualified provider snapshot');
  }
  assertScore(row.firstAttempt, 'Live first-attempt score');
  assertScore(row.score, 'Live final score');
  exactOptionalKeys(row.result, ['ok', 'stop', 'turns', 'modelRequests', 'toolCalls', 'inputTokens', 'outputTokens', 'receiptStates'], ['incompleteRequiredOperations'], 'Live result');
  const result = row.result;
  const stops = ['text-ready', 'renderer-ready', 'no-commit', 'no-progress', 'required-sequence', 'budget', 'cancelled', 'stale', 'denied', 'failed'];
  if (result.ok !== true || !stops.includes(result.stop) || !integer(result.turns, 1) || result.turns > budget.maxTurns
    || !integer(result.modelRequests, 1) || result.modelRequests > budget.maxModelRequests || result.modelRequests > result.turns
    || !integer(result.toolCalls) || result.toolCalls > budget.maxToolCalls
    || !integer(result.inputTokens) || result.inputTokens > budget.maxInputTokens * result.modelRequests
    || !integer(result.outputTokens) || result.outputTokens > budget.maxOutputTokens * result.turns
    || result.inputTokens + result.outputTokens > budget.maxTotalTokens
    || row.snapshots.length !== result.modelRequests || !Array.isArray(result.receiptStates) || result.receiptStates.length !== result.toolCalls) {
    throw new Error('Live attempt counters exceed or do not bind the configured budget');
  }
  if (Object.hasOwn(result, 'incompleteRequiredOperations')
    && (!Array.isArray(result.incompleteRequiredOperations) || !result.incompleteRequiredOperations.every(item => ['catalog.read', 'task.evaluate'].includes(item)))) {
    throw new Error('Live result has invalid incomplete-operation evidence');
  }
  for (const receipt of result.receiptStates) {
    exactKeys(receipt, ['operation', 'state'], 'Live receipt');
    if (!['catalog.read', 'task.evaluate'].includes(receipt.operation)
      || !['accepted', 'bound', 'data-ready', 'plan-committed', 'renderer-ready', 'partial', 'cancelled', 'failed', 'denied', 'stale', 'unsupported', 'invalid', 'needs-choice', 'needs-meaning'].includes(receipt.state)) {
      throw new Error('Live receipt contains an unsupported operation or state');
    }
  }
  if (!Array.isArray(row.observations)) throw new Error('Live evaluation observations are missing');
  for (const observation of row.observations) {
    exactKeys(observation, ['stage', 'elapsedMs', 'outputCount', 'rowCount', 'diagnosticCodes'], 'Live evaluation observation');
    if (observation.stage !== 'evaluate' || !finite(observation.elapsedMs) || !integer(observation.outputCount)
      || !integer(observation.rowCount) || !Array.isArray(observation.diagnosticCodes)
      || !observation.diagnosticCodes.every(item => typeof item === 'string' && item.length > 0)) {
      throw new Error('Live evaluation observation is invalid');
    }
  }
  const evaluationReceipts = result.receiptStates.filter(receipt => receipt.operation === 'task.evaluate');
  if (evaluationReceipts.length !== row.observations.length) throw new Error('Live evaluation receipts and observations do not correspond');
  const firstEvaluate = result.receiptStates.findIndex(receipt => receipt.operation === 'task.evaluate');
  const catalog = result.receiptStates.findIndex(receipt => receipt.operation === 'catalog.read' && receipt.state === 'data-ready');
  if (catalog === -1 || (firstEvaluate !== -1 && catalog > firstEvaluate)) throw new Error('Live tool receipts violate the host-required operation order');
  const expectedReservation = (budget.maxModelRequests * budget.maxInputTokens * weak.inputUSDPerMillion
    + budget.maxTurns * budget.maxOutputTokens * weak.outputUSDPerMillion) / 1_000_000;
  if (!finite(row.reservedUSD, Number.MIN_VALUE) || Math.abs(row.reservedUSD - expectedReservation) > 1e-12
    || !finite(row.usageEstimatedUSD) || row.usageEstimatedUSD > row.reservedUSD + 1e-12) {
    throw new Error('Live attempt usage or reservation does not bind the configured spend budget');
  }
  const expectedUsage = (result.inputTokens * weak.inputUSDPerMillion + result.outputTokens * weak.outputUSDPerMillion) / 1_000_000;
  if (Math.abs(row.usageEstimatedUSD - expectedUsage) > 1e-12) throw new Error('Live usage estimate does not match sanitized token counters');
}

function assertGroups(groups, live) {
  if (!Array.isArray(groups) || groups.length !== 2) throw new Error('T40 report model groups are invalid');
  const scoreCorrect = live.filter(row => row.score.dataCorrect === true).length;
  for (const [index, label] of ['weak', 'strong'].entries()) {
    const group = groups[index];
    exactKeys(group, ['label', 'attemptedTrials', 'unqualifiedTrials', 'trials', 'dataCorrect', 'interval', 'uiTaskCompletion', 'narrativeGrounding'], 'T40 model group');
    const count = label === 'weak' ? live.length : 0;
    if (group.label !== label || group.attemptedTrials !== count || group.unqualifiedTrials !== 0 || group.trials !== count
      || group.dataCorrect !== (label === 'weak' ? scoreCorrect : 0) || group.uiTaskCompletion !== null || group.narrativeGrounding !== null) {
      throw new Error('T40 report model groups do not match the selected trials');
    }
    if (label === 'strong' && group.interval !== null) throw new Error('T40 report model groups do not match the selected trials');
    if (label === 'weak') {
      exactKeys(group.interval, ['lower', 'upper', 'confidence', 'trials'], 'T40 model interval');
      if (!finite(group.interval.lower) || !finite(group.interval.upper) || group.interval.lower > group.interval.upper
        || group.interval.confidence !== 0.95 || group.interval.trials !== count) throw new Error('T40 report model groups do not match the selected trials');
    }
  }
}

export function qualifyT40Smoke(report, context) {
  exactKeys(context, ['currentSourceDigest', 'corpusSha256', 'corpusPath', 'corpusCases', 'config'], 'T40 qualification context');
  if (!hex64(context.currentSourceDigest) || !hex64(context.corpusSha256) || typeof context.corpusPath !== 'string') {
    throw new Error('T40 qualification context is invalid');
  }
  const weak = assertConfig(context.config, context.corpusSha256);
  exactKeys(report, ['schemaVersion', 'status', 'mcpExplicit', 'sourceDigest', 'sourceChangedDuringRun', 'corpus', 'authorization', 'groups', 'blocks', 'rows'], 'T40 report');
  if (report.schemaVersion !== 1 || report.status !== 'blocked' || report.sourceChangedDuringRun !== false || report.mcpExplicit !== true
    || report.sourceDigest !== context.currentSourceDigest) {
    throw new Error('T40 smoke report must match the current source and include the actual MCP baseline');
  }
  if (!same(report.blocks, [T40_OBSOLETE_SCOPE_BLOCK])) throw new Error('T40 smoke report contains a live qualification blocker or an unknown scope claim');
  exactKeys(report.authorization, ['reference', 'maximumUSD', 'authorizedCorpusSha256'], 'T40 authorization');
  if (report.authorization.reference !== context.config.authorizationReference
    || report.authorization.maximumUSD !== context.config.maxUSD
    || report.authorization.authorizedCorpusSha256 !== context.corpusSha256) throw new Error('T40 report authorization differs from the supplied configuration');
  exactKeys(report.corpus, ['path', 'sha256', 'cases', 'selection'], 'T40 corpus');
  if (report.corpus.path !== context.corpusPath || report.corpus.sha256 !== context.corpusSha256) throw new Error('T40 report does not match the supplied corpus bytes');
  assertCorpusCases(report.corpus.cases, context.corpusCases);
  exactKeys(report.corpus.selection, ['caseIds', 'modelLabels'], 'T40 corpus selection');
  const caseIds = report.corpus.selection.caseIds;
  if (!Array.isArray(caseIds) || caseIds.length < 3 || caseIds.length > 5 || new Set(caseIds).size !== caseIds.length
    || !same(report.corpus.selection.modelLabels, ['weak'])) throw new Error('T40 release smoke must select three to five distinct cases and only the weak model');
  const suppliedById = new Map(context.corpusCases.map(item => [item?.id, item]));
  if (caseIds.some(caseId => typeof caseId !== 'string' || suppliedById.get(caseId)?.partition !== 'heldout')) {
    throw new Error('T40 release smoke selection must exist in the supplied held-out corpus');
  }
  if (!Array.isArray(report.rows)) throw new Error('T40 smoke rows are missing');
  const direct = report.rows.filter(row => row?.mode === 'explicit-task');
  const mcp = report.rows.filter(row => row?.mode === 'explicit-mcp');
  const live = report.rows.filter(row => row?.mode === 'governed-model-data');
  if (report.rows.some(row => !object(row) || !['explicit-task', 'explicit-mcp', 'governed-model-data'].includes(row.mode))
    || direct.length !== caseIds.length || mcp.length !== caseIds.length || live.length !== caseIds.length * context.config.trials) {
    throw new Error('T40 report contains unknown or incomplete row modes');
  }
  for (const caseId of caseIds) {
    const directRows = direct.filter(row => row.caseId === caseId);
    const mcpRows = mcp.filter(row => row.caseId === caseId);
    if (directRows.length !== 1 || mcpRows.length !== 1) throw new Error('Every selected deterministic evaluation must appear exactly once');
    assertDeterministicRow(directRows[0], caseId, 'explicit-task');
    assertDeterministicRow(mcpRows[0], caseId, 'explicit-mcp');
  }
  for (const caseId of caseIds) for (let trial = 1; trial <= context.config.trials; trial++) {
    const matches = live.filter(row => row.caseId === caseId && row.trial === trial);
    if (matches.length !== 1) throw new Error('Every selected case must contain one contiguous configured set of live trials');
    assertLiveRow(matches[0], caseId, trial, weak, context.config.budget);
  }
  assertGroups(report.groups, live);
  const reservedUSD = live.reduce((sum, row) => sum + row.reservedUSD, 0);
  const usageEstimatedUSD = live.reduce((sum, row) => sum + row.usageEstimatedUSD, 0);
  if (!finite(reservedUSD, Number.MIN_VALUE) || reservedUSD > context.config.maxUSD + 1e-12
    || !finite(usageEstimatedUSD) || usageEstimatedUSD > reservedUSD + 1e-12) {
    throw new Error('Live smoke reservations exceed the authorized spend ceiling');
  }
  const evaluated = live.filter(row => row.result.receiptStates.some(receipt => receipt.operation === 'task.evaluate' && receipt.state === 'data-ready'));
  const simpleQuery = evaluated.some(row => {
    const receipts = row.result.receiptStates.filter(receipt => receipt.operation === 'task.evaluate');
    return receipts.some((receipt, index) => receipt.state === 'data-ready' && row.observations[index]?.rowCount > 0 && row.observations[index]?.diagnosticCodes.length === 0);
  });
  const repaired = live.some(row => {
    const receipts = row.result.receiptStates.filter(receipt => receipt.operation === 'task.evaluate');
    const invalid = receipts.findIndex((receipt, index) => receipt.state === 'invalid' && row.observations[index]?.diagnosticCodes.length > 0);
    return invalid !== -1 && receipts.slice(invalid + 1).some((receipt, relativeIndex) => {
      const observation = row.observations[invalid + 1 + relativeIndex];
      return receipt.state === 'data-ready' && observation?.rowCount > 0 && observation?.diagnosticCodes.length === 0;
    });
  });
  const multiTurn = live.some(row => row.result.stop === 'text-ready' && row.result.turns >= 3 && row.result.toolCalls >= 2
    && !Object.hasOwn(row.result, 'incompleteRequiredOperations')
    && row.result.receiptStates.filter(receipt => receipt.operation === 'task.evaluate').some((receipt, index) => receipt.state === 'data-ready'
      && row.observations[index]?.rowCount > 0 && row.observations[index]?.diagnosticCodes.length === 0));
  if (!simpleQuery) throw new Error('No live attempt completed a non-empty deterministic query');
  if (!repaired) throw new Error('No live attempt proved an invalid request and diagnostic-backed repair');
  if (!multiTurn) throw new Error('No live attempt completed the governed multi-turn tool flow without incomplete operations');
  return {
    schema: 'aeliqo.t40-release-smoke.v1', status: 'passed', sourceDigest: report.sourceDigest,
    corpusSha256: report.corpus.sha256, selectedCaseIds: caseIds, configuredModel: weak.model,
    observedModel: weak.expectedReportedModel, attempts: live.length, configuredTrialsPerCase: context.config.trials,
    qualifiedSnapshots: live.reduce((sum, row) => sum + row.snapshots.length, 0),
    deterministicDirectCorrect: direct.length, deterministicMcpCorrect: mcp.length, dataReadyAttempts: evaluated.length,
    invalidThenDataReadyAttempts: live.filter(row => {
      const receipts = row.result.receiptStates.filter(receipt => receipt.operation === 'task.evaluate');
      const invalid = receipts.findIndex((receipt, index) => receipt.state === 'invalid' && row.observations[index]?.diagnosticCodes.length > 0);
      return invalid !== -1 && receipts.slice(invalid + 1).some((receipt, offset) => receipt.state === 'data-ready'
        && row.observations[invalid + 1 + offset]?.rowCount > 0 && row.observations[invalid + 1 + offset]?.diagnosticCodes.length === 0);
    }).length,
    textReadyMultiTurnAttempts: live.filter(row => row.result.stop === 'text-ready' && row.result.turns >= 3
      && row.result.toolCalls >= 2 && !Object.hasOwn(row.result, 'incompleteRequiredOperations')
      && row.result.receiptStates.filter(receipt => receipt.operation === 'task.evaluate').some((receipt, index) => receipt.state === 'data-ready'
        && row.observations[index]?.rowCount > 0 && row.observations[index]?.diagnosticCodes.length === 0)).length,
    reservedUSD, usageEstimatedUSD, retainedProviderPayloads: 0,
  };
}
