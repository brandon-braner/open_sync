"""`opensync` console command: start the local server and open the UI."""

from __future__ import annotations

import argparse
import os
import socket
import threading
import webbrowser

from opensync import __version__


def _port_is_free(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex((host, port)) != 0


def _pick_port(host: str, preferred: int) -> int:
    for port in range(preferred, preferred + 20):
        if _port_is_free(host, port):
            return port
    raise SystemExit(f"No free port found near {preferred}")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="opensync",
        description="Sync MCP servers, skills, rules, commands and subagents "
        "across AI coding tools.",
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument(
        "--port", type=int, default=8001,
        help="port to listen on (tries the next ones if taken, default 8001)",
    )
    parser.add_argument(
        "--no-browser", action="store_true", help="don't open the web UI"
    )
    parser.add_argument(
        "--db", help="path to the SQLite registry (default ~/.opensync/opensync.db)"
    )
    parser.add_argument(
        "--version", action="version", version=f"opensync {__version__}"
    )
    args = parser.parse_args(argv)

    if args.db:
        os.environ["OPENSYNC_DB_PATH"] = args.db

    import uvicorn

    from opensync.main import app

    port = args.port if _port_is_free(args.host, args.port) else _pick_port(
        args.host, args.port
    )
    url = f"http://{args.host}:{port}"
    print(f"OpenSync {__version__} → {url}")

    if not args.no_browser:
        threading.Timer(0.8, webbrowser.open, [url]).start()

    uvicorn.run(app, host=args.host, port=port, log_level="warning")


if __name__ == "__main__":
    main()
