"""Tests for kit safety, fail-closed gates and independent fixture math, not future UI code."""
from __future__ import annotations
import contextlib
import copy
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts'))
from common import candidate_digest,dag_errors,export_files,load_json,safe_file,sha256
from bootstrap import copy_kit
from configure_agents import KEYS,configuration,write_configuration
from gate import artifact_errors,command_errors,readiness_errors
from kit_check import validate
from publish_git import publish,validate_target
from reference_oracle import calculate

class GraphTests(unittest.TestCase):
    def test_valid_dag(self):
        self.assertEqual(dag_errors([{'id':'a'},{'id':'b','dependsOn':['a']}]),[])
    def test_missing_dependency(self):
        self.assertIn('missing',dag_errors([{'id':'a','dependsOn':['b']}])[0])
    def test_cycle(self):
        self.assertIn('cycle',dag_errors([{'id':'a','dependsOn':['b']},{'id':'b','dependsOn':['a']}])[0])
    def test_duplicate(self):
        self.assertIn('Duplicate',dag_errors([{'id':'a'},{'id':'a'}])[0])
    def test_actual_manifest_dag(self):
        self.assertEqual(dag_errors(load_json(ROOT/'harness/tasks.json')['tasks']),[])

class PathTests(unittest.TestCase):
    def test_relative_path(self):
        self.assertEqual(safe_file(ROOT,'README.md'),ROOT/'README.md')
    def test_traversal_rejected(self):
        for path in ('../secret','/etc/passwd','C:/secret','a\\b'):
            with self.subTest(path=path),self.assertRaises(ValueError): safe_file(ROOT,path)
    def test_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); (root/'target').write_text('data'); (root/'link').symlink_to(root/'target')
            with self.assertRaises(ValueError): safe_file(root,'link')
    def test_credentials_excluded(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); (root/'.env').write_text('secret'); (root/'README.md').write_text('ok')
            self.assertEqual([p.name for p in export_files(root)],['README.md'])
    def test_private_key_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); (root/'private.pem').write_text('not-a-real-key')
            with self.assertRaises(ValueError): export_files(root)
    def test_digest_changes_with_source(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); (root/'packages').mkdir(); file=root/'packages/a.ts'; file.write_text('one')
            first=candidate_digest(root); file.write_text('two'); self.assertNotEqual(first,candidate_digest(root))
    def test_digest_excludes_evidence_bookkeeping(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); (root/'harness').mkdir(); file=root/'harness/state.json'; file.write_text('{}')
            first=candidate_digest(root); file.write_text('{"done":true}'); self.assertEqual(first,candidate_digest(root))

class BootstrapTests(unittest.TestCase):
    def test_dry_run_no_directory(self):
        with tempfile.TemporaryDirectory() as temp,contextlib.redirect_stdout(io.StringIO()):
            target=Path(temp)/'new'; count=copy_kit(ROOT,target)
            self.assertGreater(count,50); self.assertFalse(target.exists())
    def test_existing_data_never_overwritten(self):
        with tempfile.TemporaryDirectory() as temp:
            target=Path(temp); (target/'important').write_text('keep')
            with self.assertRaises(ValueError): copy_kit(ROOT,target,True)
            self.assertEqual((target/'important').read_text(),'keep')
    def test_source_nested_target_refused(self):
        with self.assertRaises(ValueError): copy_kit(ROOT,ROOT/'nested')
    def test_apply_to_empty_directory(self):
        with tempfile.TemporaryDirectory() as temp,contextlib.redirect_stdout(io.StringIO()):
            target=Path(temp)/'new'; count=copy_kit(ROOT,target,True)
            self.assertEqual((target/'AGENTS.md').read_bytes(),(ROOT/'AGENTS.md').read_bytes())
            self.assertEqual(len(export_files(target)),count)
    def test_symlink_destination_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); (root/'real').mkdir(); (root/'link').symlink_to(root/'real')
            with self.assertRaises(ValueError): copy_kit(ROOT,root/'link',True)

class PublisherTests(unittest.TestCase):
    def test_safe_target(self): validate_target('Arconath/aeliqo','rewrite/v0.1.0-foundation')
    def test_main_refused(self):
        with self.assertRaises(ValueError): validate_target('Arconath/aeliqo','main')
    def test_bad_ref_refused(self):
        for branch in ('rewrite/../main','rewrite/foo.lock','rewrite//x','rewrite/x;rm'):
            with self.subTest(branch=branch),self.assertRaises(ValueError): validate_target('Arconath/aeliqo',branch)
    def test_repo_argument_injection_refused(self):
        with self.assertRaises(ValueError): validate_target('--help','rewrite/x')
    def test_dry_run_never_calls_network(self):
        with mock.patch('publish_git.run',side_effect=AssertionError('network called')):
            report=publish(ROOT,'Arconath/aeliqo','rewrite/test')
        self.assertFalse(report['applied']); self.assertFalse(report['mutatesMain'])
    def test_apply_requires_tools(self):
        with mock.patch('publish_git.shutil.which',return_value=None),self.assertRaises(RuntimeError):
            publish(ROOT,'Arconath/aeliqo','rewrite/test',True)
    def test_existing_branch_refused_before_write(self):
        def fake(argv,*args,**kwargs):
            if argv[:3]==['gh','auth','status']: return 'ok'
            if argv[:2]==['gh','api']: return json.dumps({'default_branch':'main','archived':False})
            if argv[:3]==['git','config','--get']: return 'test author'
            if 'ls-remote' in argv: return 'abc\trefs/heads/rewrite/test'
            raise AssertionError('unexpected write command '+str(argv))
        with mock.patch('publish_git.shutil.which',return_value='/test'),mock.patch('publish_git.run',side_effect=fake),self.assertRaises(RuntimeError):
            publish(ROOT,'Arconath/aeliqo','rewrite/test',True)

