"""Canonical per-item hashing for drift detection.

Hashes the parsed canonical model, not file bytes — config files contain
unrelated keys (and Claude Code rewrites ~/.claude.json constantly), so
file-level hashing would report constant false drift.
"""

from __future__ import annotations

import hashlib
import json

from pydantic import BaseModel


def item_hash(item: BaseModel) -> str:
    payload = json.dumps(item.model_dump(), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
