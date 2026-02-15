from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import database


class BackendTestCase(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp_path = Path(self._tmp.name)
        self._patchers = [
            patch.object(database, "DB_PATH", self.tmp_path / "opensync.db"),
            patch.object(database, "_SERVERS_JSON", self.tmp_path / "servers.json"),
            patch.object(database, "_PROJECTS_JSON", self.tmp_path / "projects.json"),
        ]
        for patcher in self._patchers:
            patcher.start()
        database.init_db()

    def tearDown(self):
        for patcher in reversed(self._patchers):
            patcher.stop()
        self._tmp.cleanup()
        super().tearDown()
