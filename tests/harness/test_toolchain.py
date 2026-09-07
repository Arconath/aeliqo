"""Project tooling must not silently use an unrelated global compiler."""
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts'))
from toolchain import local_tool

class LocalToolTests(unittest.TestCase):
    def test_global_compiler_cannot_satisfy_missing_install(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp).resolve(); global_bin=root/'global';global_bin.mkdir()
            tool=global_bin/'tsc';tool.write_text('#!/bin/sh\nexit 0\n');tool.chmod(0o755)
            with patch.dict(os.environ,{'PATH':str(global_bin)}):
                self.assertIsNone(local_tool(root,'tsc'))

    def test_project_executable_is_selected(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp).resolve(); bin_dir=root/'node_modules'/'.bin';bin_dir.mkdir(parents=True)
            tool=bin_dir/'tsc';tool.write_text('#!/bin/sh\nexit 0\n');tool.chmod(0o755)
            self.assertEqual(local_tool(root,'tsc'),str(tool))
