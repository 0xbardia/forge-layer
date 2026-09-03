"""End-to-end on-chain lifecycle tests for Forge Layer.

These tests exercise the in-process rehearsal engine at
``server/protocol.py``. The contract, the backend, and the
client-driven flow all reach for the same contract state, so validating
the rehearsal surface here is the closest deterministic equivalent to
running the full Studio stack.

The three suites required by the v1.4.0 brief:

* ``DirectIdReturnTests`` — confirms that ``submit_dispute`` returns
  the freshly assigned integer docket id from its execution output
  and that consecutive calls advance the counter without a separate
  ``next_id`` view call.
* ``UnchallengedExpiryTests`` — the full lifecycle for an OPEN docket
  whose challenge window elapses without a challenger: it asserts the
  ``EXPIRED_UNCHALLENGED`` status, the strict ``unadjudicated`` verdict,
  zero protocol-fee deductions, and a full stake return to the
  submitter (validated through the reasoning copy + zero fee).
* ``ValidatorVerdictBoundaryTests`` — confirms that resolution
  following a challenge permits only the three standard validator
  rulings; ``unadjudicated`` is rejected and collapses to
  ``inconclusive`` regardless of what a prompt returned.
"""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "server"))

from protocol import (  # noqa: E402
    RECORDED_VERDICTS,
    VALIDATOR_VERDICTS,
    VERDICT_UNADJUDICATED,
    ProtocolError,
    Registry,
)
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


class DirectIdReturnTests(unittest.TestCase):
    """Confirm submit_dispute exposes the new id directly."""

    def setUp(self) -> None:
        self.r = fresh()

    def test_first_submit_returns_id_directly(self):
        # Snapshot next_id before submission. The contract returns
        # the freshly assigned integer docket id from its execution
        # output — the rehearsal mirrors that — so there is no need
        # for an external view call.
        before = int(self.r.meta()["next_id"])
        d = self.r.submit_dispute(A, "text", "first human sentence", "human_made", STAKE)
        self.assertIsInstance(d["id"], int)
        self.assertEqual(d["id"], before)
        self.assertGreater(d["id"], 0)

    def test_consecutive_submissions_increment_id(self):
        # Direct output — no view call — proves the id moves
        # monotonically without an external next_id fetch.
        start = int(self.r.meta()["next_id"])
        d1 = self.r.submit_dispute(A, "text", "first sentence", "ai_generated", STAKE)
        d2 = self.r.submit_dispute(B, "text", "second sentence", "human_made", STAKE)
        d3 = self.r.submit_dispute(C, "text", "third sentence", "human_made", STAKE)
        self.assertEqual(d1["id"], start)
        self.assertEqual(d2["id"], start + 1)
        self.assertEqual(d3["id"], start + 2)

    def test_id_returned_with_does_not_require_next_id(self):
        # Snapshot next_id, submit, then assert the returned id is
        # the pre-submit next_id. The contract should never rely on
        # the post-submit counter view.
        before = int(self.r.meta()["next_id"])
        d = self.r.submit_dispute(A, "text", "before and after", "ai_generated", STAKE)
        after = int(self.r.meta()["next_id"])
        self.assertEqual(d["id"], before)
        self.assertEqual(after, before + 1)


class UnchallengedExpiryTests(unittest.TestCase):
    """Full lifecycle for a docket that expires without a challenger."""

    def setUp(self) -> None:
        self.r = fresh()

    def test_full_lifecycle_unadjudicated(self):
        # 1. Submit a dispute with a valid stake.
        d = self.r.submit_dispute(A, "text", "an unchallenged text", "human_made", STAKE)
        self.assertEqual(d["status"], "OPEN")
        self.assertEqual(d["verdict"], None)

        # 2. Advance wall-clock time past the challenge window. The
        # rehearsal exposes ``accelerate`` as the deterministic way
        # to step past the deadline without sleeping.
        self.r.accelerate(OWNER, d["id"])
        pre_fee_balance = int(self.r.stats()["fee_balance"])

        # 3. Resolve without a challenger.
        out = self.r.resolve_dispute(C, d["id"])

        # 4. Final status is EXPIRED_UNCHALLENGED.
        self.assertEqual(out["status"], "EXPIRED_UNCHALLENGED")

        # 5. Verdict is strictly ``unadjudicated``.
        self.assertEqual(out["verdict"], VERDICT_UNADJUDICATED)
        # The verdict must NOT echo the submitter's initial claim —
        # this is the core regression for the v1.4.0 brief.
        self.assertNotEqual(out["verdict"], d["claim"])
        self.assertNotEqual(out["verdict"], "ai_generated")
        self.assertNotEqual(out["verdict"], "human_made")

        # 6. Protocol fee deductions remain zero. The full stake
        # returns to the submitter with no fee taken — the
        # rehearsal's protocol.fee_balance is the closest
        # deterministic equivalent to a GEN ledger.
        post_fee_balance = int(self.r.stats()["fee_balance"])
        self.assertEqual(post_fee_balance, pre_fee_balance)
        self.assertEqual(out["fee_taken"], "0")

        # 7. The submitter receives their full original stake back.
        # The contract's resolve_dispute calls `` self._pay(
        # self.submitter[dispute_id], stake) `` for an unchallenged
        # expiry. The rehearsal mirrors the math by storing the
        # fee_taken_wei field as zero and surfacing the
        # unadjudicated verdict — together these are the only two
        # invariants the rehearsal can deterministically observe.
        # Both must hold for "full stake returned, no deduction".
        self.assertEqual(out["fee_taken"], "0")
        # And the contract copy explicitly notes the stake return
        # in the reasoning_summary so downstream readers can audit
        # the lifecycle path.
        self.assertIsInstance(out["reasoning_summary"], str)
        self.assertIn("returned", out["reasoning_summary"].lower())

    def test_resolve_before_deadline_unchallenged_is_not_eligible(self):
        d = self.r.submit_dispute(A, "text", "an open dispute", "human_made", STAKE)
        with self.assertRaises(ProtocolError) as ctx:
            self.r.resolve_dispute(C, d["id"])
        self.assertEqual(str(ctx.exception), "not eligible for resolution")

    def test_resolve_twice_after_expiry_rejected(self):
        d = self.r.submit_dispute(A, "text", "expire twice", "human_made", STAKE)
        self.r.accelerate(OWNER, d["id"])
        self.r.resolve_dispute(C, d["id"])
        with self.assertRaises(ProtocolError) as ctx:
            self.r.resolve_dispute(C, d["id"])
        self.assertEqual(str(ctx.exception), "already resolved")


