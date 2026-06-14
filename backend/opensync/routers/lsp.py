"""LSP WebSocket bridge.

Bridges a browser WebSocket to a language server process (stdio transport).
One subprocess is spawned per WebSocket connection and killed on disconnect.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# Language server commands, keyed by language id.
# Each entry is the command + args to launch the server in --stdio mode.
LANG_SERVERS: dict[str, list[str]] = {
    "python": ["pyright-langserver", "--stdio"],
    "shell": ["bash-language-server", "start"],
}


def resolve_cmd(cmd: list[str]) -> Optional[list[str]]:
    """Return the command if the executable is on PATH, else None."""
    if shutil.which(cmd[0]):
        return cmd
    return None


def available_servers() -> dict[str, bool]:
    return {lang: resolve_cmd(cmd) is not None for lang, cmd in LANG_SERVERS.items()}


@router.websocket("/ws/lsp/{language}")
async def lsp_bridge(websocket: WebSocket, language: str) -> None:
    """Bridge a WebSocket to a language server subprocess.

    The browser sends raw LSP JSON-RPC messages as WebSocket text frames.
    Each frame is forwarded to the server's stdin; server stdout is forwarded
    back to the browser as text frames.
    """
    await websocket.accept()

    if language not in LANG_SERVERS:
        await websocket.send_text(json.dumps({
            "jsonrpc": "2.0",
            "method": "window/showMessage",
            "params": {
                "type": 1,
                "message": f"Language '{language}' is not supported. Available: {list(LANG_SERVERS)}",
            },
        }))
        await websocket.close()
        return

    cmd = resolve_cmd(LANG_SERVERS[language])
    if cmd is None:
        await websocket.send_text(json.dumps({
            "jsonrpc": "2.0",
            "method": "window/showMessage",
            "params": {
                "type": 1,
                "message": (
                    f"'{LANG_SERVERS[language][0]}' is not installed. "
                    f"Install it to get language intelligence for {language}."
                ),
            },
        }))
        await websocket.close()
        return

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env={**os.environ},
    )

    async def ws_to_server() -> None:
        """Forward WebSocket messages → server stdin.

        The browser sends bare JSON-RPC bodies; the language server speaks the
        LSP stdio framing, so each body is wrapped in a Content-Length header
        before being written to stdin.
        """
        try:
            while True:
                data = await websocket.receive_text()
                body = data.encode("utf-8")
                header = f"Content-Length: {len(body)}\r\n\r\n".encode("ascii")
                proc.stdin.write(header + body)
                await proc.stdin.drain()
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass

    async def server_to_ws() -> None:
        """Forward server stdout → WebSocket."""
        reader = proc.stdout
        try:
            while True:
                message = await read_jsonrpc_message(reader)
                if message is None:
                    break
                await websocket.send_text(message)
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass

    async def stderr_logger() -> None:
        """Log server stderr so it doesn't fill the pipe buffer."""
        try:
            while True:
                line = await proc.stderr.readline()
                if not line:
                    break
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass

    tasks = [
        asyncio.create_task(ws_to_server()),
        asyncio.create_task(server_to_ws()),
        asyncio.create_task(stderr_logger()),
    ]

    try:
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for t in pending:
            t.cancel()
    except WebSocketDisconnect:
        pass
    finally:
        if proc.returncode is None:
            proc.kill()
            await proc.wait()


async def read_jsonrpc_message(reader: asyncio.StreamReader) -> Optional[str]:
    """Read one LSP message (Content-Length framed) from a StreamReader.

    Returns the raw message body as a string (JSON), with the LSP
    Content-Length headers stripped.
    """
    headers: dict[str, str] = {}
    while True:
        line = await reader.readline()
        if not line:
            return None
        line_str = line.decode("utf-8").strip()
        if line_str == "":
            break
        if ":" in line_str:
            key, _, val = line_str.partition(":")
            headers[key.strip().lower()] = val.strip()

    content_length = int(headers.get("content-length", "0"))
    if content_length == 0:
        return None

    body = await reader.readexactly(content_length)
    return body.decode("utf-8")
