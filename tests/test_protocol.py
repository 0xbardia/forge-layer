"""Functional + security tests against the rehearsal protocol engine."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "server"))

from protocol import ProtocolError, Registry  # noqa: E402
from store import connect, reset  # noqa: E402

A = "0x1111111111111111111111111111111111111111"
B = "0x2222222222222222222222222222222222222222"
C = "0x3333333333333333333333333333333333333333"
OWNER = "0x0000000000000000000000000000000000000001"
STAKE = 10**17


def fresh() -> Registry:
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)
    conn = connect(path)
    reset(conn)
    return Registry(conn)


class ProtocolTests(unittest.TestCase):
    def setUp(self) -> None:
        self.r = fresh()

    def test_submit_and_get(self):
        d = self.r.submit_dispute(A, "text", "a human sentence about rain", "human_made", STAKE)
        self.assertEqual(d["status"], "OPEN")
        self.assertEqual(self.r.get_dispute(d["id"])["claim"], "human_made")

    def test_zero_stake(self):
        with self.assertRaises(ProtocolError) as ctx:
            self.r.submit_dispute(A, "text", "hello", "human_made", 0)
        self.assertEqual(str(ctx.exception), "zero stake")

    def test_below_min(self):
        with self.assertRaises(ProtocolError) as ctx:
            self.r.submit_dispute(A, "text", "hello", "human_made", 1)
        self.assertEqual(str(ctx.exception), "stake below minimum")

    def test_empty_ref(self):
        with self.assertRaises(ProtocolError):
            self.r.submit_dispute(A, "text", "  ", "human_made", STAKE)

    def test_malformed_image(self):
        with self.assertRaises(ProtocolError) as ctx:
            self.r.submit_dispute(A, "image", "not-a-url", "ai_generated", STAKE)
        self.assertEqual(str(ctx.exception), "content_ref malformed")

    def test_oversized_ref(self):
        with self.assertRaises(ProtocolError):
            self.r.submit_dispute(A, "text", "x" * 5000, "human_made", STAKE)

    def test_invalid_claim(self):
        with self.assertRaises(ProtocolError):
            self.r.submit_dispute(A, "text", "hello", "maybe", STAKE)

    def test_self_challenge(self):
        d = self.r.submit_dispute(A, "text", "hello world", "human_made", STAKE)
        with self.assertRaises(ProtocolError) as ctx:
            self.r.challenge_dispute(A, d["id"], STAKE)
        self.assertEqual(str(ctx.exception), "cannot challenge own dispute")

    def test_double_challenge(self):
        d = self.r.submit_dispute(A, "text", "hello world", "human_made", STAKE)
        self.r.challenge_dispute(B, d["id"], STAKE)
        with self.assertRaises(ProtocolError) as ctx:
            self.r.challenge_dispute(C, d["id"], STAKE)
        self.assertEqual(str(ctx.exception), "already challenged")

    def test_stake_mismatch(self):
        d = self.r.submit_dispute(A, "text", "hello world", "human_made", STAKE)
        with self.assertRaises(ProtocolError):
            self.r.challenge_dispute(B, d["id"], STAKE * 2)

    def test_challenge_after_deadline(self):
        d = self.r.submit_dispute(A, "text", "hello world", "human_made", STAKE)
        self.r.accelerate(OWNER, d["id"])
        with self.assertRaises(ProtocolError) as ctx:
            self.r.challenge_dispute(B, d["id"], STAKE)
        self.assertEqual(str(ctx.exception), "challenge window expired")

    def test_resolve_twice(self):
        d = self.r.submit_dispute(A, "text", "hello world", "human_made", STAKE)
        self.r.accelerate(OWNER, d["id"])
        self.r.resolve_dispute(B, d["id"])
        with self.assertRaises(ProtocolError) as ctx:
            self.r.resolve_dispute(B, d["id"])
        self.assertEqual(str(ctx.exception), "already resolved")

    def test_expired_unchallenged_path(self):
        d = self.r.submit_dispute(A, "text", "hello world", "human_made", STAKE)
        self.r.accelerate(OWNER, d["id"])
        out = self.r.resolve_dispute(B, d["id"])
        self.assertEqual(out["status"], "EXPIRED_UNCHALLENGED")
        # v1.4.0: unchallenged expiry is recorded as ``unadjudicated``
        # rather than echoing the submitter's initial claim.
        self.assertEqual(out["verdict"], "unadjudicated")

    def test_resolve_before_deadline_open(self):
        d = self.r.submit_dispute(A, "text", "hello world", "human_made", STAKE)
        with self.assertRaises(ProtocolError) as ctx:
            self.r.resolve_dispute(B, d["id"])
        self.assertEqual(str(ctx.exception), "not eligible for resolution")

    def test_challenged_resolve(self):
        d = self.r.submit_dispute(
            A,
            "text",
            "As an AI language model, I must emphasize stakeholder synergy.",
            "human_made",
            STAKE,
        )
        self.r.challenge_dispute(B, d["id"], STAKE)
        out = self.r.resolve_dispute(C, d["id"])
        self.assertEqual(out["status"], "RESOLVED")
        self.assertIn(out["verdict"], ("ai_generated", "human_made", "inconclusive"))
        self.assertTrue(out["reasoning_summary"])

    def test_unreachable_image_inconclusive(self):
        d = self.r.submit_dispute(A, "image", "https://example.invalid/x.png", "ai_generated", STAKE)
        self.r.challenge_dispute(B, d["id"], STAKE)
        out = self.r.resolve_dispute(C, d["id"])
        self.assertEqual(out["verdict"], "inconclusive")

    def test_pause_blocks_writes(self):
        self.r.set_pause(OWNER, True)
        with self.assertRaises(ProtocolError) as ctx:
            self.r.submit_dispute(A, "text", "hello", "human_made", STAKE)
        self.assertEqual(str(ctx.exception), "contract is paused")

    def test_non_owner_admin(self):
        with self.assertRaises(ProtocolError) as ctx:
            self.r.set_pause(A, True)
        self.assertEqual(str(ctx.exception), "only owner")
        with self.assertRaises(ProtocolError):
            self.r.set_fee_bps(A, 10)
        with self.assertRaises(ProtocolError):
            self.r.withdraw_fees(A, B)

    def test_owner_fee_and_withdraw(self):
        self.r.set_fee_bps(OWNER, 100)
        self.assertEqual(self.r.stats()["fee_bps"], 100)
        out = self.r.withdraw_fees(OWNER, B)
        self.assertEqual(out["to"], B.lower())
        with self.assertRaises(ProtocolError) as ctx:
            self.r.withdraw_fees(OWNER, B)
        self.assertEqual(str(ctx.exception), "no fees to withdraw")

    def test_javascript_image_rejected(self):
        with self.assertRaises(ProtocolError) as ctx:
            self.r.submit_dispute(A, "image", "javascript:alert(1)", "ai_generated", STAKE)
        self.assertEqual(str(ctx.exception), "content_ref malformed")

    def test_localhost_image_rejected(self):
        with self.assertRaises(ProtocolError):
            self.r.submit_dispute(A, "image", "http://127.0.0.1/secret.png", "ai_generated", STAKE)
        with self.assertRaises(ProtocolError):
            self.r.submit_dispute(A, "image", "https://localhost/x.png", "ai_generated", STAKE)

    def test_http_image_rejected(self):
        with self.assertRaises(ProtocolError) as ctx:
            self.r.submit_dispute(A, "image", "http://example.com/x.png", "ai_generated", STAKE)
        self.assertEqual(str(ctx.exception), "content_ref malformed")

    def test_private_and_encoded_hosts_rejected(self):
        bad = [
            "https://127.1/x.png",
            "https://2130706433/x.png",
            "https://10.0.0.1/x.png",
            "https://192.168.1.4/x.png",
            "https://169.254.169.254/latest/meta-data",
            "https://172.16.0.9/x.png",
            "https://[::1]/x.png",
            "https://metadata.google.internal/x.png",
            "https://example.local/x.png",
            "https://user:pass@example.com/x.png",
            "https://0x7f000001/x.png",
            "https://0177.0.0.1/x.png",
            "https://127.0.0.1.nip.io/x.png",
            "https://8.8.8.8.sslip.io/x.png",
            "https://[::ffff:127.0.0.1]/x.png",
            "https://example.com.local/x.png",
            "https://xn--localhost/x.png",
        ]
        for url in bad:
            with self.subTest(url=url):
                with self.assertRaises(ProtocolError):
                    self.r.submit_dispute(A, "image", url, "ai_generated", STAKE)

    def test_idn_and_hex_rejected(self):
        with self.assertRaises(ProtocolError):
            self.r.submit_dispute(A, "image", "https://0x08080808/x.png", "ai_generated", STAKE)

    def test_transfer_ownership(self):
        with self.assertRaises(ProtocolError):
            self.r.transfer_ownership(A, B)
        s = self.r.transfer_ownership(OWNER, B)
        self.assertEqual(s["owner"], B.lower())
        with self.assertRaises(ProtocolError):
            self.r.set_pause(OWNER, True)
        self.r.set_pause(B, True)
        self.assertTrue(self.r.stats()["paused"])
        with self.assertRaises(ProtocolError):
            self.r.transfer_ownership(B, "0x0000000000000000000000000000000000000000")

    def test_https_public_image_accepted(self):
        d = self.r.submit_dispute(
            A, "image", "https://example.com/work.png", "ai_generated", STAKE
        )
        self.assertEqual(d["status"], "OPEN")

    def test_text_http_url_rejected(self):
        with self.assertRaises(ProtocolError):
            self.r.submit_dispute(A, "text", "http://example.com/article", "human_made", STAKE)


    def test_credentialed_image_rejected(self):
        with self.assertRaises(ProtocolError):
            self.r.submit_dispute(A, "image", "https://user:pass@example.com/x.png", "ai_generated", STAKE)

    def test_injection_in_content_ref(self):
        payload = "<script>alert(1)</script> " + "hello " * 20
        d = self.r.submit_dispute(A, "text", payload, "human_made", STAKE)
        self.assertIn("<script>", d["content_ref"])  # stored verbatim, not executed

    def test_list_pagination_and_filter(self):
        for i in range(3):
            self.r.submit_dispute(A, "text", f"excerpt number {i} rain mill", "human_made", STAKE)
        page = self.r.list_disputes(offset=0, limit=2, status_filter="OPEN")
        self.assertEqual(len(page["items"]), 2)
        self.assertGreaterEqual(page["total"], 3)

    def test_stats_shape(self):
        s = self.r.stats()
        for key in ("total", "open", "challenged", "resolved", "fee_bps", "paused", "owner"):
            self.assertIn(key, s)


if __name__ == "__main__":
    unittest.main()
