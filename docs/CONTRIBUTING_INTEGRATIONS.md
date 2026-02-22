# Contributing New Integrations

This guide explains how to add support for a new AI tool or editor to Open Sync.

## Overview

Integrations define how Open Sync reads and writes configuration for different AI tools. Each integration specifies:

- Where the tool stores its configuration files
- What features it supports (MCP, Skills, Workflows, LLM)
- The format of its configuration files

## Architecture

```
backend/integrations/
├── __init__.py      # ALL_INTEGRATIONS registry
├── base.py          # Integration & ScopedConfig models
├── opencode.py      # Example integration
└── ...              # Other integrations
```

## Step-by-Step Guide

### 1. Create the Integration File

Create a new file at `backend/integrations/{tool_id}.py`:

```python
from integrations.base import Integration, ScopedConfig

{tool_id} = Integration(
    id="{tool_id}",
    display_name="{Display Name}",
    color="#HEXCOLOR",
    category="editor",  # editor | desktop | cli | plugin
    
    # Feature support (set to False to disable)
    mcp_support=True,
    skill_support=True,
    workflow_support=True,
    llm_support=True,
    agent_support=True,
    
    # Feature configurations
    mcp={{
        "global": ScopedConfig(...),
        "project": ScopedConfig(...),
    }},
    skill={{"global": ScopedConfig(...), "project": ...}},
    workflow={{"global": ScopedConfig(...), "project": ...}},
    llm={{"global": ScopedConfig(...), "project": ...}},
    agent={{"global": ScopedConfig(...), "project": ...}},
)
```

### 2. Register the Integration

In `backend/integrations/__init__.py`, add your import and add to `ALL_INTEGRATIONS`:

```python
from integrations.{tool_id} import {tool_id}

ALL_INTEGRATIONS: list[Integration] = [
    # ... existing integrations
    {tool_id},
]
```

## Integration Reference

### Integration Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | str | Unique identifier (kebab-case) |
| `display_name` | str | Human-readable name |
| `color` | str | Hex color for UI badges |
| `category` | str | One of: `editor`, `desktop`, `cli`, `plugin` |
| `mcp_support` | bool | Supports MCP servers |
| `skill_support` | bool | Supports skills |
| `workflow_support` | bool | Supports workflows |
| `llm_support` | bool | Supports LLM providers |
| `agent_support` | bool | Supports agents / subagents |
| `mcp` | dict | MCP config scopes |
| `skill` | dict | Skill config scopes |
| `workflow` | dict | Workflow config scopes |
| `llm` | dict | LLM config scopes |
| `agent` | dict | Agent config scopes |

### ScopedConfig Fields

| Field | Type | Description |
|-------|------|-------------|
| `config_path` | str | Path to config file (supports `~`) |
| `root_key` | str | JSON key for MCP entries (default: `mcpServers`) |
| `format_type` | str | `standard`, `opencode`, `vscode`, or `yaml` |
| `nested` | bool | MCP stored inside larger config file |
| `native` | str | `"true"` if first-class MCP support |
| `read_only` | bool | Discovery-only (no write) |

### Format Types

- **standard**: Default MCP format (`{{ "server-name": {{ "command": "...", "args": [...] }} }}`)
- **opencode**: OpenCode format (`{{ "mcp": {{ "server-name": {{ ... }} }} }`)
- **vscode**: VS Code MCP format with `enabled` field
- **yaml**: YAML format for config files

## Example Integrations

### Full-Featured (MCP + Skills + Workflows + LLM)

```python
from integrations.base import Integration, ScopedConfig

example = Integration(
    id="example",
    display_name="Example Tool",
    color="#FF6B6B",
    category="cli",
    mcp={
        "global": ScopedConfig(
            config_path="~/.config/example/config.json",
            root_key="mcpServers",
        ),
        "project": ScopedConfig(
            config_path=".example-mcp.json",
            root_key="mcpServers",
        ),
    },
    skill={
        "global": ScopedConfig(
            config_path="~/.config/example/skills.json",
            root_key="skills",
        ),
    },
    workflow={
        "global": ScopedConfig(
            config_path="~/.config/example/workflows.json",
            root_key="workflows",
        ),
    },
    llm={
        "global": ScopedConfig(
            config_path="~/.config/example/providers.json",
            root_key="providers",
        ),
    },
)
```

### Agent Support (Markdown files in directories)

```python
example_with_agents = Integration(
    id="example-agents",
    display_name="Example With Agents",
    color="#9B59B6",
    category="cli",
    mcp_support=False,
    skill_support=False,
    workflow_support=False,
    llm_support=False,
    mcp={},
    agent={
        "global": ScopedConfig(
            config_path="~/.example/agents/",
            native="true",
        ),
        "project": ScopedConfig(
            config_path="<project>/.example/agents/",
            native="true",
        ),
    },
)
```

Agent directories contain `.md` files with YAML frontmatter:

```markdown
---
name: My Agent
description: A helpful coding assistant
model: gpt-4
tools: file_read,file_write
---
You are a helpful coding assistant that specializes in Python.
```

### MCP Only (Global)

```python
example_mcp_only = Integration(
    id="example-mcp-only",
    display_name="Example MCP Only",
    color="#D97757",
    category="desktop",
    skill_support=False,
    workflow_support=False,
    llm_support=False,
    mcp={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Example/config.json",
            root_key="mcpServers",
        ),
    },
)
```

### Nested Config (MCP inside larger file)

```python
example_nested = Integration(
    id="example-nested",
    display_name="Example Nested",
    color="#01CBA4",
    category="editor",
    mcp={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Example/settings.json",
            root_key="mcp",
            format_type="standard",
            nested=True,
        ),
    },
)
```

### Read-Only Target

```python
example_readonly = Integration(
    id="example-readonly",
    display_name="Example Read Only",
    color="#888888",
    category="editor",
    mcp={
        "global": ScopedConfig(
            config_path="~/.config/example/config.json",
            read_only=True,
        ),
    },
)
```

## Finding Configuration Paths

Common locations for AI tool configs:

- **macOS**: `~/Library/Application Support/{Tool}/`
- **Linux**: `~/.config/{tool}/` or `~/.config/{tool}/`
- **Project**: `./{tool}rc` or `.{tool}.json` in project root

## Testing Your Integration

1. Start the backend server
2. Visit the web UI
3. Your integration should appear in the tool selector
4. Try reading/writing MCP configs for your tool

## Common Issues

- **Config not found**: Verify the path with `~` expansion works
- **Parse error**: Check JSON/YAML validity of config file
- **Write fails**: Ensure file permissions allow writing
- **Format mismatch**: Verify `root_key` and `format_type` are correct