class ConfigTests(unittest.TestCase):
    def valid(self):
        return {'verified':True,'runtimeVersion':'test-runtime','verifiedAt':'2026-09-07',
          'orchestratorModelId':'test-astra','subagentModelId':'test-luna',
          'orchestratorEfforts':['medium'],'subagentEfforts':['max'],
          'runtimeThreadLimit':8,'resourceThreadLimit':4,'supportedConfigKeys':sorted(KEYS)}
    def test_unverified_refused(self):
        with self.assertRaises(ValueError): configuration(load_json(ROOT/'harness/runtime-capabilities.example.json'))
    def test_no_silent_effort_substitution(self):
        cap=self.valid(); cap['subagentEfforts']=['xhigh']
        with self.assertRaises(ValueError): configuration(cap)
    def test_placeholder_id_refused(self):
        cap=self.valid(); cap['orchestratorModelId']='<model-id>'
        with self.assertRaises(ValueError): configuration(cap)
    def test_unsupported_schema_refused(self):
        cap=self.valid(); cap['supportedConfigKeys']=[]
        with self.assertRaises(ValueError): configuration(cap)
    def test_minimum_verified_concurrency(self):
        files=configuration(self.valid())
        self.assertIn('max_concurrent_threads_per_session = 4',files['.codex/config.toml'])
    def test_actual_toml_syntax(self):
        import tomllib
        for text in configuration(self.valid()).values(): self.assertIsInstance(tomllib.loads(text),dict)
    def test_existing_config_not_overwritten(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); (root/'.codex').mkdir(); (root/'.codex/config.toml').write_text('keep')
            with self.assertRaises(ValueError): write_configuration(root,configuration(self.valid()),True)
            self.assertEqual((root/'.codex/config.toml').read_text(),'keep')
    def test_dry_run_config_does_not_write(self):
        with tempfile.TemporaryDirectory() as temp,contextlib.redirect_stdout(io.StringIO()):
            root=Path(temp); write_configuration(root,configuration(self.valid()))
            self.assertEqual(list(root.iterdir()),[])

class GateTests(unittest.TestCase):
    def pending_manifest(self,path):
        obj=load_json(path)
        if path.name=='tasks.json':
            for item in obj['tasks']: item['status']='planned'
        elif path.name=='components.json':
            for item in obj['components']: item['status']='planned'
        return obj
    def test_kit_consistent(self): self.assertEqual(validate(ROOT)[0],[])
    def test_product_commands_absent_fail_closed(self):
        with mock.patch('gate.load_json',return_value={'commands':[]}): self.assertTrue(command_errors(ROOT)[0])
    def test_release_is_blocked(self):
        with mock.patch('gate.load_json',side_effect=self.pending_manifest):
            errors=readiness_errors(ROOT,'release')
        self.assertGreater(len(errors),10); self.assertTrue(any('not implemented' in e for e in errors))
    def test_no_circular_ready_gate_for_stable_publication(self):
        with mock.patch('gate.load_json',side_effect=self.pending_manifest):
            ready=readiness_errors(ROOT,'ready'); release=readiness_errors(ROOT,'release')
        self.assertFalse(any(e.startswith('T36:') for e in ready))
        self.assertTrue(any(e.startswith('T36:') for e in release))
    def test_claim_alone_not_evidence(self): self.assertTrue(artifact_errors(ROOT,[],'test'))
    def test_invalid_hash_refused(self):
        self.assertTrue(artifact_errors(ROOT,[{'path':'README.md','sha256':'0'*64}],'test'))
    def test_real_artifact_hash_accepted(self):
        self.assertEqual(artifact_errors(ROOT,[{'path':'README.md','sha256':sha256(ROOT/'README.md')}],'test'),[])
    def test_path_escape_in_evidence_refused(self):
        self.assertTrue(artifact_errors(ROOT,[{'path':'../secret','sha256':'0'*64}],'test'))

