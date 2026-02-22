"""Pydantic models for OpenSync."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class McpServer(BaseModel):
    """Canonical representation of an MCP server."""

    id: Optional[str] = Field(None, description="Stable internal UUID")
    name: str = Field(..., description="Unique server name / key")
    command: Optional[str] = Field(
        None, description="Executable command (e.g. npx, uv, uvx)"
    )
    args: list[str] = Field(default_factory=list, description="Command arguments")
    env: dict[str, str] = Field(
        default_factory=dict, description="Environment variables"
    )
    type: Optional[str] = Field(
        None, description="Transport type (stdio, local, remote, http, sse)"
    )
    url: Optional[str] = Field(None, description="URL for remote/http/sse servers")
    headers: dict[str, str] = Field(
        default_factory=dict, description="HTTP headers for remote servers"
    )
    sources: list[str] = Field(
        default_factory=list, description="Which targets this server was discovered in"
    )


class Skill(BaseModel):
    """Canonical representation of a Skill."""

    id: Optional[str] = Field(None, description="Stable internal UUID")
    name: str = Field(..., description="Unique skill name / key")
    description: Optional[str] = Field(None, description="Short description")
    content: Optional[str] = Field(None, description="The skill instructions/prompt")
    sources: list[str] = Field(
        default_factory=list, description="Which targets this skill was discovered in"
    )


class Workflow(BaseModel):
    """Canonical representation of a Workflow."""

    id: Optional[str] = Field(None, description="Stable internal UUID")
    name: str = Field(..., description="Unique workflow name / key")
    description: Optional[str] = Field(None, description="Short description")
    content: Optional[str] = Field(
        None, description="The workflow instructions (markdown)"
    )
    sources: list[str] = Field(
        default_factory=list,
        description="Which targets this workflow was discovered in",
    )


class LlmProvider(BaseModel):
    """Canonical representation of an LLM Provider."""

    id: Optional[str] = Field(None, description="Stable internal UUID")
    name: str = Field(..., description="Unique provider name / key")
    provider_type: Optional[str] = Field(
        None, description="Provider type (e.g. openai, anthropic)"
    )
    api_key: Optional[str] = Field(None, description="API Key")
    base_url: Optional[str] = Field(None, description="Base URL")
    sources: list[str] = Field(
        default_factory=list,
        description="Which targets this provider was discovered in",
    )


class Agent(BaseModel):
    """Canonical representation of a custom Agent / Subagent."""

    id: Optional[str] = Field(None, description="Stable internal UUID")
    name: str = Field(..., description="Unique agent name / key")
    description: Optional[str] = Field(None, description="Short description")
    content: Optional[str] = Field(
        None, description="The agent instructions/prompt (markdown)"
    )
    model: Optional[str] = Field(None, description="Preferred model identifier")
    tools: Optional[str] = Field(None, description="Comma-separated tool permissions")
    sources: list[str] = Field(
        default_factory=list,
        description="Which targets this agent was discovered in",
    )


class TargetStatus(BaseModel):
    """Status information for a sync target."""

    name: str
    display_name: str
    config_path: str
    config_exists: bool
    server_count: int
    scope: str = "global"
    category: str = "editor"
    servers: list[str] = Field(
        default_factory=list, description="Names of installed servers"
    )


class SyncRequest(BaseModel):
    """Request to sync servers to targets."""

    server_names: list[str] = Field(..., description="Server names to sync")
    target_names: list[str] = Field(..., description="Target names to sync to")
    scope: str = Field("global", description="Scope: global or project")
    project_path: Optional[str] = Field(
        None, description="Project directory for project scope"
    )


class SyncResult(BaseModel):
    """Result of a sync operation for a single target."""

    target: str
    success: bool
    message: str
    servers_written: list[str] = Field(default_factory=list)


class SyncResponse(BaseModel):
    """Response from a sync operation."""

    results: list[SyncResult]
    backup_paths: dict[str, str] = Field(
        default_factory=dict, description="Backup file paths created"
    )


class AddServerRequest(BaseModel):
    """Request to add a new MCP server."""

    name: str
    command: Optional[str] = None
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    type: Optional[str] = None
    url: Optional[str] = None
    headers: dict[str, str] = Field(default_factory=dict)
    scope: Optional[str] = Field("global", description="global or project")
    project_name: Optional[str] = Field(
        None, description="Project name for project scope"
    )


class RemoveServerRequest(BaseModel):
    """Request to remove a server from specific targets."""

    target_names: list[str] = Field(
        ..., description="Targets to remove the server from"
    )


class UpdateServerRequest(BaseModel):
    """Request to update an existing MCP server configuration."""

    name: Optional[str] = Field(None, description="New name (for rename)")
    command: Optional[str] = None
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    type: Optional[str] = None
    url: Optional[str] = None
    headers: dict[str, str] = Field(default_factory=dict)
    scope: Optional[str] = Field("global", description="global or project")
    project_name: Optional[str] = Field(
        None, description="Project name for project scope"
    )


class ImportServerRequest(BaseModel):
    """Request to import a server from global registry into a project."""

    server_name: str = Field(..., description="Name of the global server to import")
    project_name: str = Field(..., description="Target project name")


class McpRegistryImportRequest(BaseModel):
    """Request to import a server from the official MCP registry."""

    server_name: str = Field(
        ..., description="Registry server name (e.g. io.github.org/server)"
    )
    scope: Optional[str] = Field("global", description="global or project")
    project_name: Optional[str] = Field(
        None, description="Project name for project scope"
    )
