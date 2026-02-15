from __future__ import annotations

from _helpers import BackendTestCase
from models import McpServer
import server_registry


class ServerRegistryTests(BackendTestCase):
    def test_add_list_get_and_remove_global_server(self):
        saved = server_registry.add_server(
            McpServer(name="demo", command="uvx", args=["mcp"], sources=[])
        )

        fetched = server_registry.get_server("demo")
        self.assertIsNotNone(fetched)
        self.assertEqual(saved.id, fetched.id)
        self.assertEqual(["opensync"], fetched.sources)
        self.assertEqual(1, len(server_registry.list_servers()))

        removed = server_registry.remove_server("demo")
        self.assertTrue(removed)
        self.assertIsNone(server_registry.get_server("demo"))

    def test_add_server_updates_existing_record_in_same_scope(self):
        first = server_registry.add_server(McpServer(name="demo", command="one", sources=[]))
        second = server_registry.add_server(
            McpServer(name="demo", command="two", args=["--x"], sources=[])
        )

        self.assertEqual(first.id, second.id)
        self.assertEqual("two", server_registry.get_server("demo").command)
        self.assertEqual(1, len(server_registry.list_servers()))

    def test_project_scope_isolated_and_rename_works_by_id(self):
        global_srv = server_registry.add_server(
            McpServer(name="same", command="global", sources=[])
        )
        project_srv = server_registry.add_server(
            McpServer(name="same", command="project", sources=[]),
            scope="project",
            project="alpha",
        )

        self.assertNotEqual(global_srv.id, project_srv.id)
        self.assertEqual("project", server_registry.get_server("same", "project", "alpha").command)

        renamed = server_registry.rename_server(project_srv.id, "renamed")
        self.assertIsNotNone(renamed)
        self.assertEqual("renamed", renamed.name)
        self.assertIsNone(server_registry.get_server("same", "project", "alpha"))