class OracleTests(unittest.TestCase):
    def raw(self): return load_json(ROOT/'fixtures/hr/raw.json')
    def test_independent_expected_results(self):
        self.assertEqual(calculate(self.raw()),load_json(ROOT/'fixtures/hr/expected.json'))
    def test_duplicate_attendance_refused(self):
        raw=self.raw(); raw['observations'].append(copy.deepcopy(raw['observations'][0]))
        with self.assertRaises(ValueError): calculate(raw)
    def test_duplicate_schedule_refused(self):
        raw=self.raw(); raw['schedules'].append(copy.deepcopy(raw['schedules'][0]))
        with self.assertRaises(ValueError): calculate(raw)
    def test_unknown_is_not_absence(self):
        raw=self.raw(); removed=raw['observations'].pop(0)
        result=calculate(raw); employee=next(r for r in result['employees'] if r['employee_id']==removed['employee_id'])
        self.assertEqual(employee['unknown'],1); self.assertIsNone(employee['rate'])
    def test_top_population_is_fixed_across_weeks(self):
        result=calculate(self.raw())
        self.assertEqual({row['employee_id'] for row in result['weekly']},set(result['topFive']))
    def test_group_ratio_uses_sufficient_statistics(self):
        from fractions import Fraction
        result=calculate(self.raw())
        group=next(g for g in result['departments'] if g['department']=='Operations')
        rows=[r for r in result['employees'] if r['department']=='Operations']
        ratio=Fraction(sum(r['absent'] for r in rows),sum(r['expected'] for r in rows))
        mean=sum((Fraction(r['rate']) for r in rows),Fraction(0))/len(rows)
        self.assertEqual(Fraction(group['rate']),ratio); self.assertNotEqual(ratio,mean)
    def test_approved_leave_removed_from_denominator(self):
        result=calculate(self.raw()); employee=next(r for r in result['employees'] if r['employee_id']=='e2')
        self.assertEqual(employee['expected'],56)
    def test_invalid_status_refused(self):
        raw=self.raw(); raw['observations'][0]['status']='maybe'
        with self.assertRaises(ValueError): calculate(raw)


class SchedulerTests(unittest.TestCase):
    def task(self,tid,paths,status='planned',deps=None):
        return {'id':tid,'title':tid,'ownerRole':'test','paths':paths,'status':status,'dependsOn':deps or []}
    def test_ready_dependencies_only(self):
        from next_tasks import choose
        tasks=[self.task('a',['a']),self.task('b',['b'],deps=['a'])]
        self.assertEqual([t['id'] for t in choose(tasks,8)['suggested']],['a'])
    def test_parallel_independent_paths(self):
        from next_tasks import choose
        tasks=[self.task('a',['packages/web/src/input']),self.task('b',['packages/web/src/data'])]
        self.assertEqual(len(choose(tasks,8)['suggested']),2)
    def test_parent_path_conflict(self):
        from next_tasks import choose
        tasks=[self.task('a',['packages/web']),self.task('b',['packages/web/src/data'])]
        self.assertEqual(len(choose(tasks,8)['suggested']),1)
    def test_active_ownership_blocks_conflicting_writer(self):
        from next_tasks import choose
        tasks=[self.task('a',['packages/web'],'active'),self.task('b',['packages/web/src/input'])]
        self.assertEqual(choose(tasks,8)['suggested'],[])
    def test_slot_limit(self):
        from next_tasks import choose
        tasks=[self.task('a',['a']),self.task('b',['b'])]
        self.assertEqual(len(choose(tasks,1)['suggested']),1)
    def test_blocked_task_is_not_silently_restarted(self):
        from next_tasks import choose
        result=choose([self.task('a',['a'],'blocked')],8)
        self.assertEqual(result['suggested'],[]); self.assertEqual(result['blocked'],['a'])


class DesignReferenceTests(unittest.TestCase):
    def contrast(self,a,b):
        def luminance(color):
            linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in color]
            return sum(x*y for x,y in zip(linear,(.2126,.7152,.0722)))
        first,second=sorted((luminance(a),luminance(b)))
        return (second+.05)/(first+.05)
    def test_text_contrast_for_reference_palettes(self):
        tokens=load_json(ROOT/'design/tokens.json')
        for theme in ('light','dark'):
            for foreground in ('text','muted','accent','danger'):
                for background in ('canvas','surface'):
                    with self.subTest(theme=theme,foreground=foreground,background=background):
                        ratio=self.contrast(tokens[theme][foreground]['$value']['components'],tokens[theme][background]['$value']['components'])
                        self.assertGreaterEqual(ratio,4.5)
    def test_action_text_and_control_border_contrast(self):
        tokens=load_json(ROOT/'design/tokens.json')
        for theme in ('light','dark'):
            palette=tokens[theme]
            self.assertGreaterEqual(self.contrast(palette['onAccent']['$value']['components'],palette['accent']['$value']['components']),4.5)
            self.assertGreaterEqual(self.contrast(palette['border']['$value']['components'],palette['surface']['$value']['components']),3)
    def test_profile_components_exist(self):
        ids={c['id'] for c in load_json(ROOT/'harness/components.json')['components']}
        for profile in load_json(ROOT/'design/experience-profiles.json')['profiles']:
            self.assertTrue(set(profile['allowedRepresentations']).issubset(ids))

if __name__=='__main__': unittest.main()