class ValidatorVerdictBoundaryTests(unittest.TestCase):
    """Confirm validators only emit the standard rulings."""

    def setUp(self) -> None:
        self.r = fresh()

    def test_unadjudicated_cannot_be_emitted_by_validator(self):
        # A validator prompt path that somehow returns
        # ``unadjudicated`` must collapse to ``inconclusive``. The
        # contract rejects the verdict explicitly so the
        # submitter-side claim is never silently promoted.
        d = self.r.submit_dispute(A, "text", "spoof validator output", "human_made", STAKE)
        self.r.challenge_dispute(B, d["id"], STAKE)
        with mock.patch(
            "protocol.inspect_content",
            return_value={"verdict": VERDICT_UNADJUDICATED, "reasoning": "spoof"},
        ):
            out = self.r.resolve_dispute(C, d["id"])
        self.assertEqual(out["status"], "RESOLVED")
        self.assertNotEqual(out["verdict"], VERDICT_UNADJUDICATED)
        self.assertEqual(out["verdict"], "inconclusive")

    def test_only_validator_verdicts_are_admitted(self):
        # Cycle every recorded verdict and confirm only the three
        # standard validator rulings survive the boundary check.
        # The unadjudicated verdict must never appear.
        for verdict in RECORDED_VERDICTS:
            d = self.r.submit_dispute(
                A, "text", f"boundary probe {verdict}", "human_made", STAKE
            )
            self.r.challenge_dispute(B, d["id"], STAKE)
            with mock.patch(
                "protocol.inspect_content",
                return_value={"verdict": verdict, "reasoning": "probe"},
            ):
                out = self.r.resolve_dispute(C, d["id"])
            self.assertEqual(out["status"], "RESOLVED")
            if verdict in VALIDATOR_VERDICTS:
                self.assertEqual(out["verdict"], verdict)
            else:
                # unadjudicated (and anything else outside the
                # validator vocabulary) must collapse to inconclusive.
                self.assertEqual(out["verdict"], "inconclusive")
                self.assertNotEqual(out["verdict"], VERDICT_UNADJUDICATED)

    def test_arbitrary_string_outside_vocabulary_collapsed(self):
        d = self.r.submit_dispute(A, "text", "garbage prompt", "human_made", STAKE)
        self.r.challenge_dispute(B, d["id"], STAKE)
        with mock.patch(
            "protocol.inspect_content",
            return_value={"verdict": "maybe_sorta_ai", "reasoning": "garbage"},
        ):
            out = self.r.resolve_dispute(C, d["id"])
        self.assertEqual(out["verdict"], "inconclusive")
        self.assertNotIn(out["verdict"], [VERDICT_UNADJUDICATED])


class ProtocolVocabularyTests(unittest.TestCase):
    """Sanity checks for the public vocabulary constants."""

    def test_recorded_verdicts_include_unadjudicated(self):
        self.assertIn(VERDICT_UNADJUDICATED, RECORDED_VERDICTS)

    def test_validator_verdicts_exclude_unadjudicated(self):
        self.assertNotIn(VERDICT_UNADJUDICATED, VALIDATOR_VERDICTS)
        self.assertEqual(
            set(VALIDATOR_VERDICTS),
            {"ai_generated", "human_made", "inconclusive"},
        )


if __name__ == "__main__":
    unittest.main()