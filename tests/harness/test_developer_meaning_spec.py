"""Edition 1.1 specification traceability tests, not runtime meaning implementation tests."""
import json
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
def read(path): return (ROOT/path).read_text()
def data(path): return json.loads(read(path))
class DeveloperMeaningSpecTests(unittest.TestCase):
    def test_product_version_does_not_change(self):
        self.assertEqual(data("KIT-REVISION.json")["productTarget"], "0.1.0")
        self.assertEqual(data("harness/tasks.json")["target"], "0.1.0")
    def test_code_registration_not_blocked_by_ai_tasks(self):
        tasks={t["id"]:t for t in data("harness/tasks.json")["tasks"]}
        def ancestors(key, seen=None):
            seen=set() if seen is None else seen
            for dep in tasks[key]["dependsOn"]:
                if dep not in seen: seen.add(dep); ancestors(dep, seen)
            return seen
        for tid in ("T04", "T06"):
            self.assertFalse(ancestors(tid) & {"T22", "T23", "T24", "T40"})
    def test_scenarios_mapped_and_still_planned(self):
        cases={s["id"]:s for s in data("harness/scenarios.json")["scenarios"]}
        req=next(r for r in data("harness/requirements.json")["requirements"] if r["id"]=="R05")
        for sid in ("S65", "S66", "S67"):
            self.assertIn(sid,req["scenarios"]); self.assertEqual(cases[sid]["status"],"planned")
    def test_manual_surfaces_not_another_evaluator(self):
        t=read("docs/03-semantics-derived.md")
        self.assertIn("Do not add a special developer evaluator",t)
        self.assertIn("Code/config and Studio are manual surfaces",t)
    def test_ownership_and_authority_are_not_implicit(self):
        t=read("docs/03-semantics-derived.md")
        self.assertIn("different content is a conflict",t)
        self.assertIn("flags grant no authority",t)
        self.assertIn("Studio shows its provenance and is read-only",t)
    def test_example_honestly_marked_not_shipped(self):
        t=read("docs/22-api-sketches.md")
        self.assertIn("not an available npm API or a compiled example in this kit",t)
        self.assertIn("meanings: [absenceRate]",t)
    def test_agent_prompt_preserves_correction(self):
        self.assertIn("developer code/config",read("AGENTS.md"))
        self.assertIn("S65–S67",read("PROMPT-START.md"))
if __name__ == "__main__": unittest.main()
