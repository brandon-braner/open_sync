"""Tests for llm_provider_discovery — all agents."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from _helpers import BackendTestCase
import llm_provider_discovery


# ---------------------------------------------------------------------------
# Helper: write a YAML config file (used by Continue / Aider tests)
# ---------------------------------------------------------------------------


def _write_yaml_file(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


# ===========================================================================
# OpenCode tests (unchanged, kept for regression)
# ===========================================================================


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
        self.assertEqual("minimax", p.name)
        self.assertEqual("sk-secret", p.api_key)
        self.assertEqual("https://api.minimax.io/v1", p.base_url)

    def test_api_field_as_base_url(self):
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
        fake_path = self._write_opencode_config(
            {"provider": {"myai": {"options": {"baseURL": "http://myai.local/v1"}}}}
        )
        with patch.object(llm_provider_discovery, "_OPENCODE_CONFIG_PATH", fake_path):
            result = llm_provider_discovery.discover_all_llm_providers()

        self.assertGreaterEqual(len(result), 1)
        types = {p.provider_type for p in result}
        self.assertIn("myai", types)

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
        self.assertIn("opencode_global", ids)


# ===========================================================================
# Continue tests
# ===========================================================================


class ContinueDiscoveryTests(BackendTestCase):
    """Tests for _discover_continue / _write_provider_to_continue."""

    def _yaml_path(self, text: str) -> Path:
        p = self.tmp_path / "config.yaml"
        _write_yaml_file(p, text)
        return p

    def test_missing_config_returns_empty(self):
        missing = self.tmp_path / "nonexistent.yaml"
        result = llm_provider_discovery._discover_continue(missing)
        self.assertEqual([], result)

    def test_empty_models_returns_empty(self):
        p = self._yaml_path("models: []")
        result = llm_provider_discovery._discover_continue(p)
        self.assertEqual([], result)

    def test_no_models_key_returns_empty(self):
        p = self._yaml_path("theme: dark")
        result = llm_provider_discovery._discover_continue(p)
        self.assertEqual([], result)

    def test_model_with_api_key(self):
        p = self._yaml_path(
            "models:\n"
            "  - provider: anthropic\n"
            "    title: Claude 3\n"
            "    apiKey: sk-ant-test\n"
        )
        result = llm_provider_discovery._discover_continue(p)
        self.assertEqual(1, len(result))
        pr = result[0]
        self.assertEqual("Claude 3", pr.name)
        self.assertEqual("anthropic", pr.provider_type)
        self.assertEqual("sk-ant-test", pr.api_key)
        self.assertIsNone(pr.base_url)
        self.assertEqual(["continue"], pr.sources)

    def test_model_with_base_url(self):
        p = self._yaml_path(
            "models:\n"
            "  - provider: ollama\n"
            "    title: Ollama\n"
            "    apiBase: http://localhost:11434\n"
        )
        result = llm_provider_discovery._discover_continue(p)
        self.assertEqual(1, len(result))
        pr = result[0]
        self.assertEqual("http://localhost:11434", pr.base_url)
        self.assertIsNone(pr.api_key)

    def test_multiple_models(self):
        p = self._yaml_path(
            "models:\n"
            "  - provider: openai\n"
            "    title: GPT-4\n"
            "    apiKey: sk-openai\n"
            "  - provider: anthropic\n"
            "    title: Claude\n"
            "    apiKey: sk-ant\n"
        )
        result = llm_provider_discovery._discover_continue(p)
        self.assertEqual(2, len(result))
        types = {pr.provider_type for pr in result}
        self.assertEqual({"openai", "anthropic"}, types)

    def test_write_creates_model_entry(self):
        from models import LlmProvider

        p = self._yaml_path("theme: dark")
        provider = LlmProvider(
            name="GPT-4",
            provider_type="openai",
            api_key="sk-test",
            base_url=None,
            sources=[],
        )
        result = llm_provider_discovery._write_provider_to_continue(provider, p)
        self.assertTrue(result["success"])
        import yaml

        data = yaml.safe_load(p.read_text())
        self.assertIn("models", data)
        entries = [m for m in data["models"] if m.get("provider") == "openai"]
        self.assertEqual(1, len(entries))
        self.assertEqual("sk-test", entries[0]["apiKey"])
        # Pre-existing keys preserved
        self.assertEqual("dark", data["theme"])

    def test_write_updates_existing_entry(self):
        from models import LlmProvider

        p = self._yaml_path(
            "models:\n  - provider: openai\n    title: GPT-4\n    apiKey: sk-old\n"
        )
        provider = LlmProvider(
            name="GPT-4o",
            provider_type="openai",
            api_key="sk-new",
            sources=[],
        )
        llm_provider_discovery._write_provider_to_continue(provider, p)
        import yaml

        data = yaml.safe_load(p.read_text())
        entries = [m for m in data["models"] if m.get("provider") == "openai"]
        self.assertEqual(1, len(entries))
        self.assertEqual("sk-new", entries[0]["apiKey"])


# ===========================================================================
# Aider tests
# ===========================================================================


class AiderDiscoveryTests(BackendTestCase):
    def _yaml_path(self, text: str) -> Path:
        p = self.tmp_path / ".aider.conf.yml"
        _write_yaml_file(p, text)
        return p

    def test_missing_config_returns_empty(self):
        missing = self.tmp_path / "nonexistent.yml"
        result = llm_provider_discovery._discover_aider(missing)
        self.assertEqual([], result)

    def test_empty_config_returns_empty(self):
        p = self._yaml_path("")
        result = llm_provider_discovery._discover_aider(p)
        self.assertEqual([], result)

    def test_no_relevant_keys_returns_empty(self):
        p = self._yaml_path("dark-mode: true\n")
        result = llm_provider_discovery._discover_aider(p)
        self.assertEqual([], result)

    def test_api_key_discovered(self):
        p = self._yaml_path("openai-api-key: sk-aider-test\n")
        result = llm_provider_discovery._discover_aider(p)
        self.assertEqual(1, len(result))
        pr = result[0]
        self.assertEqual("sk-aider-test", pr.api_key)
        self.assertEqual("openai", pr.provider_type)
        self.assertEqual(["aider"], pr.sources)

    def test_base_url_discovered(self):
        p = self._yaml_path("openai-api-base: http://localhost:8080/v1\n")
        result = llm_provider_discovery._discover_aider(p)
        self.assertEqual(1, len(result))
        self.assertEqual("http://localhost:8080/v1", result[0].base_url)

    def test_model_used_as_name(self):
        p = self._yaml_path("openai-api-key: sk-x\nmodel: gpt-4-turbo\n")
        result = llm_provider_discovery._discover_aider(p)
        self.assertEqual("gpt-4-turbo", result[0].name)

    def test_write_creates_entry(self):
        from models import LlmProvider

        p = self._yaml_path("dark-mode: true\n")
        provider = LlmProvider(
            name="gpt-4",
            provider_type="openai",
            api_key="sk-write-test",
            base_url="http://proxy/v1",
            sources=[],
        )
        result = llm_provider_discovery._write_provider_to_aider(provider, p)
        self.assertTrue(result["success"])
        import yaml

        data = yaml.safe_load(p.read_text())
        self.assertEqual("sk-write-test", data["openai-api-key"])
        self.assertEqual("http://proxy/v1", data["openai-api-base"])
        self.assertEqual("gpt-4", data["model"])
        # Pre-existing key preserved
        self.assertTrue(data["dark-mode"])

    def test_list_targets_includes_aider(self):
        targets = llm_provider_discovery.list_llm_provider_targets()
        ids = [t["id"] for t in targets]
        self.assertIn("aider_global", ids)


# ===========================================================================
# Claude Code tests
# ===========================================================================


class ClaudeCodeDiscoveryTests(BackendTestCase):
    def _json_path(self, data: dict) -> Path:
        p = self.tmp_path / ".claude.json"
        p.write_text(json.dumps(data), encoding="utf-8")
        return p

    def test_missing_config_returns_empty(self):
        missing = self.tmp_path / "nonexistent.json"
        result = llm_provider_discovery._discover_claude_code(missing)
        self.assertEqual([], result)

    def test_no_providers_key_returns_empty(self):
        p = self._json_path({"theme": "dark"})
        result = llm_provider_discovery._discover_claude_code(p)
        self.assertEqual([], result)

    def test_empty_providers_returns_empty(self):
        p = self._json_path({"providers": {}})
        result = llm_provider_discovery._discover_claude_code(p)
        self.assertEqual([], result)

    def test_provider_discovered(self):
        p = self._json_path(
            {
                "providers": {
                    "openai": {
                        "apiKey": "sk-claude-test",
                        "baseURL": "https://api.openai.com/v1",
                    }
                }
            }
        )
        result = llm_provider_discovery._discover_claude_code(p)
        self.assertEqual(1, len(result))
        pr = result[0]
        self.assertEqual("openai", pr.provider_type)
        self.assertEqual("sk-claude-test", pr.api_key)
        self.assertEqual(["claude_code"], pr.sources)

    def test_write_creates_entry(self):
        from models import LlmProvider

        p = self._json_path({"theme": "dark"})
        provider = LlmProvider(
            name="Anthropic",
            provider_type="anthropic",
            api_key="sk-ant",
            sources=[],
        )
        result = llm_provider_discovery._write_provider_to_claude_code(provider, p)
        self.assertTrue(result["success"])
        data = json.loads(p.read_text())
        self.assertIn("anthropic", data["providers"])
        self.assertEqual("sk-ant", data["providers"]["anthropic"]["apiKey"])
        self.assertEqual("dark", data["theme"])

    def test_write_updates_existing(self):
        from models import LlmProvider

        p = self._json_path({"providers": {"openai": {"apiKey": "sk-old"}}})
        provider = LlmProvider(
            name="openai", provider_type="openai", api_key="sk-new", sources=[]
        )
        llm_provider_discovery._write_provider_to_claude_code(provider, p)
        data = json.loads(p.read_text())
        self.assertEqual("sk-new", data["providers"]["openai"]["apiKey"])

    def test_list_targets_includes_claude_code(self):
        ids = [t["id"] for t in llm_provider_discovery.list_llm_provider_targets()]
        self.assertIn("claude_code_global", ids)


# ===========================================================================
# Roo Code / Cline tests
# ===========================================================================


class RooClineDiscoveryTests(BackendTestCase):
    def _settings_path(self, data: dict) -> Path:
        p = self.tmp_path / "settings.json"
        p.write_text(json.dumps(data), encoding="utf-8")
        return p

    def test_missing_config_returns_empty(self):
        missing = self.tmp_path / "nonexistent.json"
        result = llm_provider_discovery._discover_roo_cline(missing)
        self.assertEqual([], result)

    def test_no_cline_keys_returns_empty(self):
        p = self._settings_path({"editor.fontSize": 14})
        result = llm_provider_discovery._discover_roo_cline(p)
        self.assertEqual([], result)

    def test_cline_api_key_discovered(self):
        p = self._settings_path(
            {
                "cline.apiKey": "sk-cline-test",
                "cline.apiProvider": "openai",
            }
        )
        result = llm_provider_discovery._discover_roo_cline(p)
        self.assertEqual(1, len(result))
        pr = result[0]
        self.assertEqual("sk-cline-test", pr.api_key)
        self.assertEqual("openai", pr.provider_type)
        self.assertEqual(["roo_cline"], pr.sources)

    def test_roo_cline_prefix_discovered(self):
        p = self._settings_path(
            {
                "roo-cline.apiKey": "sk-roo-test",
                "roo-cline.apiProvider": "anthropic",
            }
        )
        result = llm_provider_discovery._discover_roo_cline(p)
        self.assertEqual(1, len(result))
        self.assertEqual("sk-roo-test", result[0].api_key)

    def test_base_url_discovered(self):
        p = self._settings_path(
            {
                "cline.openAiBaseUrl": "http://proxy/v1",
                "cline.apiKey": "sk-x",
            }
        )
        result = llm_provider_discovery._discover_roo_cline(p)
        self.assertEqual("http://proxy/v1", result[0].base_url)

    def test_write_creates_cline_keys(self):
        from models import LlmProvider

        p = self._settings_path({"editor.fontSize": 14})
        provider = LlmProvider(
            name="openai",
            provider_type="openai",
            api_key="sk-write",
            base_url="http://proxy/v1",
            sources=[],
        )
        result = llm_provider_discovery._write_provider_to_roo_cline(provider, p)
        self.assertTrue(result["success"])
        data = json.loads(p.read_text())
        self.assertEqual("openai", data["cline.apiProvider"])
        self.assertEqual("sk-write", data["cline.apiKey"])
        self.assertEqual("http://proxy/v1", data["cline.openAiBaseUrl"])
        self.assertEqual(14, data["editor.fontSize"])

    def test_list_targets_includes_roo_cline(self):
        ids = [t["id"] for t in llm_provider_discovery.list_llm_provider_targets()]
        self.assertIn("roo_cline_global", ids)


# ===========================================================================
# Windsurf tests
# ===========================================================================


class WindsurfDiscoveryTests(BackendTestCase):
    def _json_path(self, data: dict) -> Path:
        p = self.tmp_path / "mcp_settings.json"
        p.write_text(json.dumps(data), encoding="utf-8")
        return p

    def test_missing_config_returns_empty(self):
        missing = self.tmp_path / "nonexistent.json"
        result = llm_provider_discovery._discover_windsurf(missing)
        self.assertEqual([], result)

    def test_no_ai_providers_key_returns_empty(self):
        p = self._json_path({"mcpServers": {}})
        result = llm_provider_discovery._discover_windsurf(p)
        self.assertEqual([], result)

    def test_ai_providers_discovered(self):
        p = self._json_path(
            {
                "aiProviders": {
                    "openai": {
                        "apiKey": "sk-wind-test",
                        "baseURL": "https://api.openai.com/v1",
                    }
                }
            }
        )
        result = llm_provider_discovery._discover_windsurf(p)
        self.assertEqual(1, len(result))
        pr = result[0]
        self.assertEqual("openai", pr.provider_type)
        self.assertEqual("sk-wind-test", pr.api_key)
        self.assertEqual(["windsurf"], pr.sources)

    def test_providers_key_fallback(self):
        p = self._json_path({"providers": {"anthropic": {"apiKey": "sk-wind-ant"}}})
        result = llm_provider_discovery._discover_windsurf(p)
        self.assertEqual(1, len(result))
        self.assertEqual("anthropic", result[0].provider_type)

    def test_write_creates_ai_providers_entry(self):
        from models import LlmProvider

        p = self._json_path({"mcpServers": {}})
        provider = LlmProvider(
            name="openai",
            provider_type="openai",
            api_key="sk-write",
            sources=[],
        )
        result = llm_provider_discovery._write_provider_to_windsurf(provider, p)
        self.assertTrue(result["success"])
        data = json.loads(p.read_text())
        self.assertIn("openai", data["aiProviders"])
        self.assertEqual("sk-write", data["aiProviders"]["openai"]["apiKey"])
        # Pre-existing key preserved
        self.assertIn("mcpServers", data)

    def test_list_targets_includes_windsurf(self):
        ids = [t["id"] for t in llm_provider_discovery.list_llm_provider_targets()]
        self.assertIn("windsurf_global", ids)


# ===========================================================================
# Plandex tests
# ===========================================================================


class PlandexDiscoveryTests(BackendTestCase):
    def test_missing_directory_returns_empty(self):
        missing = self.tmp_path / "nonexistent_dir"
        result = llm_provider_discovery._discover_plandex(missing)
        self.assertEqual([], result)

    def test_empty_directory_returns_empty(self):
        d = self.tmp_path / "plandex"
        d.mkdir()
        result = llm_provider_discovery._discover_plandex(d)
        self.assertEqual([], result)

    def test_json_without_keys_returns_empty(self):
        d = self.tmp_path / "plandex"
        d.mkdir()
        (d / "config.json").write_text(json.dumps({"theme": "dark"}))
        result = llm_provider_discovery._discover_plandex(d)
        self.assertEqual([], result)

    def test_json_with_api_key_discovered(self):
        d = self.tmp_path / "plandex"
        d.mkdir()
        (d / "provider.json").write_text(
            json.dumps(
                {
                    "provider": "openai",
                    "apiKey": "sk-plandex-test",
                    "openAIBase": "https://api.openai.com/v1",
                }
            )
        )
        result = llm_provider_discovery._discover_plandex(d)
        self.assertEqual(1, len(result))
        pr = result[0]
        self.assertEqual("openai", pr.provider_type)
        self.assertEqual("sk-plandex-test", pr.api_key)
        self.assertEqual("https://api.openai.com/v1", pr.base_url)
        self.assertEqual(["plandex"], pr.sources)

    def test_write_creates_json_file(self):
        from models import LlmProvider

        d = self.tmp_path / "plandex"
        provider = LlmProvider(
            name="openai",
            provider_type="openai",
            api_key="sk-write",
            base_url="https://api.openai.com/v1",
            sources=[],
        )
        result = llm_provider_discovery._write_provider_to_plandex(provider, d)
        self.assertTrue(result["success"])
        data = json.loads((d / "openai.json").read_text())
        self.assertEqual("sk-write", data["apiKey"])
        self.assertEqual("https://api.openai.com/v1", data["openAIBase"])

    def test_list_targets_includes_plandex(self):
        ids = [t["id"] for t in llm_provider_discovery.list_llm_provider_targets()]
        self.assertIn("plandex_global", ids)


# ===========================================================================
# Gemini CLI tests
# ===========================================================================


class GeminiCliDiscoveryTests(BackendTestCase):
    def _json_path(self, data: dict) -> Path:
        p = self.tmp_path / "settings.json"
        p.write_text(json.dumps(data), encoding="utf-8")
        return p

    def test_missing_config_returns_empty(self):
        missing = self.tmp_path / "nonexistent.json"
        result = llm_provider_discovery._discover_gemini_cli(missing)
        self.assertEqual([], result)

    def test_no_model_key_returns_empty(self):
        p = self._json_path({"theme": "dark"})
        result = llm_provider_discovery._discover_gemini_cli(p)
        self.assertEqual([], result)

    def test_model_discovered(self):
        p = self._json_path({"model": "gemini-2.0-flash"})
        result = llm_provider_discovery._discover_gemini_cli(p)
        self.assertEqual(1, len(result))
        pr = result[0]
        self.assertEqual("gemini-2.0-flash", pr.name)
        self.assertEqual("google", pr.provider_type)
        self.assertIsNone(pr.api_key)  # No API key in file
        self.assertEqual(["gemini_cli"], pr.sources)

    def test_write_sets_model(self):
        from models import LlmProvider

        p = self._json_path({"theme": "dark"})
        provider = LlmProvider(
            name="gemini-2.0-pro",
            provider_type="google",
            sources=[],
        )
        result = llm_provider_discovery._write_provider_to_gemini_cli(provider, p)
        self.assertTrue(result["success"])
        data = json.loads(p.read_text())
        self.assertEqual("gemini-2.0-pro", data["model"])
        self.assertEqual("dark", data["theme"])

    def test_list_targets_includes_gemini_cli(self):
        ids = [t["id"] for t in llm_provider_discovery.list_llm_provider_targets()]
        self.assertIn("gemini_cli_global", ids)


# ===========================================================================
# Amp tests
# ===========================================================================


class AmpDiscoveryTests(BackendTestCase):
    def _json_path(self, data: dict) -> Path:
        p = self.tmp_path / "settings.json"
        p.write_text(json.dumps(data), encoding="utf-8")
        return p

    def test_missing_config_returns_empty(self):
        missing = self.tmp_path / "nonexistent.json"
        result = llm_provider_discovery._discover_amp(missing)
        self.assertEqual([], result)

    def test_empty_config_returns_empty(self):
        p = self._json_path({})
        result = llm_provider_discovery._discover_amp(p)
        self.assertEqual([], result)

    def test_model_block_discovered(self):
        p = self._json_path(
            {
                "model": {
                    "provider": "anthropic",
                    "model": "claude-3-5-sonnet",
                    "apiKey": "sk-amp-test",
                }
            }
        )
        result = llm_provider_discovery._discover_amp(p)
        self.assertEqual(1, len(result))
        pr = result[0]
        self.assertEqual("anthropic", pr.provider_type)
        self.assertEqual("claude-3-5-sonnet", pr.name)
        self.assertEqual("sk-amp-test", pr.api_key)
        self.assertEqual(["amp"], pr.sources)

    def test_write_creates_model_entry(self):
        from models import LlmProvider

        p = self._json_path({"theme": "dark"})
        provider = LlmProvider(
            name="claude-3-opus",
            provider_type="anthropic",
            api_key="sk-write",
            base_url=None,
            sources=[],
        )
        result = llm_provider_discovery._write_provider_to_amp(provider, p)
        self.assertTrue(result["success"])
        data = json.loads(p.read_text())
        self.assertEqual("anthropic", data["model"]["provider"])
        self.assertEqual("claude-3-opus", data["model"]["model"])
        self.assertEqual("sk-write", data["model"]["apiKey"])
        self.assertEqual("dark", data["theme"])

    def test_list_targets_includes_amp(self):
        ids = [t["id"] for t in llm_provider_discovery.list_llm_provider_targets()]
        self.assertIn("amp_global", ids)


# ===========================================================================
# Cursor tests
# ===========================================================================


class CursorDiscoveryTests(BackendTestCase):
    def test_missing_db_returns_empty(self):
        missing = self.tmp_path / "nonexistent.vscdb"
        result = llm_provider_discovery._discover_cursor(missing)
        self.assertEqual([], result)

    def test_sqlite_db_with_keys_discovered(self):
        import sqlite3

        db_path = self.tmp_path / "state.vscdb"
        with sqlite3.connect(str(db_path)) as conn:
            conn.execute("CREATE TABLE itemTable (key TEXT PRIMARY KEY, value TEXT)")
            conn.execute(
                "INSERT INTO itemTable VALUES (?, ?)",
                ("openAIAPIKey", "sk-cursor-test"),
            )
            conn.commit()

        result = llm_provider_discovery._discover_cursor(db_path)
        self.assertEqual(1, len(result))
        pr = result[0]
        self.assertEqual("sk-cursor-test", pr.api_key)
        self.assertEqual("openai", pr.provider_type)
        self.assertEqual(["cursor"], pr.sources)

    def test_cursor_write_returns_error(self):
        from models import LlmProvider

        provider = LlmProvider(name="openai", provider_type="openai", sources=[])
        result = llm_provider_discovery.write_provider_to_target(provider, "cursor")
        self.assertFalse(result["success"])
        self.assertIn("read-only", result["message"])

    def test_list_targets_includes_cursor(self):
        ids = [t["id"] for t in llm_provider_discovery.list_llm_provider_targets()]
        self.assertIn("cursor_global", ids)


# ===========================================================================
# Dispatcher tests
# ===========================================================================


class DispatcherTests(BackendTestCase):
    """Test write_provider_to_target for all agent IDs."""

    def _provider(self):
        from models import LlmProvider

        return LlmProvider(
            name="openai",
            provider_type="openai",
            api_key="sk-test",
            base_url=None,
            sources=[],
        )

    def test_unknown_target_returns_error(self):
        result = llm_provider_discovery.write_provider_to_target(
            self._provider(), "totally_unknown"
        )
        self.assertFalse(result["success"])

    def test_cursor_target_returns_read_only_error(self):
        result = llm_provider_discovery.write_provider_to_target(
            self._provider(), "cursor"
        )
        self.assertFalse(result["success"])
        self.assertIn("read-only", result["message"])

    def test_opencode_project_without_path_returns_error(self):
        result = llm_provider_discovery.write_provider_to_target(
            self._provider(), "opencode_project", project_path=None
        )
        self.assertFalse(result["success"])

    def test_all_target_ids_are_in_targets_list(self):
        """Every target registered in LLM_PROVIDER_TARGETS should be handled."""
        targets = llm_provider_discovery.list_llm_provider_targets()
        ids = {t["id"] for t in targets}
        expected = {
            "opencode_global",
            "opencode_project",
            "aider_global",
            "aider_project",
            "claude_code_global",
            "claude_code_project",
            "roo_cline_global",
            "roo_cline_project",
            "windsurf_global",
            "windsurf_project",
            "plandex_global",
            "plandex_project",
            "gemini_cli_global",
            "gemini_cli_project",
            "amp_global",
            "cursor_global",
        }
        self.assertEqual(expected, ids)
