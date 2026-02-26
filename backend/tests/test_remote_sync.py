"""Tests for the remote_sync module."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from _helpers import BackendTestCase
import remote_sync
import server_registry
import skill_registry
from models import (
    Agent,
    LlmProvider,
    McpServer,
    PullRequest,
    RemoteCatalog,
    Skill,
    Workflow,
)


class RemoteServerCrudTests(BackendTestCase):
    """CRUD operations on the remote_servers table."""

    def test_add_and_list(self):
        rs = remote_sync._add_remote_server("Team Server", "http://team:8001", None)
        self.assertIsNotNone(rs.id)
        self.assertEqual("Team Server", rs.name)
        self.assertEqual("http://team:8001", rs.url)
        self.assertIsNone(rs.api_key)

        listed = remote_sync._list_remote_servers()
        self.assertEqual(1, len(listed))
        self.assertEqual(rs.id, listed[0].id)

    def test_duplicate_url_raises_conflict(self):
        from fastapi import HTTPException

        remote_sync._add_remote_server("A", "http://same:8001", None)
        with self.assertRaises(HTTPException) as ctx:
            remote_sync._add_remote_server("B", "http://same:8001", None)
        self.assertEqual(409, ctx.exception.status_code)

    def test_get_by_id(self):
        rs = remote_sync._add_remote_server("X", "http://x:8001", "secret")
        fetched = remote_sync._get_remote_server(rs.id)
        self.assertIsNotNone(fetched)
        self.assertEqual("secret", fetched.api_key)

    def test_delete(self):
        rs = remote_sync._add_remote_server("Del", "http://del:8001", None)
        self.assertTrue(remote_sync._delete_remote_server(rs.id))
        self.assertIsNone(remote_sync._get_remote_server(rs.id))
        # Second delete should return False
        self.assertFalse(remote_sync._delete_remote_server(rs.id))

    def test_url_trailing_slash_stripped(self):
        rs = remote_sync._add_remote_server("Slash", "http://slash:8001/", None)
        self.assertEqual("http://slash:8001", rs.url)


class CatalogEndpointTests(BackendTestCase):
    """Test the local catalog endpoint."""

    def test_local_catalog_returns_global_artifacts(self):
        server_registry.add_server(
            McpServer(name="srv1", command="npx", sources=[]), "global"
        )
        skill_registry.add_skill(
            Skill(name="sk1", description="d", content="c", sources=[]), "global"
        )
        catalog = remote_sync.get_local_catalog()
        server_names = [s.name for s in catalog.servers]
        skill_names = [s.name for s in catalog.skills]
        self.assertIn("srv1", server_names)
        self.assertIn("sk1", skill_names)

    def test_local_catalog_excludes_project_scope(self):
        """Project-scoped items must not appear in the shared catalog."""
        server_registry.add_server(
            McpServer(name="proj_srv", command="uvx", sources=[]),
            "project",
            "myproject",
        )
        catalog = remote_sync.get_local_catalog()
        names = [s.name for s in catalog.servers]
        self.assertNotIn("proj_srv", names)


class PullEndpointTests(BackendTestCase):
    """Test pulling artifacts from a remote into the local registry."""

    def _make_catalog(self) -> RemoteCatalog:
        return RemoteCatalog(
            servers=[
                McpServer(name="remote-srv", command="uvx", args=[], env={}, sources=[])
            ],
            skills=[
                Skill(name="remote-skill", description="d", content="c", sources=[])
            ],
            workflows=[
                Workflow(name="remote-wf", description="d", content="wf", sources=[])
            ],
            agents=[
                Agent(name="remote-agent", description="d", content="a", sources=[])
            ],
            llm_providers=[
                LlmProvider(
                    name="remote-llm", provider_type="openai", api_key="k", sources=[]
                )
            ],
        )

    def _run_async(self, coro):
        import asyncio

        return asyncio.get_event_loop().run_until_complete(coro)

    def test_pull_servers(self):
        remote = remote_sync._add_remote_server("R", "http://r:8001", None)
        catalog = self._make_catalog()

        with patch.object(
            remote_sync, "_fetch_remote_catalog", new=AsyncMock(return_value=catalog)
        ):
            result = self._run_async(
                remote_sync.pull_from_remote(
                    remote.id,
                    PullRequest(server_names=["remote-srv"], scope="global"),
                )
            )

        self.assertIn("remote-srv", result["imported"]["servers"])
        self.assertEqual(1, result["total"])

        # Verify it landed in the local registry
        local = server_registry.list_servers("global")
        self.assertTrue(any(s.name == "remote-srv" for s in local))

    def test_pull_skills_workflows_agents_providers(self):
        remote = remote_sync._add_remote_server("R2", "http://r2:8001", None)
        catalog = self._make_catalog()

        with patch.object(
            remote_sync, "_fetch_remote_catalog", new=AsyncMock(return_value=catalog)
        ):
            result = self._run_async(
                remote_sync.pull_from_remote(
                    remote.id,
                    PullRequest(
                        skill_names=["remote-skill"],
                        workflow_names=["remote-wf"],
                        agent_names=["remote-agent"],
                        llm_provider_names=["remote-llm"],
                        scope="global",
                    ),
                )
            )

        self.assertEqual(["remote-skill"], result["imported"]["skills"])
        self.assertEqual(["remote-wf"], result["imported"]["workflows"])
        self.assertEqual(["remote-agent"], result["imported"]["agents"])
        self.assertEqual(["remote-llm"], result["imported"]["llm_providers"])
        self.assertEqual(4, result["total"])

    def test_pull_unknown_artifact_is_skipped(self):
        remote = remote_sync._add_remote_server("R3", "http://r3:8001", None)
        catalog = self._make_catalog()  # has "remote-srv"

        with patch.object(
            remote_sync, "_fetch_remote_catalog", new=AsyncMock(return_value=catalog)
        ):
            result = self._run_async(
                remote_sync.pull_from_remote(
                    remote.id,
                    PullRequest(server_names=["does-not-exist"], scope="global"),
                )
            )

        self.assertEqual(0, result["total"])

    def test_pull_missing_remote_raises_404(self):
        from fastapi import HTTPException

        with self.assertRaises(HTTPException) as ctx:
            self._run_async(
                remote_sync.pull_from_remote("nonexistent-id", PullRequest())
            )
        self.assertEqual(404, ctx.exception.status_code)
