"""Master/version boundaries; inventory is synthetic, not a current registry check."""
from __future__ import annotations
import json,re,sys,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts'))
from version_preflight import inspect_inventory
from common import candidate_digest,load_json
class VersionResetTests(unittest.TestCase):
    def setUp(self):self.x={'target':'0.1.0','registryRead':'verified','namespaceAuthorized':True,'targetEverPublished':False,'publishedStableVersions':[],'stagingTag':'next'}
    def check(self,patch):return inspect_inventory(self.x|patch)
    def test_valid_inventory_not_ready_to_publish(self):
        r=self.check({});self.assertEqual(r['status'],'candidate-inventory-accepted');self.assertFalse(r['publishReady']);self.assertFalse(r['mutations'])
    def test_changed_target_blocked(self):self.assertEqual(self.check({'target':'0.10.0'})['reason'],'owner-target-mismatch')
    def test_used_version_cannot_be_reset(self):self.assertEqual(self.check({'targetEverPublished':True})['reason'],'published-identity-collision')
    def test_unknown_past_not_assumed_unused(self):self.assertEqual(self.check({'targetEverPublished':None})['reason'],'historical-use-unknown')
    def test_list_without_target_not_proof_when_history_unknown(self):self.assertEqual(self.check({'targetEverPublished':None,'publishedStableVersions':['0.2.0']})['status'],'blocked')
    def test_dns_failure_does_not_mean_available(self):self.assertEqual(self.check({'registryRead':'dns-error'})['reason'],'registry-not-verified')
    def test_no_namespace_rights(self):self.assertEqual(self.check({'namespaceAuthorized':False})['reason'],'namespace-not-authorized')
    def test_truthy_string_not_authority(self):self.assertEqual(self.check({'namespaceAuthorized':'true'})['status'],'blocked')
    def test_lower_semver_requires_migration(self):self.assertEqual(self.check({'publishedStableVersions':['0.2.0','0.10.0']})['reason'],'lower-semver-migration-required')
    def test_explicit_reset_is_possible_if_unused(self):self.assertTrue(self.check({'publishedStableVersions':['0.2.0'],'resetMigrationApproved':True})['resetFromHigherVersion'])
    def test_latest_not_a_staging_tag(self):self.assertEqual(self.check({'stagingTag':'latest'})['reason'],'non-latest-staging-required')
    def test_existing_list_contradiction_blocks(self):self.assertEqual(self.check({'publishedStableVersions':['0.1.0']})['reason'],'published-identity-collision')
    def test_malformed_inventory_fails_without_throw(self):self.assertEqual(inspect_inventory([])['status'],'blocked')
    def test_non_stable_input_requires_actual_normalizer(self):self.assertEqual(self.check({'publishedStableVersions':['0.2.0-rc.1']})['reason'],'expected-normalized-stable-semvers')
    def test_no_leading_zero_version_confusion(self):self.assertEqual(self.check({'publishedStableVersions':['00.2.0']})['status'],'blocked')
class MasterContractTests(unittest.TestCase):
    def test_master_changes_invalidate_candidate(self):
        with tempfile.TemporaryDirectory() as tmp:
            r=Path(tmp);p=r/'MASTER-SOT.md';p.write_text('one');a=candidate_digest(r);p.write_text('two');self.assertNotEqual(a,candidate_digest(r))
    def test_master_target_and_component_versions_match(self):
        self.assertEqual(load_json(ROOT/'KIT-REVISION.json')['productTarget'],'0.1.0')
        self.assertEqual(load_json(ROOT/'harness/tasks.json')['target'],'0.1.0')
        self.assertTrue(all(c['requiredFor']=='0.1.0' for c in load_json(ROOT/'harness/components.json')['components']))
    def test_requirement_ids_are_stable_not_editorial_labels(self):
        ids=[x['id'] for x in load_json(ROOT/'harness/requirements.json')['requirements']]
        self.assertTrue(all(re.fullmatch(r'R\d{2}',x) for x in ids));self.assertIn('R24',ids)
    def test_scenario_ids_are_stable(self):
        self.assertTrue(all(re.fullmatch(r'S\d{2}',x['id']) for x in load_json(ROOT/'harness/scenarios.json')['scenarios']))
    def test_root_agent_is_bounded(self):self.assertLess((ROOT/'AGENTS.md').stat().st_size,28000)
    def test_containment_precedes_protocol_tools(self):
        d={t['id']:t for t in load_json(ROOT/'harness/tasks.json')['tasks']};self.assertIn('T41',d['T22']['dependsOn'])
    def test_release_depends_on_version_check(self):
        d={t['id']:t for t in load_json(ROOT/'harness/tasks.json')['tasks']};self.assertIn('T42',d['T36']['dependsOn'])
if __name__=='__main__':unittest.main()
