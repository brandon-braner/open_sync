"""Tests for llm_provider_discovery."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from _helpers import BackendTestCase
import llm_provider_discovery


class LlmProviderDiscoveryTests(BackendTestCase):
    def _write_opencode_config(self, data: dict) -> Path:
        tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, dir=self.tmp_path
        )
        json.dump(data, tmp)
        tmp.close()
        return Path(tmp.name)

    def test_missing_config_returns_empty(self):
        missing = self.tmp_path / "nonexistent.json"
        result = llm_provider_discovery._discover_opencode(missing)
        self.assertEqual([], result)

    def test_empty_provider_block_returns_empty(self):
        path = self._write_opencode_config({"provider": {}})
        result = llm_provider_discovery._discover_opencode(path)
        self.assertEqual([], result)

    def test_no_provider_key_returns_empty(self):
        path = self._write_opencode_config({"mcp": {}, "model": "x"})
        result = llm_provider_discovery._discover_opencode(path)
        self.assertEqual([], result)

    def test_provider_with_base_url(self):
        path = self._write_opencode_config(
            {
                "provider": {
                    "lmstudio": {
                        "name": "LM Studio",
                        "npm": "@ai-sdk/openai-compatible",
                        "options": {"baseURL": "http://localhost:1234/v1"},
                    }
                }
            }
        )
        result = llm_provider_discovery._discover_opencode(path)
        self.assertEqual(1, len(result))
        p = result[0]
        self.assertEqual("LM Studio", p.name)
        self.assertEqual("lmstudio", p.provider_type)
        self.assertEqual("http://localhost:1234/v1", p.base_url)
        self.assertIsNone(p.api_key)
        self.assertEqual(["opencode"], p.sources)

    def test_provider_with_api_key(self):
        path = self._write_opencode_config(
            {
                "provider": {
                    "minimax": {
                        "options": {
                            "baseURL": "https://api.minimax.io/v1",
                            "apiKey": "sk-secret",
                        }
                    }
                }
            }
        )
        result = llm_provider_discovery._discover_opencode(path)
        self.assertEqual(1, len(result))
        p = result[0]
        self.assertEqual("minimax", p.name)  # falls back to key when no "name"
        self.assertEqual("sk-secret", p.api_key)
        self.assertEqual("https://api.minimax.io/v1", p.base_url)

    def test_api_field_as_base_url(self):
        """'api' fields that look like URLs should become base_url, not api_key."""
        path = self._write_opencode_config(
            {"provider": {"zhipuai": {"api": "https://api.z.ai/api/coding/paas/v4"}}}
        )
        result = llm_provider_discovery._discover_opencode(path)
        self.assertEqual(1, len(result))
        p = result[0]
        self.assertEqual("https://api.z.ai/api/coding/paas/v4", p.base_url)
        self.assertIsNone(p.api_key)

    def test_multiple_providers(self):
        path = self._write_opencode_config(
            {
                "provider": {
                    "google": {"models": {"gemini-pro": {"name": "Gemini Pro"}}},
                    "ollama": {
                        "name": "Ollama Local",
                        "options": {"baseURL": "http://localhost:11434/v1"},
                    },
                }
            }
        )
        result = llm_provider_discovery._discover_opencode(path)
        self.assertEqual(2, len(result))
        names = {p.provider_type for p in result}
        self.assertEqual({"google", "ollama"}, names)

    def test_discover_all_calls_opencode(self):
        """discover_all_llm_providers should include results from OpenCode."""
        fake_path = self._write_opencode_config(
            {"provider": {"myai": {"options": {"baseURL": "http://myai.local/v1"}}}}
        )
        with patch.object(llm_provider_discovery, "_OPENCODE_CONFIG_PATH", fake_path):
            result = llm_provider_discovery.discover_all_llm_providers()

        self.assertGreaterEqual(len(result), 1)
        types = {p.provider_type for p in result}
        self.assertIn("myai", types)

    # ------------------------------------------------------------------
    # Write path
    # ------------------------------------------------------------------

    def test_write_provider_to_opencode_creates_entry(self):
        from models import LlmProvider

        path = self._write_opencode_config({"theme": "dark"})
        provider = LlmProvider(
            name="LM Studio",
            provider_type="lmstudio",
            base_url="http://localhost:1234/v1",
            api_key=None,
            sources=[],
        )
        result = llm_provider_discovery._write_provider_to_opencode(provider, path)
        self.assertTrue(result["success"])

        data = json.loads(path.read_text())
        self.assertIn("lmstudio", data["provider"])
        entry = data["provider"]["lmstudio"]
        self.assertEqual("LM Studio", entry["name"])
        self.assertEqual("http://localhost:1234/v1", entry["options"]["baseURL"])
        self.assertNotIn("apiKey", entry.get("options", {}))
        # Pre-existing keys must be preserved
        self.assertEqual("dark", data["theme"])

    def test_write_omits_name_when_equal_to_key(self):
        from models import LlmProvider

        path = self._write_opencode_config({})
        provider = LlmProvider(
            name="openai",
            provider_type="openai",
            api_key="sk-test",
            base_url=None,
            sources=[],
        )
        llm_provider_discovery._write_provider_to_opencode(provider, path)
        data = json.loads(path.read_text())
        entry = data["provider"]["openai"]
        # "name" should not appear because it's the same as the key
        self.assertNotIn("name", entry)
        self.assertEqual("sk-test", entry["options"]["apiKey"])

    def test_write_updates_existing_entry(self):
        from models import LlmProvider

        path = self._write_opencode_config(
            {"provider": {"ollama": {"options": {"baseURL": "http://old/v1"}}}}
        )
        provider = LlmProvider(
            name="ollama",
            provider_type="ollama",
            base_url="http://new/v1",
            api_key=None,
            sources=[],
        )
        llm_provider_discovery._write_provider_to_opencode(provider, path)
        data = json.loads(path.read_text())
        self.assertEqual(
            "http://new/v1", data["provider"]["ollama"]["options"]["baseURL"]
        )

    def test_write_provider_to_target_unknown_returns_error(self):
        from models import LlmProvider

        provider = LlmProvider(name="x", provider_type="x", sources=[])
        result = llm_provider_discovery.write_provider_to_target(
            provider, "nonexistent"
        )
        self.assertFalse(result["success"])
        self.assertIn("nonexistent", result["message"])

    def test_list_llm_provider_targets_returns_opencode(self):
        targets = llm_provider_discovery.list_llm_provider_targets()
        ids = [t["id"] for t in targets]
        self.assertIn("opencode", ids)
