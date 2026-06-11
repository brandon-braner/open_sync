"""Integrations package — canonical list of all supported AI tools.

To add a new integration:
  1. Create backend/integrations/{tool_name}.py
  2. Define an Integration instance in that file
  3. Import it here and add it to ALL_INTEGRATIONS

The order of ALL_INTEGRATIONS controls display order where relevant.
"""

from integrations.base import (  # noqa: F401 – re-exported
    ENTITY_KINDS,
    SCOPES,
    EntityTarget,
    Integration,
)

from integrations.claude_code import claude_code
from integrations.claude_desktop import claude_desktop
from integrations.codex import codex
from integrations.vscode import vscode_github_copilot
from integrations.copilot_cli import copilot_cli
from integrations.cursor import cursor
from integrations.devin import devin
from integrations.gemini_cli import gemini_cli
from integrations.opencode import opencode
from integrations.antigravity import antigravity
from integrations.warp import warp

ALL_INTEGRATIONS: list[Integration] = [
    claude_code,
    claude_desktop,
    codex,
    vscode_github_copilot,
    copilot_cli,
    cursor,
    devin,
    gemini_cli,
    opencode,
    antigravity,
    warp,
]

INTEGRATIONS_BY_ID: dict[str, Integration] = {i.id: i for i in ALL_INTEGRATIONS}


def get_integration(integration_id: str) -> Integration | None:
    return INTEGRATIONS_BY_ID.get(integration_id)
