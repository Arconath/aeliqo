#!/usr/bin/env python3
"""Independent, dependency-free T40 data oracle.

This checker intentionally reads only the held-out JSON and implements the
small query vocabulary represented by the corpus. It does not import Aeliqo
packages, call a provider, or emit prompts, source rows, or expected values.
The report contains metadata and aggregate pass/fail counts only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any, Callable


class OracleError(Exception):
    """The corpus used a query construct outside this independent vocabulary."""


def decimal_value(value: Any) -> Decimal | Any:
    if isinstance(value, dict) and set(value) == {"decimal"}:
        return Decimal(str(value["decimal"]))
    if isinstance(value, bool) or value is None:
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    return value


def scalar_equal(left: Any, right: Any) -> bool:
    left_value = decimal_value(left)
    right_value = decimal_value(right)
    if isinstance(left_value, Decimal) or isinstance(right_value, Decimal):
        try:
            return Decimal(str(left_value)) == Decimal(str(right_value))
        except (ArithmeticError, ValueError):
            return False
    if isinstance(left_value, float) or isinstance(right_value, float):
        return isinstance(left_value, (int, float)) and isinstance(right_value, (int, float)) and math.isclose(
            left_value, right_value, rel_tol=1e-12, abs_tol=1e-12
        )
    return left_value == right_value


def rows_equal(left: dict[str, Any], right: dict[str, Any]) -> bool:
    return set(left) == set(right) and all(scalar_equal(left[key], right[key]) for key in left)


def compare(value: Any, operation: str, target: Any) -> bool:
    if operation == "eq":
        return value is not None and scalar_equal(value, target)
    if operation == "neq":
        return value is not None and not scalar_equal(value, target)
    if value is None:
        return False
    left = decimal_value(value)
    right = decimal_value(target)
    if operation == "gt":
        return left > right
    if operation == "gte":
        return left >= right
    if operation == "lt":
        return left < right
    if operation == "lte":
        return left <= right
    raise OracleError(f"unsupported comparison: {operation}")


def predicate(row: dict[str, Any], expression: dict[str, Any]) -> bool:
    operation = expression["op"]
    if operation == "compare":
        return compare(row.get(expression["field"]), expression["comparison"], expression.get("value"))
    if operation == "in":
        return row.get(expression["field"]) is not None and any(
            scalar_equal(row.get(expression["field"]), value) for value in expression["values"]
        )
    if operation == "is-null":
        return (row.get(expression["field"]) is None) != bool(expression.get("negate", False))
    if operation == "and":
        return all(predicate(row, child) for child in expression["predicates"])
    if operation == "or":
        return any(predicate(row, child) for child in expression["predicates"])
    raise OracleError(f"unsupported predicate: {operation}")


def time_bucket(value: Any, specification: dict[str, Any]) -> Any:
    if value is None:
        return None
    day = date.fromisoformat(str(value)[:10])
    if specification["grain"] == "month":
        return f"{day.year:04d}-{day.month:02d}-01"
    if specification["grain"] == "week":
        return (day - timedelta(days=day.weekday())).isoformat()
    raise OracleError(f"unsupported time bucket: {specification['grain']}")


def apply_relation_usage(
    rows: list[dict[str, Any]],
    query: dict[str, Any],
    fixture: dict[str, Any],
    catalog: dict[str, Any],
) -> list[dict[str, Any]]:
    relations = {relation["id"]: relation for relation in catalog["relationships"]}
    for usage in query.get("relationUsage", []):
        relation = relations[usage["relation"]["id"]]
        relation_where = usage["where"]
        target_rows = [
            row
            for row in fixture["records"][relation_where["entity"]]
            if predicate(row, relation_where)
        ]
        target_keys = {
            tuple(row.get(key["targetField"]) for key in relation["keys"])
            for row in target_rows
        }
        if query["entity"] == relation["sourceEntity"]:
            return [
                row
                for row in rows
                if tuple(row.get(key["sourceField"]) for key in relation["keys"]) in target_keys
            ]
        if query["entity"] == relation["targetEntity"]:
            source_keys = {
                tuple(row.get(key["sourceField"]) for key in relation["keys"])
                for row in fixture["records"][relation["sourceEntity"]]
            }
            return [
                row
                for row in rows
                if tuple(row.get(key["targetField"]) for key in relation["keys"]) in source_keys
            ]
        raise OracleError("relation usage entity is outside the declared relation")
    return rows


def aggregate_value(rows: list[dict[str, Any]], meaning: dict[str, Any]) -> Any:
    function_id = meaning["implementation"]["expression"]["function"]["id"]
    arguments = meaning["implementation"]["expression"]["arguments"]
    if function_id == "core.aggregate.count":
        reference = arguments[0]["ref"]
        return sum(row.get(reference) is not None for row in rows)
    if function_id == "core.aggregate.sum":
        reference = arguments[0]["ref"]
        raw_values = [row.get(reference) for row in rows]
        if any(value is None for value in raw_values):
            return None
        values = [value for value in raw_values if value is not None]
        if not values:
            return None
        if any(isinstance(value, dict) and set(value) == {"decimal"} for value in values):
            total = sum(
                (Decimal(str(value["decimal"])) if isinstance(value, dict) else Decimal(str(value)) for value in values),
                Decimal(0),
            )
            if len(values) == 1 and isinstance(values[0], dict):
                return {"decimal": values[0]["decimal"]}
            normalized = format(total, "f").rstrip("0").rstrip(".") if total != 0 else "0"
            return {"decimal": normalized}
        return sum(values)
    if function_id == "core.ratio-of-sums":
        numerator_reference = arguments[0]["ref"]
        denominator_reference = arguments[1]["ref"]
        pairs = [(row.get(numerator_reference), row.get(denominator_reference)) for row in rows]
        if any(numerator is None or denominator is None for numerator, denominator in pairs):
            return None
        if not pairs:
            return None
        numerator = sum((Decimal(str(value)) for value, _ in pairs), Decimal(0))
        denominator = sum((Decimal(str(value)) for _, value in pairs), Decimal(0))
        return None if denominator == 0 else float(numerator / denominator)
    raise OracleError(f"unsupported aggregate function: {function_id}")


def order_rows(rows: list[dict[str, Any]], order: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for specification in reversed(order):
        field = specification["field"]
        direction = specification["direction"]
        nulls = specification.get("nulls", "last")

        def value(row: dict[str, Any]) -> Any:
            return decimal_value(row.get(field))

        non_null = [row for row in rows if value(row) is not None]
        null_rows = [row for row in rows if value(row) is None]
        non_null.sort(key=value, reverse=direction == "desc")
        rows = non_null + null_rows if nulls == "last" else null_rows + non_null
    return rows


def evaluate_output(case: dict[str, Any], task_output: dict[str, Any]) -> list[dict[str, Any]]:
    fixture = case["fixture"]
    catalog = fixture["catalog"]
    query = task_output["query"]
    entity = query["entity"]
    meanings = {meaning["id"]: meaning for meaning in catalog["meanings"]}
    rows = [dict(row) for row in fixture["records"][entity]]
    if query.get("where") is not None:
        rows = [row for row in rows if predicate(row, query["where"])]
    rows = apply_relation_usage(rows, query, fixture, catalog)

    group_fields = list(query.get("groupBy", []))
    bucket_specification = query.get("timeBucket")
    if query.get("measures"):
        groups: dict[tuple[Any, ...], list[dict[str, Any]]] = {}
        for row in rows:
            key = tuple(
                time_bucket(row.get(bucket_specification["field"]), bucket_specification)
                if bucket_specification is not None and field == bucket_specification["field"]
                else row.get(field)
                for field in group_fields
            )
            groups.setdefault(key, []).append(row)
        projected: list[dict[str, Any]] = []
        for key, members in groups.items():
            projected_row = {field: value for field, value in zip(group_fields, key)}
            for measure in query["measures"]:
                projected_row[measure["id"]] = aggregate_value(members, meanings[measure["id"]])
            projected.append(projected_row)
    else:
        projected = [{field: row.get(field) for field in query.get("fields", [])} for row in rows]
    projected = order_rows(projected, query.get("order", []))
    if query.get("topK") is not None:
        projected = projected[: query["topK"]]
    return projected


def structural_quality(case: dict[str, Any]) -> dict[str, Any]:
    fixture = case["fixture"]
    catalog = fixture["catalog"]
    entities = {entity["id"]: entity for entity in catalog["entities"]}
    meanings = {meaning["id"]: meaning for meaning in catalog["meanings"]}
    checks = {
        "recordFields": True,
        "taskRevisions": case["explicitTask"]["catalogRevision"] == catalog["revision"] and case["explicitTask"]["functionRegistryDigest"] == catalog["functionRegistryDigest"],
        "outputIds": True,
        "rowShapes": True,
        "qualityPopulation": True,
        "qualitySources": True,
        "definitionRefs": True,
    }
    for entity in catalog["entities"]:
        fields = {field["id"] for field in entity["fields"]}
        checks["recordFields"] &= all(set(row) == fields for row in fixture["records"][entity["id"]])
    if len(case["explicitTask"]["outputs"]) != len(case["expected"]):
        checks["outputIds"] = False
    for task_output, expected in zip(case["explicitTask"]["outputs"], case["expected"]):
        checks["outputIds"] &= task_output["id"] == expected["id"]
        checks["rowShapes"] &= all(set(row) == set(expected["fields"]) for row in expected["rows"])
        checks["qualityPopulation"] &= expected["quality"]["populationCount"] == len(expected["rows"])
        checks["qualitySources"] &= all(
            key in fixture["records"] and revision == fixture["sourceRevision"]
            for key, revision in expected["quality"]["sourceRevisions"].items()
        )
        checks["definitionRefs"] &= all(
            definition["id"] in meanings and meanings[definition["id"]]["revision"] == definition["revision"]
            for definition in expected["quality"]["definitions"]
        )
    return checks


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", type=Path, default=Path("fixtures/evaluation/t40-data-query-heldout.json"))
    parser.add_argument("--report", type=Path, default=Path("fixtures/evaluation/review/t40-independent-oracle.report.json"))
    args = parser.parse_args()
    corpus_bytes = args.corpus.read_bytes()
    cases = json.loads(corpus_bytes)
    mismatches: list[dict[str, int]] = []
    quality_checks = {"recordFields": True, "taskRevisions": True, "outputIds": True, "rowShapes": True, "qualityPopulation": True, "qualitySources": True, "definitionRefs": True}
    output_count = 0
    for case_index, case in enumerate(cases):
        case_checks = structural_quality(case)
        for name, passed in case_checks.items():
            quality_checks[name] &= passed
        for output_index, (task_output, expected) in enumerate(zip(case["explicitTask"]["outputs"], case["expected"])):
            output_count += 1
            actual = evaluate_output(case, task_output)
            if len(actual) != len(expected["rows"]) or any(not rows_equal(left, right) for left, right in zip(actual, expected["rows"])):
                mismatches.append({"caseIndex": case_index, "outputIndex": output_index})
    report = {
        "schemaVersion": 1,
        "oracle": "independent-python-decimal-query-v1",
        "oracleScriptSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "corpusSha256": hashlib.sha256(corpus_bytes).hexdigest(),
        "caseCount": len(cases),
        "outputCount": output_count,
        "matchedOutputCount": output_count - len(mismatches),
        "mismatchCount": len(mismatches),
        "mismatches": mismatches,
        "qualityChecks": quality_checks,
        "providerRequests": 0,
        "sdkImports": 0,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("oracleScriptSha256", "corpusSha256", "caseCount", "outputCount", "matchedOutputCount", "mismatchCount", "qualityChecks", "providerRequests", "sdkImports")}, sort_keys=True))
    return 0 if not mismatches and all(quality_checks.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
