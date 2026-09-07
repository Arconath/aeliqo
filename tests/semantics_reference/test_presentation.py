import sys,unittest,random
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
from presentation_reference import Candidate,choose

def cap(id,ops,kind='view',**kwargs):return Candidate(id,frozenset(ops),kind,**kwargs)
class PresentationReferenceTests(unittest.TestCase):
    def test_composes_without_matching_preset(self):
        cs=[cap('profile',['inspect']),cap('calendar',['schedule']),cap('line',['trend']),cap('form',['edit'])]
        r=choose(frozenset(['inspect','schedule','trend','edit']),cs)
        self.assertEqual(r['status'],'valid');self.assertEqual(set(r['ids']),{c.id for c in cs})
    def test_pattern_optional_not_mandatory(self):
        cs=[cap('table',['browse'],'table'),cap('detail',['inspect'])]
        self.assertEqual(choose(frozenset(['browse','inspect']),cs)['status'],'valid')
    def test_tested_pattern_can_also_cover(self):
        r=choose(frozenset(['browse','inspect']),[cap('browseDetail',['browse','inspect'],pattern=True)])
        self.assertEqual(r['ids'],['browseDetail'])
    def test_narrow_reachability_not_comparison(self):
        r=choose(frozenset(['simultaneous-compare']),[cap('list',['browse','inspect'],'list'),cap('scroll-table',['browse','simultaneous-compare'],'table')],width=320)
        self.assertEqual(r['ids'],['scroll-table'])
    def test_explicit_table_not_soft_preference(self):
        cs=[cap('cards',['browse'],'cards'),cap('table',['browse'],'table',cost=10)]
        self.assertEqual(choose(frozenset(['browse']),cs,exact_kind='table')['ids'],['table'])
    def test_profile_conflict_not_ignored(self):
        r=choose(frozenset(['browse']),[cap('table',['browse'],'table')],allowed=frozenset())
        self.assertEqual(r['status'],'unsupported')
    def test_budget_exhaustion_not_impossibility(self):
        r=choose(frozenset(['a','b','c']),[cap('a',['a']),cap('b',['b']),cap('c',['c'])],max_expansions=1)
        self.assertEqual(r['status'],'search-exhausted');self.assertEqual(r['expansions'],1)
    def test_missing_real_capability_detected(self):
        r=choose(frozenset(['edit']),[cap('table',['browse'])]);self.assertEqual(r['missing'],['edit'])
    def test_unknown_ssr_not_fictional_width(self):
        r=choose(frozenset(['browse']),[cap('wide',['browse'],min_width=1000,ssr_safe=False),cap('safe',['browse'])],width=None)
        self.assertEqual(r['ids'],['safe'])
    def test_incumbent_stability(self):
        cs=[cap('new',['browse'],cost=0),cap('old',['browse'],cost=2)]
        self.assertEqual(choose(frozenset(['browse']),cs,incumbent=('old',))['ids'],['old'])
    def test_stale_incumbent_not_retained(self):
        r=choose(frozenset(['browse']),[cap('new',['browse'])],incumbent=('gone',));self.assertEqual(r['ids'],['new'])
    def test_registry_order_deterministic_100_seeds(self):
        cs=[cap('table',['browse']),cap('detail',['inspect']),cap('chart',['trend'])];req=frozenset(['browse','inspect','trend'])
        expected=choose(req,cs)['ids']
        for seed in range(100):random.Random(seed).shuffle(cs);self.assertEqual(choose(req,cs)['ids'],expected)
    def test_thousands_unrelated_components_no_search_explosion(self):
        cs=[cap(str(i),['other']) for i in range(7100)]+[cap('valid',['browse'])]
        r=choose(frozenset(['browse']),cs);self.assertEqual(r['eligibleCount'],1);self.assertEqual(r['expansions'],1)
    def test_valid_first_avoids_duplicate_candidate_starvation(self):
        roles=('browse','trend','detail','edit')
        cs=[cap(f'{role}{n:03}',[role]) for role in roles for n in range(30)]
        r=choose(frozenset(roles),cs,max_expansions=64)
        self.assertEqual(r['status'],'valid');self.assertEqual(r['expansions'],4)
    def test_duplicate_manifest_rejected(self):
        with self.assertRaises(ValueError):choose(frozenset(['a']),[cap('same',['a']),cap('same',['b'])])
    def test_empty_task_does_not_invent_ui(self):self.assertEqual(choose(frozenset(),[])['ids'],[])
    def test_invalid_budget_rejected(self):
        with self.assertRaises(ValueError):choose(frozenset(['a']),[],max_expansions=0)
if __name__=='__main__':unittest.main()
