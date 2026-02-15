from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

from _helpers import BackendTestCase
from config_manager import (
    backup_config,
    read_target_servers,
    remove_server_from_target,
    rename_server_in_target,
    sync_servers,
    write_servers_to_target,
)
from config_targets import Scope, TargetConfig
from models import McpServer


class ConfigManagerTests(BackendTestCase):
    def setUp(self):
        super().setUp()
        self.target = TargetConfig(
            name="test_target",
            display_name="Test Target",
            config_path=str(self.tmp_path / "test-target.json"),
            root_key="mcpServers",
            scope=Scope.GLOBAL,
        )

    def test_write_read_remove_and_rename_server(self):
        server = McpServer(name="demo", command="uvx", args=["pkg"], sources=[])
        result = write_servers_to_target(self.target, [server], create_backup=False)
        self.assertTrue(result.success)

        servers = read_target_servers(self.target)
        self.assertIn("demo", servers)
        self.assertEqual("uvx", servers["demo"].command)

        renamed = rename_server_in_target(self.target, "demo", "renamed")
        self.assertTrue(renamed.success)
        self.assertIn("renamed", read_target_servers(self.target))

        removed = remove_server_from_target(self.target, "renamed")
        self.assertTrue(removed.success)
        self.assertNotIn("renamed", read_target_servers(self.target))

    def test_backup_config_creates_timestamped_copy(self):
        Path(self.target.config_path).write_text('{"mcpServers":{}}', encoding="utf-8")
        backup_path = backup_config(self.target)
        self.assertIsNotNone(backup_path)
        self.assertTrue(Path(backup_path).exists())

    def test_sync_servers_handles_unknown_targets(self):
        server = McpServer(name="demo", command="uvx", args=["pkg"], sources=[])
        with (
            patch("config_manager.discover_all_servers", return_value={"demo": server}),
            patch(
                "config_manager.get_target",
                side_effect=lambda name: self.target if name == "test_target" else None,
            ),
        ):
            results, backups = sync_servers(["demo"], ["test_target", "missing"])

        self.assertEqual(2, len(results))
        self.assertTrue(results[0].success)
        self.assertFalse(results[1].success)
        self.assertEqual("missing", results[1].target)
        self.assertEqual({}, backups)
