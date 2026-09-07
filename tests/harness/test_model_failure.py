"""Contract and adversarial fixtures; not a real-model evaluation."""
from __future__ import annotations
import sys, unittest
from dataclasses import replace
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
from ai_failure_reference import Context, inspect_proposal, numeric_claim_matches, query_fingerprint, LoopBudget

class ProposalFailureTests(unittest.TestCase):
    def setUp(self):
        self.ctx=Context()
        self.p={'id':'p1','operation':'evaluate','metric':'absence_rate','baseRevision':2,'policyRevision':3}
    def status(self, patch=None, context=None):
        return inspect_proposal(self.p | (patch or {}),context or self.ctx).status
    def test_valid_proposal_is_not_execution_or_truth(self):
        d=inspect_proposal(self.p,self.ctx);self.assertEqual(d.status,'bound');self.assertFalse(d.semantic_truth_proven)
    def test_unknown_metric_rejected(self):self.assertEqual(self.status({'metric':'laziness_score'}),'invalid')
    def test_unknown_view_refused(self):self.assertEqual(self.status({'view':'ThreeDimensionalGlass'}),'unsupported')
    def test_registered_but_incompatible_trend_refused(self):self.assertEqual(self.status({'view':'Trend'}),'unsupported')
    def test_compatible_trend_available(self):self.assertEqual(self.status({'view':'Trend'},replace(self.ctx,result_has_time=True)),'bound')
    def test_forged_human_refused(self):self.assertEqual(self.status({'actor':'human'}),'invalid')
    def test_forged_approval_refused(self):self.assertEqual(self.status({'approved':True}),'invalid')
    def test_high_model_name_cannot_grant_privilege(self):self.assertEqual(self.status({'model':'best-model','operation':'execute'}),'invalid')
    def test_observe_does_not_imply_evaluate(self):self.assertEqual(self.status(context=replace(self.ctx,grants=frozenset({'catalog.read'}))),'denied')
    def test_compose_commit_does_not_imply_action(self):self.assertEqual(self.status({'operation':'execute'}),'denied')
    def test_action_grant_without_confirmation_refused(self):self.assertEqual(self.status({'operation':'execute'},replace(self.ctx,grants=frozenset({'action.execute'}))),'denied')
    def test_action_requires_separate_grant_and_context_confirmation(self):self.assertEqual(self.status({'operation':'execute'},replace(self.ctx,grants=frozenset({'action.execute'}),confirmation_valid=True)),'bound')
    def test_stale_task_cannot_win(self):self.assertEqual(self.status({'baseRevision':1}),'stale')
    def test_policy_change_invalidates(self):self.assertEqual(self.status({'policyRevision':2}),'stale')
    def test_boolean_revision_is_not_integer(self):self.assertEqual(self.status({'baseRevision':True}),'invalid')
    def test_material_ambiguity_requests_choice(self):self.assertEqual(self.status(context=replace(self.ctx,candidates=('absence_rate','unexcused_absence_rate'),material_ambiguity=True)),'needs-choice')
    def test_model_selection_is_not_human_confirmation(self):self.assertEqual(self.status({'confirmed':True}),'invalid')
    def test_human_confirmed_choice_enforced(self):self.assertEqual(self.status(context=replace(self.ctx,confirmed_metric='unexcused_absence_rate')),'invalid')
    def test_known_default_is_disclosed(self):
        c=replace(self.ctx,candidates=tuple(self.ctx.metrics),material_ambiguity=True,default_metric='absence_rate')
        d=inspect_proposal(self.p,c);self.assertEqual(d.status,'bound');self.assertTrue(d.disclosures)
    def test_different_from_known_default_requires_choice(self):
        c=replace(self.ctx,candidates=tuple(self.ctx.metrics),material_ambiguity=True,default_metric='unexcused_absence_rate')
        self.assertEqual(self.status(context=c),'needs-choice')
    def test_missing_definition_needs_meaning(self):self.assertEqual(self.status(context=replace(self.ctx,metric_definition_missing=True)),'needs-meaning')
    def test_session_activation_not_organization_grant(self):self.assertEqual(self.status({'operation':'activate','scope':'organization'},replace(self.ctx,grants=frozenset({'meaning.activate'}))),'denied')
    def test_invalid_scope_does_not_throw(self):self.assertEqual(self.status({'operation':'activate','scope':[]},replace(self.ctx,grants=frozenset({'meaning.activate'}))),'invalid')
    def test_session_activation_allowed(self):self.assertEqual(self.status({'operation':'activate','scope':'session'},replace(self.ctx,grants=frozenset({'meaning.activate'}))),'bound')
    def test_valid_but_wrong_intent_is_residual_risk(self):
        # A known catalog ID can be wrong for unexpressed user meaning. No oracle is invented.
        d=inspect_proposal(self.p,self.ctx);self.assertEqual(d.status,'bound');self.assertFalse(d.semantic_truth_proven)
    def test_model_confidence_is_not_authority(self):self.assertEqual(self.status({'confidence':.999}),'invalid')
    def test_raw_sql_rejected(self):self.assertEqual(self.status({'sql':'select * from employees'}),'invalid')
    def test_raw_jsx_rejected(self):self.assertEqual(self.status({'jsx':'<div />'}),'invalid')
    def test_invalid_shape_returns_diagnostic(self):self.assertEqual(inspect_proposal(['x'],self.ctx).status,'invalid')
    def test_invalid_operation_returns_diagnostic(self):self.assertEqual(self.status({'operation':[]}),'invalid')
    def test_unknown_action_does_not_execute(self):self.assertEqual(self.status({'operation':'delete_everything'}),'invalid')

