"""Integrations package — canonical list of all supported AI tools.

To add a new integration:
  1. Create backend/integrations/{tool_name}.py
  2. Define an Integration instance in that file
  3. Import it here and add it to ALL_INTEGRATIONS

The order of ALL_INTEGRATIONS controls display order where relevant.
"""

from integrations.base import Integration, ScopedConfig  # noqa: F401 – re-exported

from integrations.opencode import opencode
from integrations.continue_ import continue_
from integrations.aider import aider
from integrations.claude_code import claude_code
from integrations.claude_desktop import claude_desktop
from integrations.roo_cline import roo_cline
from integrations.cline_vscode import cline_vscode
from integrations.kilocode_vscode import kilocode_vscode
from integrations.vscode import vscode
from integrations.windsurf import windsurf
from integrations.plandex import plandex
from integrations.gemini_cli import gemini_cli
from integrations.amp import amp
from integrations.cursor import cursor
from integrations.copilot_cli import copilot_cli
from integrations.jetbrains import jetbrains
from integrations.roocode_antigravity import roocode_antigravity
from integrations.antigravity import antigravity

ALL_INTEGRATIONS: list[Integration] = [
    opencode,
    continue_,
    aider,
    claude_code,
    claude_desktop,
    roo_cline,
    cline_vscode,
    kilocode_vscode,
    vscode,
    windsurf,
    plandex,
    gemini_cli,
    amp,
    cursor,
    copilot_cli,
    jetbrains,
    roocode_antigravity,
    antigravity,
]
