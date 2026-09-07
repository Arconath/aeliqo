"""Small independent model-failure contract experiment, NOT the Aeliqo SDK.

Inputs are already bounded Python fixtures. A production binder must implement schema,
semantic, source, auth and browser contracts; this demonstrates only the stated rules.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any, Mapping
import hashlib
import json

OPERATIONS = {'evaluate': 'task.evaluate', 'present': 'experience.commit',
              'activate': 'meaning.activate', 'execute': 'action.execute'}

@dataclass(frozen=True)
class Context:
    grants: frozenset[str] = frozenset({'task.evaluate', 'experience.commit'})
    metrics: frozenset[str] = frozenset({'absence_rate', 'unexcused_absence_rate'})
    views: frozenset[str] = frozenset({'Table', 'Trend', 'Ranking'})
    region_revision: int = 2
    policy_revision: int = 3
    candidates: tuple[str, ...] = ()
    confirmed_metric: str | None = None
    default_metric: str | None = None
    metric_definition_missing: bool = False
    result_has_time: bool = False
    material_ambiguity: bool = False
    confirmation_required: bool = True
    confirmation_valid: bool = False
    approved_scopes: frozenset[str] = frozenset({'session'})

@dataclass(frozen=True)
class Decision:
    status: str
    reason: str
    disclosures: tuple[str, ...] = ()
    semantic_truth_proven: bool = False


def inspect_proposal(proposal: Any, context: Context) -> Decision:
    """No effects. Model name/effort never appears in effective grants."""
    allowed = {'id', 'operation', 'metric', 'view', 'baseRevision', 'policyRevision', 'scope'}
    if type(proposal) is not dict or set(proposal) - allowed:
        return Decision('invalid', 'Malformed or authority-bearing payload')
    if not isinstance(proposal.get('id'), str) or not 1 <= len(proposal['id']) <= 100:
        return Decision('invalid', 'Request identity required')
    op = proposal.get('operation')
    if not isinstance(op, str) or op not in OPERATIONS:
        return Decision('invalid', 'Unknown operation')
    if OPERATIONS[op] not in context.grants:
        return Decision('denied', 'Operation not allowed')
    for key in ('baseRevision', 'policyRevision'):
        if type(proposal.get(key)) is not int or proposal[key] < 0:
            return Decision('invalid', 'Version required')
    if (proposal['baseRevision'] != context.region_revision or
            proposal['policyRevision'] != context.policy_revision):
        return Decision('stale', 'Context changed')
    metric = proposal.get('metric')
    if metric is not None and (not isinstance(metric, str) or metric not in context.metrics):
        return Decision('invalid', 'Unknown or unavailable metric reference')
    if context.metric_definition_missing:
        return Decision('needs-meaning', 'Define with AI or manually in authorized scope')
    if context.confirmed_metric is not None and metric != context.confirmed_metric:
        return Decision('invalid', 'Conflicts with confirmed user choice')
    disclosed: tuple[str, ...] = ()
    if context.material_ambiguity and len(set(context.candidates)) > 1 and context.confirmed_metric is None:
        if context.default_metric is None:
            return Decision('needs-choice', 'Interpretations materially differ')
        if metric != context.default_metric:
            return Decision('needs-choice', 'Not the documented default')
        disclosed = ('Using application default: ' + context.default_metric,)
    view = proposal.get('view')
    if view is not None and (not isinstance(view, str) or view not in context.views):
        return Decision('unsupported', 'No permitted registered realization')
    if view == 'Trend' and not context.result_has_time:
        return Decision('unsupported', 'No temporal result for Trend')
    if op == 'activate':
        if not isinstance(proposal.get('scope'), str):
            return Decision('invalid', 'Meaning scope must be a string')
        if proposal.get('scope') not in context.approved_scopes:
            return Decision('denied', 'Meaning scope not allowed')
    if op == 'execute' and context.confirmation_required and not context.confirmation_valid:
        return Decision('denied', 'Trusted confirmation required')
    return Decision('bound', 'Declared reference rules satisfied; intent may still be wrong', disclosed)


def numeric_claim_matches(claim_value: str, observed_value: str) -> bool:
    """Exact value match only. This does not check prose entailment or real-world truth."""
    if not isinstance(claim_value, str) or not isinstance(observed_value, str):
        return False
    if len(claim_value) > 100 or len(observed_value) > 100:
        return False
    try:
        a, b = Decimal(claim_value), Decimal(observed_value)
        return a.is_finite() and b.is_finite() and a == b
    except InvalidOperation:
        return False


def query_fingerprint(normalized_plan: Mapping[str, Any], scope: str, source_revision: str) -> str:
    """Caller is the trusted runtime; normalization itself is not implemented here."""
    encoded = json.dumps({'plan': normalized_plan, 'scope': scope, 'source': source_revision},
                         sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
    return hashlib.sha256(encoded).hexdigest()

@dataclass
class LoopBudget:
    max_turns: int = 6
    max_reads: int = 4
    max_repeats: int = 2
    turns: int = 0
    reads: int = 0
    seen: dict[str, int] = field(default_factory=dict)

    def observe(self, fingerprint: str, *, cancelled: bool = False) -> str:
        if cancelled:
            return 'cancelled'
        if self.turns >= self.max_turns:
            return 'turn-budget'
        self.turns += 1
        count = self.seen.get(fingerprint, 0) + 1
        self.seen[fingerprint] = count
        if count > self.max_repeats:
            return 'no-progress'
        if count > 1:
            return 'reuse'
        if self.reads >= self.max_reads:
            return 'read-budget'
        self.reads += 1
        return 'evaluate'