class GroundingAndLoopTests(unittest.TestCase):
    def test_exact_decimal_claim(self):self.assertTrue(numeric_claim_matches('0.10','0.1'))
    def test_wrong_claim_rejected(self):self.assertFalse(numeric_claim_matches('18','13'))
    def test_nan_never_exact(self):self.assertFalse(numeric_claim_matches('NaN','NaN'))
    def test_infinite_never_exact(self):self.assertFalse(numeric_claim_matches('Infinity','Infinity'))
    def test_non_numeric_prose_not_verified(self):self.assertFalse(numeric_claim_matches('Everyone got worse','0.2'))
    def test_identical_query_same_version_reuses(self):
        b=LoopBudget();self.assertEqual(b.observe('a'),'evaluate');self.assertEqual(b.observe('a'),'reuse');self.assertEqual(b.reads,1)
    def test_same_query_without_progress_stops(self):
        b=LoopBudget();b.observe('a');b.observe('a');self.assertEqual(b.observe('a'),'no-progress')
    def test_read_budget_stops_new_scans(self):
        b=LoopBudget(max_reads=1);b.observe('a');self.assertEqual(b.observe('b'),'read-budget')
    def test_turn_budget_stops(self):
        b=LoopBudget(max_turns=1);b.observe('a');self.assertEqual(b.observe('b'),'turn-budget')
    def test_cancel_does_not_spend_more(self):
        b=LoopBudget();self.assertEqual(b.observe('a',cancelled=True),'cancelled');self.assertEqual(b.reads,0)
    def test_source_change_is_new_fingerprint(self):self.assertNotEqual(query_fingerprint({'group':'team'},'p1','r1'),query_fingerprint({'group':'team'},'p1','r2'))
    def test_principal_scope_is_partitioned(self):self.assertNotEqual(query_fingerprint({'group':'team'},'p1','r1'),query_fingerprint({'group':'team'},'p2','r1'))
    def test_normalized_key_order_same(self):self.assertEqual(query_fingerprint({'a':1,'b':2},'p','r'),query_fingerprint({'b':2,'a':1},'p','r'))
    def test_nonfinite_plan_rejected(self):
        with self.assertRaises(ValueError):query_fingerprint({'x':float('nan')},'p','r')
if __name__=='__main__':unittest.main()
