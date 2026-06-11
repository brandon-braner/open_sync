"""Read-only discovery of LLM providers from JSON configs.

Currently understands OpenCode's `provider` block:

    "provider": { "<name>": { "options": { "apiKey": "...", "baseURL": "..." },
                              "models": { ... } } }

Provider sync is intentionally not implemented — provider/model config is
semantically incompatible across tools, so writes are deferred until
explicit per-tool field maps exist.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel

from opensync.engine.handlers.base import FileChange, FormatHandler, read_text_or_none
from opensync.models import LlmProvider


class LlmJsonHandler(FormatHandler):
    name = "llm_json"
    kinds = frozenset({"llm"})

    def read(self, root: Path, opts: dict) -> dict[str, BaseModel]:
        text = read_text_or_none(root)
        if not text:
            return {}
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return {}
        providers = data.get(opts.get("root_key", "provider"), {})
        if not isinstance(providers, dict):
            return {}
        result: dict[str, BaseModel] = {}
        for name, block in providers.items():
            if not isinstance(block, dict):
                continue
            options = block.get("options") or {}
            models = block.get("models") or {}
            result[name] = LlmProvider(
                name=name,
                provider_type=name,
                api_key=str(options.get("apiKey") or ""),
                base_url=str(options.get("baseURL") or ""),
                default_model=next(iter(models), ""),
            )
        return result

    def plan_write(
        self, root: Path, items: list[BaseModel], opts: dict
    ) -> list[FileChange]:
        raise NotImplementedError("LLM provider targets are read-only")

    def plan_remove(
        self, root: Path, names: list[str], opts: dict
    ) -> list[FileChange]:
        raise NotImplementedError("LLM provider targets are read-only")
