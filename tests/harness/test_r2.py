"""Regression tests for Master consolidation harness gaps; not product/CI attestation."""
from __future__ import annotations
import copy,json,os,sys,tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts'))
from common import candidate_digest,dag_errors,load_json
from check_ownership import canonical_lease,ownership_errors
from gate import readiness_errors,command_errors,run_logged_command
from next_tasks import choose

class EvidenceFreshnessTests(unittest.TestCase):
    def changes(self,name,first,second):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp); f=p/name;f.parent.mkdir(parents=True,exist_ok=True);f.write_text(first);a=candidate_digest(p);f.write_text(second);return a!=candidate_digest(p)
    def test_design_changes_invalidate(self):self.assertTrue(self.changes('design/tokens.json','{"accent":1}','{"accent":2}'))
    def test_build_config_changes_invalidate(self):self.assertTrue(self.changes('vite.config.ts','one','two'))
    def test_root_schema_config_changes_invalidate(self):self.assertTrue(self.changes('tsconfig.build.json','{}','{"strict":true}'))
    def test_ci_workflow_changes_invalidate(self):self.assertTrue(self.changes('.github/workflows/check.yml','one','two'))
    def test_command_changes_invalidate(self):self.assertTrue(self.changes('harness/product-commands.json','{"commands":[]}','{"commands":[1]}'))
    def test_acceptance_changes_invalidate(self):self.assertTrue(self.changes('harness/tasks.json','{"tasks":[{"id":"T","acceptance":"a"}]}','{"tasks":[{"id":"T","acceptance":"b"}]}'))
    def test_ownership_changes_invalidate(self):self.assertTrue(self.changes('harness/tasks.json','{"tasks":[{"id":"T","paths":["a"]}]}','{"tasks":[{"id":"T","paths":["b"]}]}'))
    def test_status_does_not_create_circular_digest(self):self.assertFalse(self.changes('harness/tasks.json','{"tasks":[{"id":"T","status":"planned"}]}','{"tasks":[{"id":"T","status":"done","evidence":[1],"review":{"status":"approved"}}]}'))
    def test_actual_product_source_changes_invalidate(self):self.assertTrue(self.changes('packages/web/src/x.ts','one','two'))
    def test_normative_doc_changes_invalidate(self):self.assertTrue(self.changes('docs/06-presentation-compiler.md','one','two'))
    def test_review_evidence_not_part_of_own_subject(self):self.assertFalse(self.changes('docs/reviews/final.md','one','two'))
    def test_manifest_json_key_order_not_change_criteria(self):self.assertFalse(self.changes('harness/scenarios.json','{"scenarios":[{"id":"S","assertion":"a"}]}','{"scenarios":[{"assertion":"a","id":"S"}]}'))

class OwnershipAndTaskTests(unittest.TestCase):
    def test_real_src_path_matches(self):self.assertEqual(ownership_errors(ROOT,{'paths':['packages/core/src/query']},['packages/core/src/query/planner.ts']),[])
    def test_old_missing_src_lease_refused(self):
        with self.assertRaises(ValueError):canonical_lease('packages/core/query')
    def test_sibling_prefix_not_ownership(self):self.assertTrue(ownership_errors(ROOT,{'paths':['packages/core/src/query']},['packages/core/src/queryExtra/file.ts']))
    def test_absolute_traversal_refused(self):
        for p in ('/tmp/x','../x','a/../b','C:/x','.','a\\b'):
            with self.subTest(p=p),self.assertRaises(ValueError):canonical_lease(p)
    def test_symlink_escape_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'a').symlink_to('/tmp');self.assertTrue(ownership_errors(root,{'paths':['a']},['a/file']))
    def test_whole_package_explicit_lease_valid(self):self.assertEqual(canonical_lease('packages/web'),('packages','web'))
    def test_all_real_task_paths_canonical(self):
        for t in load_json(ROOT/'harness/tasks.json')['tasks']:
            for p in t['paths']:canonical_lease(p)
    def test_new_early_proof_before_large_catalog(self):
        d={t['id']:t for t in load_json(ROOT/'harness/tasks.json')['tasks']}
        for id in ('T13','T14','T15','T16','T17','T19'):self.assertIn('T39',d[id]['dependsOn'])
        self.assertNotIn('T40',d['T39']['dependsOn'])
    def test_new_dag_acyclic(self):self.assertEqual(dag_errors(load_json(ROOT/'harness/tasks.json')['tasks']),[])
    def test_scheduler_rejects_unsafe_paths(self):
        with self.assertRaises(ValueError):choose([{'id':'a','status':'planned','dependsOn':[],'paths':['../x']}],2)

class GateRegressionTests(unittest.TestCase):
    @unittest.skipUnless(os.name=='posix','process-group cleanup is a POSIX CI contract')
    def test_timeout_terminates_descendants(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);marker=root/'survived';log=root/'command.log'
            child="import sys,time;from pathlib import Path;time.sleep(1.5);Path(sys.argv[1]).write_text('survived')"
            parent="import subprocess,sys,time;subprocess.Popen([sys.executable,'-c',sys.argv[1],sys.argv[2]]);time.sleep(60)"
            with log.open('wb') as stream:
                self.assertEqual(run_logged_command([sys.executable,'-c',parent,child,str(marker)],root,stream,1),124)
            time.sleep(.75)
            self.assertFalse(marker.exists())
    def test_non_object_command_gracefully_refused(self):
        with patch('gate.load_json',return_value={'commands':[1,None,'true']}):errors,_=command_errors(ROOT)
        self.assertTrue(any('object' in x for x in errors))
    def test_unknown_kind_rejected(self):
        with patch('gate.load_json',return_value={'commands':[{'kind':'not-real','argv':['true']}]}):errors,_=command_errors(ROOT)
        self.assertIn('Unknown command kind',errors)
    def test_bool_timeout_refused(self):
        with patch('gate.load_json',return_value={'commands':[{'kind':'unit','argv':['true'],'timeoutSeconds':True}]}):errors,_=command_errors(ROOT)
        self.assertTrue(any('timeout' in x for x in errors))
    def test_shell_string_refused(self):
        with patch('gate.load_json',return_value={'commands':[{'kind':'unit','argv':'echo passed'}]}):errors,_=command_errors(ROOT)
        self.assertTrue(any('argv' in x for x in errors))
    def test_ready_excludes_release_only_scenario(self):
        errs=readiness_errors(ROOT,'ready');self.assertFalse(any(x.startswith('S52:') for x in errs))
    def test_release_includes_live_scenario(self):
        errs=readiness_errors(ROOT,'release');self.assertTrue(any(x.startswith('S52:') for x in errs))
    def test_release_excludes_explicitly_deferred_scenario(self):
        errs=readiness_errors(ROOT,'release');self.assertFalse(any(x.startswith('S28:') for x in errs))
    def test_native_scenario_required_when_advertised(self):
        def read(path):
            if path.name=='integrated.json':return {'webmcpNativeAdvertised':True,'claims':[]}
            return load_json(path)
        with patch('gate.load_json',side_effect=read):errs=readiness_errors(ROOT,'ready')
        self.assertTrue(any(x.startswith('S24:') for x in errs))
    def test_historical_evidence_never_satisfies_current_readiness(self):
        errs=readiness_errors(ROOT,'ready')
        for identifier in ('T27','S30','S31','S63'):
            self.assertIn(identifier+': historical evidence cannot satisfy current readiness',errs)
if __name__=='__main__':unittest.main()
