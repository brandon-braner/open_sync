from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from _helpers import BackendTestCase
import api
import project_registry
import server_registry
from config_targets import Scope
from models import AddServerRequest, ImportServerRequest, McpServer, SyncRequest


class ApiTests(BackendTestCase):
    def test_parse_scope_validation(self):
        self.assertEqual(Scope.GLOBAL, api._parse_scope("global"))
        with self.assertRaises(HTTPException):
            api._parse_scope("bad")

    def test_resolve_project_dir_validation(self):
        with self.assertRaises(HTTPException):
            api._resolve_project_dir(None, Scope.PROJECT)
        with self.assertRaises(HTTPException):
            api._resolve_project_dir(str(self.tmp_path / "missing"), Scope.PROJECT)

        project_dir = self.tmp_path / "proj"
        project_dir.mkdir()
        resolved = api._resolve_project_dir(str(project_dir), Scope.PROJECT)
        self.assertEqual(str(project_dir.resolve()), resolved)
        self.assertIsNone(api._resolve_project_dir(None, Scope.GLOBAL))

    def test_registry_crud_and_import(self):
        created = api.add_registry_server(
            AddServerRequest(name="demo", command="uvx", args=["pkg"])
        )
        listed = api.list_registry_servers()
        self.assertEqual(1, len(listed))
        self.assertEqual(created.id, listed[0].id)

        project_dir = self.tmp_path / "project"
        project_dir.mkdir()
        project_registry.add_project("alpha", str(project_dir))
        imported = api.import_from_global(
            ImportServerRequest(server_name="demo", project_name="alpha")
        )
        self.assertNotEqual(created.id, imported.id)

        message = api.remove_registry_server(created.id)
        self.assertIn("removed from registry", message["message"])

    def test_list_servers_merges_discovered_and_registry(self):
        reg = server_registry.add_server(McpServer(name="registry", command="uvx", sources=[]))
        discovered = {"found": McpServer(name="found", command="npx", sources=["cursor"])}

        with patch("api.discover_all_servers", return_value=discovered):
            servers = api.list_servers(scope="global", project_path=None)

        names = sorted(s.name for s in servers)
        self.assertEqual(["found", "registry"], names)
        merged_reg = next(s for s in servers if s.name == "registry")
        self.assertEqual(reg.id, merged_reg.id)

    def test_sync_reports_unknown_target(self):
        request = SyncRequest(server_names=["missing"], target_names=["unknown"])
        response = api.do_sync(request)
        self.assertEqual(1, len(response.results))
        self.assertFalse(response.results[0].success)
        self.assertEqual("unknown", response.results[0].target)
