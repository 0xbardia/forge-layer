"""Forge Layer backend.

Entrypoint for the QA / Vercel-adjacent API. The Intelligent Contract is the
source of truth once PUBLIC_CONTRACT_ADDRESS is set; until then this process
hosts a faithful rehearsal of the same protocol plus a /config endpoint the
frontend reads at runtime.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
from collections import defaultdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from protocol import ProtocolError, Registry  # noqa: E402
from store import connect  # noqa: E402

PUBLIC_CONTRACT_ADDRESS = os.environ.get("PUBLIC_CONTRACT_ADDRESS", "")
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "0"))
STATIC_DIR = Path(os.environ.get("FORGE_STATIC", HERE.parent / "frontend" / "out"))

_conn = connect()
_registry = Registry(_conn)
_rate: dict[str, list[float]] = defaultdict(list)
_rate_lock = threading.Lock()
RATE_WINDOW = 60.0
RATE_MAX_POST = 30


def _client_ip(handler: BaseHTTPRequestHandler) -> str:
    forwarded = handler.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return handler.client_address[0] if handler.client_address else "unknown"


def _rate_ok(ip: str) -> bool:
    now = time.time()
    with _rate_lock:
        hits = [t for t in _rate[ip] if now - t < RATE_WINDOW]
        if len(hits) >= RATE_MAX_POST:
            _rate[ip] = hits
            return False
        hits.append(now)
        _rate[ip] = hits
        return True


def _config() -> dict:
    address = (PUBLIC_CONTRACT_ADDRESS or os.environ.get("PUBLIC_CONTRACT_ADDRESS", "")).strip()
    configured = bool(__import__("re").match(r"^0x[0-9a-fA-F]{40}$", address))
    stats = _registry.stats()
    return {
        "public_contract_address": address,
        "chain": "studionet" if configured else "rehearsal",
        "rehearsal": not configured,
        "min_stake_wei": stats["min_stake"],
        "max_content_ref": 4096,
        "challenge_window_seconds": stats["challenge_window_seconds"],
        "fee_bps": stats["fee_bps"],
        "contract_configured": configured,
    }


def _json_body(handler: BaseHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length", "0") or 0)
    if length <= 0:
        return {}
    if length > 32_768:
        raise ProtocolError("malformed json")
    raw = handler.rfile.read(length)
    if not raw:
        return {}
    try:
        return json.loads(raw.decode())
    except json.JSONDecodeError as exc:
        raise ProtocolError("malformed json") from exc


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        sys.stderr.write("backend: " + (fmt % args) + "\n")

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Frame-Options", "SAMEORIGIN")

    def _send(self, code: int, payload, content_type: str = "application/json") -> None:
        data = payload if isinstance(payload, (bytes, bytearray)) else json.dumps(payload).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_file(self, path: Path) -> None:
        if not path.is_file():
            self._send(404, {"error": "not found"})
            return
        ext = path.suffix.lower()
        types = {
            ".html": "text/html; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".svg": "image/svg+xml",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".ico": "image/x-icon",
            ".txt": "text/plain; charset=utf-8",
            ".woff2": "font/woff2",
        }
        data = path.read_bytes()
        self._send(200, data, types.get(ext, "application/octet-stream"))

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        qs = parse_qs(parsed.query)
        try:
            if path in ("/health", "/api/health"):
                self._send(200, {"ok": True, "service": "forge-layer", "time": __import__("datetime").datetime.utcnow().isoformat() + "Z"})
                return
            if path in ("/config", "/api/config"):
                self._send(200, _config())
                return
            if path in ("/api/stats", "/api/registry/stats"):
                self._send(200, _registry.stats())
                return
            if path == "/api/disputes":
                self._send(
                    200,
                    _registry.list_disputes(
                        offset=int((qs.get("offset") or ["0"])[0]),
                        limit=int((qs.get("limit") or ["12"])[0]),
                        status_filter=(qs.get("status") or [""])[0],
                        content_type=(qs.get("content_type") or [""])[0],
                        verdict=(qs.get("verdict") or [""])[0],
                        q=(qs.get("q") or [""])[0],
                    ),
                )
                return
            if path.startswith("/api/disputes/"):
                did = int(path.rsplit("/", 1)[-1])
                self._send(200, _registry.get_dispute(did))
                return
            self._serve_static(path)
        except ProtocolError as exc:
            self._send(400, {"error": exc.message})
        except ValueError:
            self._send(400, {"error": "bad request"})
        except Exception:
            self._send(500, {"error": "internal error"})

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            if not _rate_ok(_client_ip(self)):
                self._send(429, {"error": "rate limited"})
                return
            body = _json_body(self)
            if path == "/api/disputes":
                self._send(
                    200,
                    _registry.submit_dispute(
                        caller=body.get("caller", ""),
                        content_type=body.get("content_type", ""),
                        content_ref=body.get("content_ref", ""),
                        claim=body.get("claim", ""),
                        stake_wei=int(body.get("stake_wei", "0")),
                    ),
                )
                return
            if path.endswith("/challenge") and path.startswith("/api/disputes/"):
                did = int(path.split("/")[3])
                self._send(
                    200,
                    _registry.challenge_dispute(
                        caller=body.get("caller", ""),
                        dispute_id=did,
                        stake_wei=int(body.get("stake_wei", "0")),
                    ),
                )
                return
            if path.endswith("/resolve") and path.startswith("/api/disputes/"):
                did = int(path.split("/")[3])
                self._send(
                    200,
                    _registry.resolve_dispute(caller=body.get("caller", ""), dispute_id=did),
                )
                return
            if path.endswith("/accelerate") and path.startswith("/api/disputes/"):
                did = int(path.split("/")[3])
                self._send(200, _registry.accelerate(body.get("caller", ""), did))
                return
            if path == "/api/admin/pause":
                self._send(200, _registry.set_pause(body.get("caller", ""), bool(body.get("paused"))))
                return
            if path == "/api/admin/fee":
                self._send(200, _registry.set_fee_bps(body.get("caller", ""), int(body.get("fee_bps", 0))))
                return
            if path == "/api/admin/withdraw":
                self._send(200, _registry.withdraw_fees(body.get("caller", ""), body.get("to", "")))
                return
            if path == "/api/admin/transfer":
                self._send(
                    200,
                    _registry.transfer_ownership(body.get("caller", ""), body.get("new_owner", "")),
                )
                return
            self._send(404, {"error": "not found"})
        except ProtocolError as exc:
            self._send(400, {"error": exc.message})
        except Exception:
            self._send(500, {"error": "internal error"})

    def _serve_static(self, path: str) -> None:
        if path == "/":
            candidate = STATIC_DIR / "index.html"
            if candidate.is_file():
                self._send_file(candidate)
                return
            self._send(200, {"service": "forge-layer", "docs": "/config"})
            return
        rel = path.lstrip("/")
        rel_noslash = rel.rstrip("/")
        root = STATIC_DIR.resolve() if STATIC_DIR.exists() else None

        def _ok(candidate: Path):
            if root is None:
                return None
            try:
                resolved = candidate.resolve()
            except OSError:
                return None
            if str(resolved).startswith(str(root)) and resolved.is_file():
                return resolved
            return None

        for candidate in (
            STATIC_DIR / rel,
            STATIC_DIR / rel_noslash,
            STATIC_DIR / rel_noslash / "index.html",
            STATIC_DIR / f"{rel_noslash}.html",
        ):
            hit = _ok(candidate)
            if hit is not None:
                self._send_file(hit)
                return

        parts = rel_noslash.split("/")
        if len(parts) == 2 and parts[0] == "disputes" and parts[1] not in ("", "_"):
            shell = _ok(STATIC_DIR / "disputes" / "_" / "index.html")
            if shell is not None:
                self._send_file(shell)
                return

        # Never SPA-fallback asset / API-looking paths — that produces
        # "Unexpected token '<'" when a JS chunk 404s into index.html.
        if rel_noslash.startswith("_next/") or Path(rel_noslash).suffix:
            self._send(404, {"error": "not found"})
            return

        index = STATIC_DIR / "index.html"
        if index.is_file():
            self._send_file(index)
            return
        self._send(404, {"error": "not found", "hint": "frontend static export missing"})


def pick_port() -> int:
    if PORT:
        return PORT
    import socket

    sock = socket.socket()
    sock.bind((HOST, 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


def main() -> None:
    import signal

    port = pick_port()
    ThreadingHTTPServer.allow_reuse_address = True
    httpd = ThreadingHTTPServer((HOST, port), Handler)

    def _stop(*_args: object) -> None:
        threading.Thread(target=httpd.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    print(f"forge-layer listening on {HOST}:{port}", flush=True)
    print(f"PUBLIC_CONTRACT_ADDRESS={PUBLIC_CONTRACT_ADDRESS!r}", flush=True)
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
