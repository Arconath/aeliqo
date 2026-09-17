#!/usr/bin/env python3
"""Run the repository's required quality commands and emit source-bound evidence."""

from __future__ import annotations

import hashlib
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "quality" / "commands.json"
REPORT = ROOT / "artifacts" / "product-ci" / "ci.json"
LOGS = ROOT / "artifacts" / "product-ci" / "logs"
REQUIRED_KINDS = {
    "typecheck",
    "unit",
    "browser",
    "packages",
    "performance",
    "lint",
    "security",
    "boundaries",
}


def git(*arguments: str) -> str:
    return subprocess.run(
        ["git", *arguments], cwd=ROOT, check=True, text=True, capture_output=True
    ).stdout.strip()


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def terminate(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=2)
    except (ProcessLookupError, subprocess.TimeoutExpired):
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait()


def run_timed_logged_command(
    arguments: list[str], cwd: Path, stream, timeout_seconds: int, environment: dict | None = None
) -> tuple[int, float]:
    """Run one command, capture its exit code, and report monotonic elapsed time."""
    started = time.monotonic()
    code = 127
    try:
        process = subprocess.Popen(
            arguments,
            cwd=cwd,
            stdout=stream,
            stderr=subprocess.STDOUT,
            env=environment,
            start_new_session=True,
        )
        try:
            code = process.wait(timeout=timeout_seconds)
        except subprocess.TimeoutExpired:
            terminate(process)
            code = 124
    except OSError as error:
        stream.write(str(error).encode())
    return code, round(time.monotonic() - started, 3)


def write_report(source: str, status: str, changed: bool, results: list[dict]) -> None:
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": 1,
        "sourceRevision": source,
        "status": status,
        "sourceChangedDuringRun": changed,
        "results": results,
    }
    with tempfile.NamedTemporaryFile(
        "w", dir=REPORT.parent, prefix=".ci-", suffix=".json", delete=False
    ) as stream:
        temporary = Path(stream.name)
        json.dump(payload, stream, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, REPORT)


def validate(commands: object) -> list[dict]:
    if not isinstance(commands, list) or not commands:
        raise ValueError("quality.commands.json requires a non-empty commands array")
    kinds: set[str] = set()
    for command in commands:
        if not isinstance(command, dict):
            raise ValueError("each quality command must be an object")
        kind = command.get("kind")
        arguments = command.get("argv")
        timeout = command.get("timeoutSeconds")
        if not isinstance(kind, str) or not kind:
            raise ValueError("each quality command requires a kind")
        if not isinstance(arguments, list) or not arguments or any(
            not isinstance(value, str) or not value for value in arguments
        ):
            raise ValueError("each quality command requires a non-empty argv array")
        if not isinstance(timeout, int) or isinstance(timeout, bool) or not 1 <= timeout <= 3600:
            raise ValueError("quality command timeouts must be between 1 and 3600 seconds")
        kinds.add(kind)
    missing = REQUIRED_KINDS - kinds
    if missing:
        raise ValueError(f"quality configuration is missing: {', '.join(sorted(missing))}")
    return commands


def main() -> int:
    configuration = json.loads(CONFIG.read_text(encoding="utf-8"))
    commands = validate(configuration.get("commands"))
    source = git("rev-parse", "HEAD")
    before = git("status", "--porcelain=v1", "--untracked-files=all")
    if before:
        print("Quality requires a clean source checkout.", file=sys.stderr)
        return 1

    LOGS.mkdir(parents=True, exist_ok=True)
    results: list[dict] = []
    write_report(source, "running", False, results)
    with tempfile.TemporaryDirectory(prefix="aeliqo-build-reuse-") as reuse:
        environment = {**os.environ, "AELIQO_BUILD_REUSE_DIRECTORY": reuse}
        for index, command in enumerate(commands):
            output = LOGS / f"{index:02d}-{command['kind']}.log"
            with output.open("wb") as stream:
                code, elapsed = run_timed_logged_command(
                    command["argv"], ROOT, stream, command["timeoutSeconds"], environment
                )
            results.append(
                {
                    "kind": command["kind"],
                    "argv": command["argv"],
                    "exitCode": code,
                    "elapsedSeconds": elapsed,
                    "log": {
                        "path": output.relative_to(ROOT).as_posix(),
                        "sha256": digest(output),
                    },
                }
            )
            changed = git("status", "--porcelain=v1", "--untracked-files=all") != before
            status = "running" if code == 0 and not changed else "failed"
            write_report(source, status, changed, results)
            print(f"{index + 1}/{len(commands)} {command['kind']}: exit {code} ({elapsed:.3f}s)", flush=True)
            if code != 0 or changed:
                return 1

    write_report(source, "passed", False, results)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
