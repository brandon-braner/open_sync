"""Format handler registry.

A handler translates between canonical entity models and one on-disk config
format. Handlers never write files themselves — they return FileChange
plans that the sync engine diffs, backs up, and applies.
"""

from engine.handlers.base import FileChange, FormatHandler  # noqa: F401
from engine.handlers.json_mcp import JsonMcpHandler
from engine.handlers.llm_json import LlmJsonHandler
from engine.handlers.markdown_blocks import MarkdownBlocksHandler
from engine.handlers.markdown_dir import MarkdownDirHandler
from engine.handlers.skill_dir import SkillDirHandler
from engine.handlers.toml_command import TomlCommandHandler
from engine.handlers.toml_mcp import TomlMcpHandler
from engine.handlers.yaml_workflow import YamlWorkflowHandler

HANDLERS: dict[str, FormatHandler] = {
    h.name: h
    for h in (
        JsonMcpHandler(),
        TomlMcpHandler(),
        MarkdownDirHandler(),
        MarkdownBlocksHandler(),
        SkillDirHandler(),
        TomlCommandHandler(),
        YamlWorkflowHandler(),
        LlmJsonHandler(),
    )
}
