"""Pydantic models for OpenSync.

Canonical entity models describe what an item *is*, independent of any
tool's on-disk format. Format handlers translate between these models and
each integration's config files.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Canonical entity models (stored in the `entities` table; `data` column
# holds the kind-specific fields, `content` the markdown body)
# ---------------------------------------------------------------------------


class McpServer(BaseModel):
    """Canonical representation of an MCP server."""

    name: str
    command: Optional[str] = None
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    type: Optional[str] = None  # stdio | http | sse | local | remote
    url: Optional[str] = None
    headers: dict[str, str] = Field(default_factory=dict)


class SkillFile(BaseModel):
    """A supporting file bundled in a skill folder (script, reference, asset).

    UTF-8 files are stored as text; anything else is base64-encoded.
    `executable` records whether the file should keep its executable bit
    when synced to disk (e.g. shell/python scripts with a shebang).
    """

    encoding: str = "text"  # text | base64
    data: str = ""
    executable: bool = False


class SkillEntity(BaseModel):
    """Agent Skill — a SKILL.md folder (frontmatter name/description + body)
    plus every supporting file in the folder, keyed by relative POSIX path."""

    name: str
    description: str = ""
    content: str = ""
    files: dict[str, SkillFile] = Field(default_factory=dict)


class RuleEntity(BaseModel):
    """Rules / custom instructions — a markdown document synced to AGENTS.md,
    CLAUDE.md, .cursor/rules/, copilot-instructions.md, etc."""

    name: str
    description: str = ""
    content: str = ""


class CommandEntity(BaseModel):
    """Slash command / prompt file / workflow."""

    name: str
    description: str = ""
    content: str = ""
    argument_hint: str = ""


class SubagentEntity(BaseModel):
    """Custom subagent definition (markdown + frontmatter)."""

    name: str
    description: str = ""
    content: str = ""
    model: str = ""
    tools: str = ""  # comma-separated tool list


class LlmProvider(BaseModel):
    """LLM provider / API-key configuration (read-only discovery for now)."""

    name: str
    provider_type: str = ""
    api_key: str = ""
    base_url: str = ""
    default_model: str = ""


KIND_MODELS: dict[str, type[BaseModel]] = {
    "mcp": McpServer,
    "skill": SkillEntity,
    "rule": RuleEntity,
    "command": CommandEntity,
    "subagent": SubagentEntity,
    "llm": LlmProvider,
}

# Fields stored in the dedicated DB columns rather than the JSON data blob.
_COLUMN_FIELDS = {"name", "description", "content"}


def split_canonical(model: BaseModel) -> tuple[str, str, str, dict]:
    """Split a canonical model into (name, description, content, data)."""
    dump = model.model_dump()
    name = dump.pop("name")
    description = dump.pop("description", "") or ""
    content = dump.pop("content", "") or ""
    return name, description, content, dump


def build_canonical(
    kind: str, name: str, description: str, content: str, data: dict
) -> BaseModel:
    """Inverse of split_canonical."""
    model_cls = KIND_MODELS[kind]
    fields = dict(data)
    fields["name"] = name
    if "description" in model_cls.model_fields:
        fields["description"] = description
    if "content" in model_cls.model_fields:
        fields["content"] = content
    return model_cls.model_validate(fields)


# ---------------------------------------------------------------------------
# API DTOs
# ---------------------------------------------------------------------------


class Entity(BaseModel):
    """A registry row: canonical model plus registry metadata."""

    id: str
    kind: str
    name: str
    scope: str
    project_id: Optional[str] = None
    description: str = ""
    content: str = ""
    data: dict = Field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""


class Project(BaseModel):
    id: str
    name: str
    path: str


class DiscoveredItem(BaseModel):
    """An item found in an agent's config during discovery."""

    kind: str
    name: str
    scope: str
    sources: list[str] = Field(default_factory=list)  # integration ids
    data: dict = Field(default_factory=dict)
    description: str = ""
    content: str = ""
    already_imported: bool = False
    differs_from_registry: bool = False


class CellStatus(BaseModel):
    """Sync status of one entity for one integration target."""

    integration: str
    status: str  # in_sync | outdated | drifted | conflict | not_synced | missing | unsupported
    capability: str = "native"
    target_path: str = ""
    notes: str = ""


class EntityStatus(BaseModel):
    entity_id: str
    name: str
    cells: list[CellStatus] = Field(default_factory=list)


class PlanChange(BaseModel):
    """One file modification in a sync plan."""

    integration: str
    scope: str
    project_id: Optional[str] = None
    file_path: str
    diff: str
    items: list[str] = Field(default_factory=list)  # entity names written
    create: bool = False  # file does not exist yet


class PlanWarning(BaseModel):
    entity_id: str
    entity_name: str
    integration: str
    status: str
    message: str


class SyncPlan(BaseModel):
    plan_id: str
    changes: list[PlanChange] = Field(default_factory=list)
    warnings: list[PlanWarning] = Field(default_factory=list)


class ApplyResult(BaseModel):
    success: bool
    files_written: list[str] = Field(default_factory=list)
    backup_dir: Optional[str] = None
    message: str = ""
