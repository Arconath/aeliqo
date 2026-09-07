"""Resolve pinned project tools without falling back to unrelated global installs."""
from __future__ import annotations
import shutil
from pathlib import Path


def local_tool(root: Path, name: str) -> str | None:
    return shutil.which(name, path=str(root / 'node_modules' / '.bin'))
