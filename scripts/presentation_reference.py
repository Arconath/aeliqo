"""Small deterministic candidate-search experiment, NOT the production presentation compiler.

Tests budget accounting and optional pattern composition over trusted operation descriptors.
Does not implement rendering, geometry, spatial/a11y proof, or typed interaction binding.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import FrozenSet

@dataclass(frozen=True)
class Candidate:
    id: str
    operations: FrozenSet[str]
    kind: str
    cost: int = 1
    min_width: int = 0
    ssr_safe: bool = True
    pattern: bool = False

def choose(required: FrozenSet[str], candidates: list[Candidate], *, width: int|None=800,
           allowed: FrozenSet[str]|None=None, exact_kind: str|None=None,
           max_expansions: int=64, max_nodes: int=12,
           incumbent: tuple[str,...]=()) -> dict:
    if max_expansions<1 or max_nodes<1:raise ValueError('positive budget required')
    ids=[c.id for c in candidates]
    if len(ids)!=len(set(ids)):raise ValueError('duplicate capability identifier')
    eligible=[c for c in candidates if (allowed is None or c.id in allowed)
              and (width is not None and c.min_width<=width or width is None and c.ssr_safe)
              and (exact_kind is None or c.kind==exact_kind) and c.operations & required]
    eligible.sort(key=lambda c:(c.cost,c.id))
    by_id={c.id:c for c in eligible}
    base={'expansions':0,'registrySize':len(candidates),'eligibleCount':len(eligible)}
    if not required:return {**base,'status':'valid','ids':[],'reason':'empty requirement'}
    if incumbent and all(i in by_id for i in incumbent) and required<=frozenset().union(*(by_id[i].operations for i in incumbent)):
        return {**base,'status':'valid','ids':list(incumbent),'reason':'retain valid incumbent'}
    union=frozenset().union(*(c.operations for c in eligible))
    if not required<=union:
        return {**base,'status':'unsupported','missing':sorted(required-union),'reason':'no eligible capability covers required operation'}
    # Valid-first greedy seed avoids exhausting the entire budget on sibling candidates
    # before extending any candidate into a complete plan. This prototype has monotone
    # operation coverage only; the production compiler also validates bindings/spatial
    # constraints and can use a bounded beam after obtaining a feasible incumbent.
    covered=frozenset(); selected=[]; expansions=0
    while not required<=covered and len(selected)<max_nodes:
        if expansions>=max_expansions:
            return {**base,'expansions':expansions,'status':'search-exhausted','reason':'budget, not proof of no solution'}
        ranked=sorted((c for c in eligible if c.id not in selected and (c.operations & required)-covered),
                      key=lambda c:(-len((c.operations & required)-covered),c.cost,c.id))
        if not ranked:break
        chosen=ranked[0];expansions+=1;selected.append(chosen.id);covered|=chosen.operations & required
    if required<=covered:
        return {**base,'expansions':expansions,'status':'valid','ids':selected,'reason':'feasible-first bounded composition; no optimality claim'}
    return {**base,'expansions':expansions,'status':'search-exhausted','reason':'bounded search found no plan; general impossibility not established'}
