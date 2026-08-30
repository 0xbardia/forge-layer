"""Static review of the Studio-deployable Intelligent Contract."""

from __future__ import annotations

import os
import re
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "contract", "ForgeLayer.py")


class ContractSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        with open(SRC, encoding="utf-8") as f:
            cls.src = f.read()

    def test_depends_header(self):
        first = self.src.splitlines()[0]
        self.assertTrue(first.startswith("# {"))
        self.assertIn("Depends", first)
        self.assertIn("py-genlayer:", first)

    def test_no_placeholders(self):
        for banned in ("TODO", "FIXME", "NotImplementedError", "pass  #", "...  #"):
            self.assertNotIn(banned, self.src)

    def test_required_methods(self):
        for name in (
            "submit_dispute",
            "challenge_dispute",
            "resolve_dispute",
            "get_dispute",
            "list_disputes",
            "get_registry_stats",
            "get_protocol_info",
            "set_fee_bps",
            "set_pause",
            "withdraw_fees",
            "transfer_ownership",
        ):
            self.assertIn(f"def {name}(", self.src, msg=name)

    def test_decorators(self):
        self.assertIn("@gl.public.write.payable", self.src)
        self.assertIn("@gl.public.write", self.src)
        self.assertIn("@gl.public.view", self.src)

    def test_eq_principle(self):
        self.assertIn("gl.eq_principle.prompt_comparative", self.src)
        self.assertIn("gl.nondet.web.render", self.src)
        self.assertIn("gl.nondet.exec_prompt", self.src)
        self.assertNotIn("gl.eq_principle.strict_eq", self.src)

    def test_specific_reverts(self):
        for msg in (
            "contract is paused",
            "only owner",
            "zero stake",
            "stake below minimum",
            "cannot challenge own dispute",
            "already challenged",
            "challenge window expired",
            "already resolved",
            "content_ref malformed",
            "invalid address",
            "no fees to withdraw",
        ):
            self.assertIn(msg, self.src)

    def test_fail_safe_json(self):
        self.assertIn("except Exception:", self.src)
        self.assertIn("VERDICT_INCONCLUSIVE", self.src)

    def test_host_policy_hardened(self):
        self.assertIn("nip.io", self.src)
        self.assertIn("0x", self.src)
        self.assertIn("xn--", self.src)
        self.assertIn("_ldh_hostname", self.src)
        self.assertIn("_authority_host", self.src)

    def test_no_forbidden_imports(self):
        self.assertNotIn("import os", self.src)
        self.assertNotIn("import random", self.src)
        self.assertNotIn("import time", self.src)
        self.assertNotRegex(self.src, re.compile(r"^import time", re.M))

    def test_version(self):
        self.assertIn('PROTOCOL_VERSION = "1.3.0"', self.src)


if __name__ == "__main__":
    unittest.main()
