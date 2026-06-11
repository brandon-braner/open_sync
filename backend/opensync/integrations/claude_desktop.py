# Claude Desktop (Anthropic)
# Docs: https://support.claude.com/en/articles/10949351
#
# MCP: ~/Library/Application Support/Claude/claude_desktop_config.json
#      ("mcpServers"; stdio only — remote servers are bridged via mcp-remote).
#      Windows: %APPDATA%\Claude\claude_desktop_config.json
#
# Skills exist in Claude Desktop but are uploaded through the app UI
# (Settings → Capabilities); there is no file path to sync to. Remote
# connectors are account-scoped. Global-only app — no project concept.

from opensync.integrations.base import EntityTarget, Integration

claude_desktop = Integration(
    id="claude_desktop",
    display_name="Claude Desktop",
    color="#D97757",
    category="desktop",
    docs_url="https://support.claude.com/en/articles/10949351",
    notes="Skills and remote connectors are managed in the Claude Desktop "
    "UI and cannot be file-synced.",
    targets={
        "mcp": {
            "global": EntityTarget(
                path="~/Library/Application Support/Claude/claude_desktop_config.json",
                handler="json_mcp",
                options={
                    "root_key": "mcpServers",
                    "style": "standard",
                    "bridge_remote": True,
                },
                os_paths={
                    "linux": "~/.config/Claude/claude_desktop_config.json",
                    "win32": "~/AppData/Roaming/Claude/claude_desktop_config.json",
                },
            ),
        },
    },
)
