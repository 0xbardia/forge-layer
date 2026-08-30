"""HTTP integration tests against server/main.py."""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
A = "0x1111111111111111111111111111111111111111"
B = "0x2222222222222222222222222222222222222222"
OWNER = "0x0000000000000000000000000000000000000001"
STAKE = str(10**17)


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port = _free_port()
        cls.db = tempfile.mkstemp(suffix=".sqlite")[1]
        env = os.environ.copy()
        env["PORT"] = str(cls.port)
        env["HOST"] = "127.0.0.1"
        env["FORGE_DB"] = cls.db
        env["PUBLIC_CONTRACT_ADDRESS"] = ""
        cls.proc = subprocess.Popen(
            [sys.executable, os.path.join(ROOT, "server", "main.py")],
            cwd=os.path.join(ROOT, "server"),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        cls.base = f"http://127.0.0.1:{cls.port}"
        for _ in range(40):
            try:
                urllib.request.urlopen(cls.base + "/health", timeout=0.3)
                return
            except Exception:
                time.sleep(0.15)
        raise RuntimeError("server did not start")

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        try:
            cls.proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            cls.proc.kill()

    def get(self, path: str):
        with urllib.request.urlopen(self.base + path, timeout=5) as r:
            return json.loads(r.read().decode())

    def post(self, path: str, body: dict):
        req = urllib.request.Request(
            self.base + path,
            data=json.dumps(body).encode(),
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                return r.status, json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode())

    def test_health_and_config(self):
        h = self.get("/health")
        self.assertTrue(h["ok"])
        cfg = self.get("/config")
        self.assertEqual(cfg["public_contract_address"], "")
        self.assertTrue(cfg["rehearsal"])
        self.assertFalse(cfg["contract_configured"])

    def test_submit_challenge_resolve_flow(self):
        status, d = self.post(
            "/api/disputes",
            {
                "caller": A,
                "content_type": "text",
                "content_ref": "As an AI language model, synergy.",
                "claim": "human_made",
                "stake_wei": STAKE,
            },
        )
        self.assertEqual(status, 200)
        did = d["id"]
        status, c = self.post(f"/api/disputes/{did}/challenge", {"caller": B, "stake_wei": STAKE})
        self.assertEqual(status, 200)
        self.assertEqual(c["status"], "CHALLENGED")
        status, r = self.post(f"/api/disputes/{did}/resolve", {"caller": B})
        self.assertEqual(status, 200)
        self.assertEqual(r["status"], "RESOLVED")

    def test_non_owner_pause_rejected(self):
        status, body = self.post("/api/admin/pause", {"caller": A, "paused": True})
        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "only owner")

    def test_self_challenge_http(self):
        _, d = self.post(
            "/api/disputes",
            {
                "caller": A,
                "content_type": "text",
                "content_ref": "mill wheel spoons",
                "claim": "human_made",
                "stake_wei": STAKE,
            },
        )
        status, body = self.post(f"/api/disputes/{d['id']}/challenge", {"caller": A, "stake_wei": STAKE})
        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "cannot challenge own dispute")

    def test_list_and_stats(self):
        stats = self.get("/api/stats")
        self.assertIn("total", stats)
        listed = self.get("/api/disputes?limit=5")
        self.assertIn("items", listed)


if __name__ == "__main__":
    unittest.main()
