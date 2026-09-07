import sys, unittest, random, sqlite3
from pathlib import Path
from fractions import Fraction
from decimal import Decimal
from datetime import date,timedelta
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
from semantic_reference import *
class NumericalContractTests(unittest.TestCase):
    def test_mean_and_pooled_answer_different_questions(self):
        pairs=[(1,2),(1,100)]
        self.assertEqual(rate_mean(pairs),Fraction(51,200));self.assertEqual(pooled(pairs),Fraction(1,51));self.assertNotEqual(rate_mean(pairs),pooled(pairs))
    def test_mix_shift_totals_do_not_imply_every_group_worse(self):
        x=simpson();self.assertGreater(x['before'],x['after'])
        self.assertTrue(all(a<b for a,b in zip(x['groupsBefore'],x['groupsAfter'])))
    def test_fanout_mutant_is_detected(self):
        wrong,right=fanout();self.assertEqual((wrong,right),(600,300));self.assertNotEqual(wrong,right)
    def test_fixed_cohort_not_per_week_winner(self):self.assertEqual(fixed_and_live(),('A',['A','B']))
    def test_zero_denominator_unknown_not_zero(self):self.assertIsNone(pooled([(0,0)]))
    def test_no_observations_is_unknown(self):self.assertIsNone(pooled([]))
    def test_missing_observation_not_absence(self):self.assertIsNone(pooled([(None,1)]))
    def test_missing_pair_exclusion_is_declared(self):self.assertEqual(pooled([(1,2),(None,8)]),Fraction(1,2))
    def test_unknown_does_not_become_calendar_zero(self):self.assertNotEqual(pooled([(1,2),(None,8)]),pooled([(1,2),(0,8)]))
    def test_large_money_exact_decimal(self):
        self.assertEqual(Decimal('9007199254740993.01')+Decimal('0.02'),Decimal('9007199254740993.03'))
        self.assertNotEqual(str(float('9007199254740993.01')),str(Decimal('9007199254740993.01')))
    def test_calendar_three_months_not_ninety_days(self):
        end=date(2026,9,1);self.assertEqual((end-date(2026,6,1)).days,92);self.assertNotEqual(end-timedelta(days=90),date(2026,6,1))
    def test_half_open_periods_do_not_overlap(self):
        instant=date(2026,7,1);self.assertFalse(date(2026,6,1)<=instant<date(2026,7,1));self.assertTrue(date(2026,7,1)<=instant<date(2026,8,1))
    def test_local_day_not_fixed_24_hours(self):self.assertEqual(dst_duration_hours(),23)
    def test_sql_python_equivalence_300_seeds(self):
        for seed in range(300):self.assertTrue(grouped_sql_matches(seed),seed)
    def test_permutations_preserve_exact_pooled_rate_100_seeds(self):
        for seed in range(100):
            r=random.Random(seed);pairs=[(r.randrange(10),r.randrange(1,20)) for _ in range(50)];before=pooled(pairs);r.shuffle(pairs);self.assertEqual(before,pooled(pairs))
    def test_shards_preserve_sufficient_statistics_100_seeds(self):
        for seed in range(100):
            r=random.Random(seed);xs=[(r.randrange(10),r.randrange(1,20)) for _ in range(40)]
            shards=[(sum(a for a,b in xs[i:i+8]),sum(b for a,b in xs[i:i+8])) for i in range(0,40,8)]
            self.assertEqual(pooled(xs),pooled(shards))
    def test_distinct_counts_not_additive(self):
        a={'a','b'};b={'b','c'};self.assertNotEqual(len(a)+len(b),len(a|b))
    def test_balance_not_sum_over_time(self):
        snapshots=[100,100];self.assertEqual(snapshots[-1],100);self.assertNotEqual(sum(snapshots),snapshots[-1])
    def test_identity_count_not_row_count(self):
        employee_days=[('A',1),('A',2),('B',1)];self.assertEqual(len({x[0] for x in employee_days}),2);self.assertEqual(len(employee_days),3)
    def test_partial_page_cannot_prove_global_winner(self):
        page=[('a',2),('b',1)];all_rows=page+[('c',20)];self.assertNotEqual(max(page,key=lambda x:x[1])[0],max(all_rows,key=lambda x:x[1])[0])
if __name__=='__main__':unittest.main()
