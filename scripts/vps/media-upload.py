#!/usr/bin/env python3
"""Authenticated media upload + Safir proxy for Refaheston on VPS."""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(os.environ.get("MEDIA_ROOT", "/var/www/refahston-media")).resolve()
SECRET = os.environ.get("MEDIA_UPLOAD_SECRET", "").strip()
PORT = int(os.environ.get("MEDIA_UPLOAD_PORT", "8091"))
SAFIR_BASE = os.environ.get(
    "SAFIR_BASE_URL", "https://safir.bale.ai/api/v3"
).rstrip("/")
SAFE = re.compile(r"^[a-zA-Z0-9._/-]+$")


class Handler(BaseHTTPRequestHandler):
    def _auth(self) -> bool:
        if not SECRET:
            return False
        auth = self.headers.get("Authorization", "")
        return auth == f"Bearer {SECRET}"

    def _read_body(self, max_bytes: int) -> bytes | None:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > max_bytes:
            return None
        return self.rfile.read(length)

    def do_GET(self):
        if self.path.startswith("/health"):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
            return
        self.send_response(404)
        self.end_headers()

    def do_PUT(self):
        if not self._auth():
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b"unauthorized")
            return
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        rel = (qs.get("path") or [""])[0].lstrip("/")
        if not rel or ".." in rel or not SAFE.match(rel):
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"bad path")
            return
        data = self._read_body(15 * 1024 * 1024)
        if data is None:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"bad size")
            return
        dest = (ROOT / rel).resolve()
        if not str(dest).startswith(str(ROOT)):
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"path escape")
            return
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        os.chmod(dest, 0o644)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path.rstrip("/") != "/safir/send_message":
            self.send_response(404)
            self.end_headers()
            return
        if not self._auth():
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b"unauthorized")
            return

        api_key = (self.headers.get("api-access-key") or "").strip()
        if not api_key:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"missing api-access-key")
            return

        body = self._read_body(256 * 1024)
        if body is None:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"bad size")
            return

        req = urllib.request.Request(
            f"{SAFIR_BASE}/send_message",
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "api-access-key": api_key,
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                payload = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(payload)
        except urllib.error.HTTPError as err:
            payload = err.read()
            self.send_response(err.code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(payload or b"{}")
        except Exception as err:  # noqa: BLE001
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(
                json.dumps({"error": "safir_proxy_failed", "detail": str(err)}).encode()
            )

    def log_message(self, fmt: str, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


if __name__ == "__main__":
    if not SECRET:
        raise SystemExit("MEDIA_UPLOAD_SECRET required")
    ROOT.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"media upload on 127.0.0.1:{PORT} root={ROOT}")
    server.serve_forever()
