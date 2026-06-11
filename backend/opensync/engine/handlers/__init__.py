"""Format handler registry.

A handler translates between canonical entity models and one on-disk config
format. Handlers never write files themselves — they return FileChange
plans that the sync engine diffs, backs up, and applies.
"""

from opensync.engine.handlers.base import FileChange, FormatHandler  # noqa: F401
from opensync.engine.handlers.json_mcp import JsonMcpHandler
from opensync.engine.handlers.llm_json import LlmJsonHandler
from opensync.engine.handlers.markdown_blocks import MarkdownBlocksHandler
from opensync.engine.handlers.markdown_dir import MarkdownDirHandler
from opensync.engine.handlers.skill_dir import SkillDirHandler
from opensync.engine.handlers.toml_command import TomlCommandHandler
from opensync.engine.handlers.toml_mcp import TomlMcpHandler
from opensync.engine.handlers.yaml_workflow import YamlWorkflowHandler

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
