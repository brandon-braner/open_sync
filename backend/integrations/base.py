"""Base Pydantic models for AI tool integrations.

An Integration represents one AI application (editor, CLI, plugin, etc.) and
defines which feature types it supports (mcp, skill, workflow, llm) and the
config paths for each supported scope (global / project).
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ScopedConfig(BaseModel):
    """Configuration for one feature type at one scope (global or project)."""

    # Universal
    config_path: str

    # MCP-specific
    root_key: str = "mcpServers"
    format_type: str = "standard"  # standard | opencode | vscode | yaml
    nested: bool = False  # True if MCP block lives inside a larger settings file

    # Skill / Workflow-specific
    native: str = "false"  # "true" if the tool has first-class support

    # LLM-specific
    read_only: bool = False  # True if discovery-only (no write support)

    model_config = {"extra": "forbid"}


class Integration(BaseModel):
    """Describes a single AI application across all feature types and scopes."""

    id: str
    display_name: str
    color: str = "#888888"
    category: str = "editor"  # editor | desktop | cli | plugin

    # Feature-support flags — set to False to hide from the corresponding page
    # even when config dicts are populated.
    mcp_support: bool = True
    skill_support: bool = True
    workflow_support: bool = True
    llm_support: bool = True
    agent_support: bool = True

    # Each dict maps scope string ("global" or "project") → ScopedConfig.
    # Omitting a key means the tool is hidden from that page.
    mcp: dict[str, ScopedConfig] = Field(default_factory=dict)
    skill: dict[str, ScopedConfig] = Field(default_factory=dict)
    workflow: dict[str, ScopedConfig] = Field(default_factory=dict)
    llm: dict[str, ScopedConfig] = Field(default_factory=dict)
    agent: dict[str, ScopedConfig] = Field(default_factory=dict)

    model_config = {"extra": "forbid"}

    # ------------------------------------------------------------------
    # Derived flat-dict helpers (used by unified_targets accessor fns)
    # ------------------------------------------------------------------

    def mcp_dicts(self) -> list[dict[str, Any]]:
        if not self.mcp_support:
            return []
        result = []
        for scope, cfg in self.mcp.items():
            result.append(
                {
                    "name": f"{self.id}_{scope}",
                    "display_name": self.display_name,
                    "config_path": cfg.config_path,
                    "root_key": cfg.root_key,
                    "scope": scope,
                    "format_type": cfg.format_type,
                    "color": self.color,
                    "nested": cfg.nested,
                    "base_target": self.id,
                    "category": self.category,
                }
            )
        return result

    def skill_dicts(self) -> list[dict[str, Any]]:
        if not self.skill_support:
            return []
        return [
            {
                "id": f"{self.id}_{scope}",
                "display_name": self.display_name,
                "config_path": cfg.config_path,
                "scope": scope,
                "color": self.color,
                "native": cfg.native,
                "category": self.category,
            }
            for scope, cfg in self.skill.items()
        ]

    def workflow_dicts(self) -> list[dict[str, Any]]:
        if not self.workflow_support:
            return []
        return [
            {
                "id": f"{self.id}_{scope}",
                "display_name": self.display_name,
                "config_path": cfg.config_path,
                "scope": scope,
                "color": self.color,
                "native": cfg.native,
                "category": self.category,
            }
            for scope, cfg in self.workflow.items()
        ]

    def llm_dicts(self) -> list[dict[str, Any]]:
        if not self.llm_support:
            return []
        return [
            {
                "id": f"{self.id}_{scope}",
                "display_name": self.display_name
                + (" (read-only)" if cfg.read_only else ""),
                "config_path": cfg.config_path,
                "scope": scope,
                "color": self.color,
                "category": self.category,
            }
            for scope, cfg in self.llm.items()
        ]

    def agent_dicts(self) -> list[dict[str, Any]]:
        if not self.agent_support:
            return []
        return [
            {
                "id": f"{self.id}_{scope}",
                "display_name": self.display_name,
                "config_path": cfg.config_path,
                "scope": scope,
                "color": self.color,
                "native": cfg.native,
                "category": self.category,
            }
            for scope, cfg in self.agent.items()
        ]
