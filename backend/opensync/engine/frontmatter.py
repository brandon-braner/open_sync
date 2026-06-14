"""Minimal YAML frontmatter parsing/serialisation for markdown files.

Hand-rolled (over python-frontmatter) so the emitted format is exactly
controlled: `---` fences, plain `key: value` lines, no YAML document markers.
"""

from __future__ import annotations

import yaml


def parse(text: str) -> tuple[dict, str]:
    """Split markdown into (frontmatter dict, body)."""
    if not text.startswith("---"):
        return {}, text
    lines = text.split("\n")
    try:
        end = next(i for i, ln in enumerate(lines[1:], start=1) if ln.strip() == "---")
    except StopIteration:
        return {}, text
    raw = "\n".join(lines[1:end])
    # Strip surrounding blank lines so content round-trips byte-identically
    # through render() — otherwise every sync+read would look like drift.
    body = "\n".join(lines[end + 1 :]).strip("\n")
    try:
        meta = yaml.safe_load(raw) or {}
    except yaml.YAMLError:
        return {}, text
    if not isinstance(meta, dict):
        return {}, text
    return meta, body


def render(meta: dict, body: str) -> str:
    """Serialise (frontmatter, body) into a markdown document."""
    meta = {k: v for k, v in meta.items() if v not in (None, "")}
    body = body.rstrip("\n") + "\n"
    if not meta:
        return body
    raw = yaml.safe_dump(meta, sort_keys=False, allow_unicode=True, width=10_000)
    return f"---\n{raw}---\n\n{body}"
