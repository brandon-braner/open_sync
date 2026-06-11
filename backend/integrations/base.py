"""Manifest models for AI tool integrations.

An Integration describes one AI application (editor, CLI, desktop app, …).
For every entity kind it supports (mcp / skill / command / subagent / llm)
and every scope (global / project) it declares an EntityTarget: where the
config lives and which format handler reads/writes it.

Everything else in OpenSync — discovery, import, sync, status, and the
frontend target lists — is derived from these manifests. There must be no
other per-tool path or format knowledge anywhere in the codebase.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

EntityKind = Literal["mcp", "skill", "command", "subagent", "llm"]
Scope = Literal["global", "project"]

ENTITY_KINDS: tuple[str, ...] = ("mcp", "skill", "command", "subagent", "llm")
SCOPES: tuple[str, ...] = ("global", "project")


class EntityTarget(BaseModel):
    """One (entity kind, scope) surface of one integration."""

    # Global paths start with '~'; project paths are relative to the project
    # directory. Files end in an extension, directories end in '/'.
    path: str

    # Key into engine.handlers.HANDLERS.
    handler: str

    # Handler-specific options (root_key, style, suffix, frontmatter, table…).
    options: dict[str, Any] = Field(default_factory=dict)

    # native    – first-class support, read + write
    # fallback  – works, but via a compatibility mechanism
    # read_only – discovery only, sync disabled
    # legacy    – still works but deprecated by the tool; hidden by default
    capability: Literal["native", "fallback", "read_only", "legacy"] = "native"

    # Additional locations scanned during discovery only (legacy dirs,
    # shared cross-tool dirs). Same handler/options as `path`.
    read_paths: list[str] = Field(default_factory=list)

    # Instruction files that may contain v1 OPENSYNC marker blocks; they are
    # cleaned up when this target is synced (skills used to be injected into
    # CLAUDE.md-style files between HTML comment markers).
    legacy_marker_paths: list[str] = Field(default_factory=list)

    # Per-OS overrides for `path`, keyed by sys.platform-style name
    # ("linux", "win32"). Default `path` is the macOS location.
    os_paths: dict[str, str] = Field(default_factory=dict)

    # Caveat surfaced in the UI (e.g. "User Rules are settings-UI only").
    notes: str = ""

    model_config = {"extra": "forbid"}


class Integration(BaseModel):
    """Describes a single AI application across all entity kinds and scopes."""

    id: str
    display_name: str
    color: str = "#888888"
    category: Literal["editor", "desktop", "cli", "cloud", "plugin"] = "editor"
    docs_url: str = ""

    # kind -> scope -> target. An omitted kind or scope means "unsupported".
    targets: dict[EntityKind, dict[Scope, EntityTarget]] = Field(default_factory=dict)

    # Integration-level caveats shown in the UI.
    notes: str = ""

    model_config = {"extra": "forbid"}

    def target_for(self, kind: EntityKind, scope: Scope) -> EntityTarget | None:
        return self.targets.get(kind, {}).get(scope)

    def supports(self, kind: EntityKind, scope: Scope | None = None) -> bool:
        if kind not in self.targets:
            return False
        return scope is None or scope in self.targets[kind]
