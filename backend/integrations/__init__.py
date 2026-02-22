"""Integrations package — canonical list of all supported AI tools.

To add a new integration:
  1. Create backend/integrations/{tool_name}.py
  2. Define an Integration instance in that file
  3. Import it here and add it to ALL_INTEGRATIONS

The order of ALL_INTEGRATIONS controls display order where relevant.
"""

from integrations.base import Integration, ScopedConfig  # noqa: F401 – re-exported

from integrations.opencode import opencode
from integrations.claude_code import claude_code
from integrations.claude_desktop import claude_desktop
from integrations.warp import warp
from integrations.vscode import vscode
from integrations.windsurf import windsurf
from integrations.gemini_cli import gemini_cli
from integrations.cursor import cursor
from integrations.copilot_cli import copilot_cli
from integrations.antigravity import antigravity

ALL_INTEGRATIONS: list[Integration] = [
    opencode,
    claude_code,
    claude_desktop,
    warp,
    vscode,
    windsurf,
    gemini_cli,
    cursor,
    copilot_cli,
    antigravity,
]
