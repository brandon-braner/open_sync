"""Bundle the built web UI into the package as opensync/static.

Three build situations:
- source checkout with frontend/dist present  → force-include it
- source checkout without dist, npm available → build it, then include
- building a wheel from the sdist             → static is already inside
  opensync/, normal file selection picks it up; do nothing
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from hatchling.builders.hooks.plugin.interface import BuildHookInterface


class CustomBuildHook(BuildHookInterface):
    def initialize(self, version: str, build_data: dict) -> None:
        root = Path(self.root)
        if (root / "opensync" / "static" / "index.html").is_file():
            return

        frontend = root.parent / "frontend"
        dist = frontend / "dist"
        if not (dist / "index.html").is_file():
            if shutil.which("npm") and (frontend / "package.json").is_file():
                self.app.display_info("opensync: building frontend (npm)…")
                subprocess.run(["npm", "ci"], cwd=frontend, check=True)
                subprocess.run(["npm", "run", "build"], cwd=frontend, check=True)
            else:
                self.app.display_warning(
                    "opensync: frontend/dist not found and npm unavailable — "
                    "packaging without the web UI (API only)"
                )
                return
        build_data["force_include"][str(dist)] = "opensync/static"
