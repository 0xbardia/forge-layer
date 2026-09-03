"""Faithful rehearsal of the Forge Layer Intelligent Contract."""

from __future__ import annotations

import re
import time
from typing import Any

from resolver import inspect_content

MIN_STAKE = 10**17
MAX_CONTENT_REF = 4096
DEFAULT_FEE_BPS = 250
MAX_FEE_BPS = 1000
DEFAULT_WINDOW = 120
DEFAULT_OWNER = "0x0000000000000000000000000000000000000001"
# Recorded verdicts: the three validator rulings plus the explicit
# `unadjudicated` outcome that is assigned when the challenge window
# elapses without a challenger (no validator review occurred).
VERDICT_AI = "ai_generated"
VERDICT_HUMAN = "human_made"
VERDICT_INCONCLUSIVE = "inconclusive"
VERDICT_UNADJUDICATED = "unadjudicated"
# Verdict vocabulary that may be returned by a validator inspection.
# `unadjudicated` is reserved for unchallenged expiries and validators
# must never emit it.
VALIDATOR_VERDICTS = (VERDICT_AI, VERDICT_HUMAN, VERDICT_INCONCLUSIVE)
RECORDED_VERDICTS = (VERDICT_AI, VERDICT_HUMAN, VERDICT_INCONCLUSIVE, VERDICT_UNADJUDICATED)
ADDR_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
METADATA_HOSTS = {
    "localhost",
    "metadata.google.internal",
    "metadata.goog",
    "metadata.google.com",
    "instance-data",
    "instance-data.ec2.internal",
    "kubernetes.default",
    "kubernetes.default.svc",
}
BLOCKED_SUFFIXES = (
    ".local",
    ".internal",
    ".localhost",
    ".localdomain",
    ".onion",
    ".nip.io",
    ".sslip.io",
    ".xip.io",
    ".localtest.me",
    ".lvh.me",
    ".vcap.me",
)


def parse_ipv4(host: str):
    h = host.strip()
    if not h:
        return None
    lower = h.lower()
    if lower.startswith("0x"):
        try:
            n = int(lower, 16)
        except ValueError:
            return None
        if n < 0 or n > 0xFFFFFFFF:
            return None
        return [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]
    if h.isdigit():
        if len(h) > 1 and h[0] == "0":
            return None
        n = int(h)
        if n < 0 or n > 0xFFFFFFFF:
            return None
        return [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]
    parts = h.split(".")
    if not 1 <= len(parts) <= 4:
        return None
    nums: list[int] = []
    for p in parts:
        if not p.isdigit():
            return None
        if len(p) > 1 and p[0] == "0":
            return None
        nums.append(int(p))
    if len(nums) == 4 and all(0 <= x <= 255 for x in nums):
        return nums
    if len(nums) == 1 and 0 <= nums[0] <= 0xFFFFFFFF:
        n = nums[0]
        return [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]
    if len(nums) == 2 and 0 <= nums[0] <= 255 and 0 <= nums[1] <= 0xFFFFFF:
        n = nums[1]
        return [nums[0], (n >> 16) & 255, (n >> 8) & 255, n & 255]
    if len(nums) == 3 and 0 <= nums[0] <= 255 and 0 <= nums[1] <= 255 and 0 <= nums[2] <= 0xFFFF:
        n = nums[2]
        return [nums[0], nums[1], (n >> 8) & 255, n & 255]
    return None


def ipv4_blocked(octets: list[int]) -> bool:
    a, b = octets[0], octets[1]
    if a in (0, 10, 127):
        return True
    if a == 169 and b == 254:
        return True
    if a == 172 and 16 <= b <= 31:
        return True
    if a == 192 and b == 168:
        return True
    if a == 100 and 64 <= b <= 127:
        return True
    if a == 198 and 18 <= b <= 19:
        return True
    if a >= 224:
        return True
    return False


def looks_ip_literal(h: str) -> bool:
    if h.startswith("0x") or ":" in h or h.isdigit():
        return True
    return all(c.isdigit() or c == "." for c in h) and "." in h


def ldh_hostname(h: str) -> bool:
    if not h or len(h) > 253 or h[0] == "-" or h[-1] == "-" or ".." in h:
        return False
    for ch in h:
        o = ord(ch)
        if not ((97 <= o <= 122) or (48 <= o <= 57) or ch in ".-"):
            return False
    for label in h.split("."):
        if not label or len(label) > 63 or label[0] == "-" or label[-1] == "-":
            return False
    return True


def embedded_private(h: str) -> bool:
    parts = h.split(".")
    if len(parts) < 4:
        return False
    for i in range(0, len(parts) - 3):
        chunk = ".".join(parts[i : i + 4])
        octets = parse_ipv4(chunk)
        if octets is not None and ipv4_blocked(octets):
            return True
    return False


def authority_host(authority: str) -> str:
    a = (authority or "").strip()
    if not a:
        return ""
    if a[0] == "[":
        end = a.find("]")
        if end < 2:
            return ""
        return a[1:end]
    if a.count(":") > 1:
        return ""
    return a.split(":")[0]


def host_blocked(host: str) -> bool:
    h = host.lower().strip().strip("[]").rstrip(".")
    if not h or "0x" in h:
        return True
    if h in METADATA_HOSTS:
        return True
    if any(h.endswith(sfx) for sfx in BLOCKED_SUFFIXES):
        return True
    if embedded_private(h):
        return True
    if any(label.startswith("xn--") for label in h.split(".")):
        return True
    octets = parse_ipv4(h)
    if octets is not None:
        return ipv4_blocked(octets)
    if looks_ip_literal(h):
        return True
    if ":" in h:
        return True
    if not ldh_hostname(h):
        return True
    return False


def url_fetchable(content_ref: str) -> bool:
    trimmed = (content_ref or "").strip()
    if not trimmed.lower().startswith("https://"):
        return False
    if any(ch in trimmed for ch in (" ", "\n", "\\", "\x00", "\r")):
        return False
    rest = trimmed.split("://", 1)[1]
    authority = rest.split("/")[0]
    if "@" in authority:
        return False
    host = authority_host(authority)
    return not host_blocked(host)



class ProtocolError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def now() -> int:
    return int(time.time())


def require_addr(value: str, field: str = "caller address required") -> str:
    if not value or not ADDR_RE.match(value):
        raise ProtocolError("invalid address" if value else field)
    return value.lower()


class Registry:
    def __init__(self, conn):
        self.conn = conn
        self._ensure_meta()
        self._maybe_seed()

    def _ensure_meta(self) -> None:
        row = self.conn.execute("select id from registry_meta where id = 1").fetchone()
        if row is None:
            self.conn.execute(
                """insert into registry_meta
                   (id, owner, paused, fee_bps, fee_balance_wei, next_id, min_stake_wei, challenge_window_sec, seeded)
                   values (1, ?, 0, ?, '0', 1, ?, ?, 0)""",
                (DEFAULT_OWNER, DEFAULT_FEE_BPS, str(MIN_STAKE), DEFAULT_WINDOW),
            )
            self.conn.commit()

    def meta(self) -> dict[str, Any]:
        row = self.conn.execute("select * from registry_meta where id = 1").fetchone()
        return dict(row)

    def _not_paused(self) -> None:
        if int(self.meta()["paused"]) == 1:
            raise ProtocolError("contract is paused")

    def _owner(self, caller: str) -> None:
        if caller.lower() != self.meta()["owner"].lower():
            raise ProtocolError("only owner")

    def _row(self, dispute_id: int):
        row = self.conn.execute("select * from disputes where id = ?", (dispute_id,)).fetchone()
        if row is None:
            raise ProtocolError("dispute not found")
        return row

    def pack(self, row) -> dict[str, Any]:
        d = dict(row)
        return {
            "id": int(d["id"]),
            "submitter": d["submitter"],
            "content_type": d["content_type"],
            "content_ref": d["content_ref"],
            "claim": d["claim"],
            "submitter_stake": str(d["submitter_stake_wei"]),
            "status": d["status"],
            "challenger": d["challenger"],
            "challenger_stake": str(d["challenger_stake_wei"]) if d["challenger_stake_wei"] else None,
            "challenge_deadline": int(d["challenge_deadline"]),
            "verdict": d["verdict"],
            "reasoning_summary": d["reasoning_summary"],
            "created_at": int(d["created_at"]),
            "resolved_at": int(d["resolved_at"]) if d["resolved_at"] is not None else None,
            "fee_taken": str(d["fee_taken_wei"] or "0"),
        }

    def get_dispute(self, dispute_id: int) -> dict[str, Any]:
        return self.pack(self._row(dispute_id))

    def list_disputes(
        self,
        offset: int = 0,
        limit: int = 12,
        status_filter: str = "",
        content_type: str = "",
        verdict: str = "",
        q: str = "",
    ) -> dict[str, Any]:
        rows = [self.pack(r) for r in self.conn.execute("select * from disputes order by id desc")]
        if status_filter:
            rows = [r for r in rows if r["status"] == status_filter]
        if content_type:
            rows = [r for r in rows if r["content_type"] == content_type]
        if verdict:
            rows = [r for r in rows if r["verdict"] == verdict]
        if q:
            needle = q.lower()
            rows = [
                r
                for r in rows
                if needle in r["content_ref"].lower()
                or needle in r["submitter"].lower()
                or needle in f"fl-{r['id']:05d}"
                or needle == str(r["id"])
            ]
        offset = max(0, offset)
        limit = min(50, max(1, limit))
        return {"items": rows[offset : offset + limit], "total": len(rows), "offset": offset, "limit": limit}

    def stats(self) -> dict[str, Any]:
        m = self.meta()
        rows = [self.pack(r) for r in self.conn.execute("select * from disputes")]
        staked = 0
        settled = 0
        counts = {"OPEN": 0, "CHALLENGED": 0, "RESOLVED": 0, "EXPIRED_UNCHALLENGED": 0}
        for r in rows:
            counts[r["status"]] = counts.get(r["status"], 0) + 1
            if r["status"] in ("OPEN", "CHALLENGED"):
                staked += int(r["submitter_stake"] or 0) + int(r["challenger_stake"] or 0)
            else:
                settled += int(r["submitter_stake"] or 0) + int(r["challenger_stake"] or 0)
        return {
            "total": len(rows),
            "open": counts["OPEN"],
            "challenged": counts["CHALLENGED"],
            "resolved": counts["RESOLVED"],
            "expired_unchallenged": counts["EXPIRED_UNCHALLENGED"],
            "total_staked": str(staked),
            "total_settled": str(settled),
            "fee_balance": str(m["fee_balance_wei"]),
            "fee_bps": int(m["fee_bps"]),
            "paused": int(m["paused"]) == 1,
            "min_stake": str(m["min_stake_wei"]),
            "challenge_window_seconds": int(m["challenge_window_sec"]),
            "owner": m["owner"],
            "next_id": int(m["next_id"]),
        }

    def _parse_ipv4(self, host: str):
        return parse_ipv4(host)

    def _ipv4_blocked(self, octets: list[int]) -> bool:
        return ipv4_blocked(octets)

    def _host_blocked(self, host: str) -> bool:
        return host_blocked(host)

    def _url_fetchable(self, content_ref: str) -> bool:
        return url_fetchable(content_ref)

    def _validate_ref(self, content_type: str, content_ref: str) -> str:
        if content_type not in ("image", "text"):
            raise ProtocolError("invalid content_type")
        trimmed = (content_ref or "").strip()
        if not trimmed:
            raise ProtocolError("content_ref empty")
        if len(trimmed) > MAX_CONTENT_REF:
            raise ProtocolError("content_ref too long")
        if "\x00" in trimmed or "\r" in trimmed:
            raise ProtocolError("content_ref malformed")
        looks_url = trimmed.lower().startswith("http://") or trimmed.lower().startswith("https://")
        if content_type == "image" or looks_url:
            if not self._url_fetchable(trimmed):
                raise ProtocolError("content_ref malformed")
        return trimmed

    def submit_dispute(self, caller: str, content_type: str, content_ref: str, claim: str, stake_wei: int) -> dict:
        caller = require_addr(caller)
        self._not_paused()
        ref = self._validate_ref(content_type, content_ref)
        if claim not in ("ai_generated", "human_made"):
            raise ProtocolError("invalid claim")
        if stake_wei == 0:
            raise ProtocolError("zero stake")
        if stake_wei < int(self.meta()["min_stake_wei"]):
            raise ProtocolError("stake below minimum")
        m = self.meta()
        did = int(m["next_id"])
        created = now()
        deadline = created + int(m["challenge_window_sec"])
        self.conn.execute(
            """insert into disputes
               (id, submitter, content_type, content_ref, claim, submitter_stake_wei, status,
                challenge_deadline, created_at, fee_taken_wei)
               values (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, '0')""",
            (did, caller, content_type, ref, claim, str(stake_wei), deadline, created),
        )
        self.conn.execute("update registry_meta set next_id = ? where id = 1", (did + 1,))
        self.conn.commit()
        # The execution output exposes the freshly created integer
        # docket id so the client never has to race a separate
        # next_id view against an in-flight transaction.
        return self.get_dispute(did)

    def challenge_dispute(self, caller: str, dispute_id: int, stake_wei: int) -> dict:
        caller = require_addr(caller)
        self._not_paused()
        d = self.get_dispute(dispute_id)
        if d["status"] != "OPEN":
            if d["status"] == "CHALLENGED" or d["challenger"]:
                raise ProtocolError("already challenged")
            raise ProtocolError("dispute not open")
        if now() >= d["challenge_deadline"]:
            raise ProtocolError("challenge window expired")
        if caller == d["submitter"].lower():
            raise ProtocolError("cannot challenge own dispute")
        if stake_wei == 0:
            raise ProtocolError("zero stake")
        if stake_wei != int(d["submitter_stake"]):
            raise ProtocolError("stake must equal submitter stake")
        self.conn.execute(
            """update disputes set status = 'CHALLENGED', challenger = ?, challenger_stake_wei = ?
               where id = ?""",
            (caller, str(stake_wei), dispute_id),
        )
        self.conn.commit()
        return self.get_dispute(dispute_id)

    def resolve_dispute(self, caller: str, dispute_id: int) -> dict:
        require_addr(caller)
        self._not_paused()
        d = self.get_dispute(dispute_id)
        if d["status"] in ("RESOLVED", "EXPIRED_UNCHALLENGED"):
            raise ProtocolError("already resolved")
        ts = now()
        if d["status"] == "OPEN":
            if ts < d["challenge_deadline"]:
                raise ProtocolError("not eligible for resolution")
            # Unchallenged expiry does not adjudicate authenticity. The
            # claim is recorded as `unadjudicated` rather than being
            # attributed to the submitter's initial position.
            self.conn.execute(
                """update disputes set status = 'EXPIRED_UNCHALLENGED', verdict = ?,
                   reasoning_summary = ?, resolved_at = ?, fee_taken_wei = '0' where id = ?""",
                (
                    VERDICT_UNADJUDICATED,
                    "No challenger appeared before the deadline. The dispute window elapsed without a validator review; the original stake was returned to the submitter in full, with no protocol fee deducted.",
                    ts,
                    dispute_id,
                ),
            )
            self.conn.commit()
            return self.get_dispute(dispute_id)
        if d["status"] != "CHALLENGED":
            raise ProtocolError("not eligible for resolution")
        try:
            inspection = inspect_content(d["content_type"], d["content_ref"], d["claim"])
            verdict = inspection["verdict"]
            reasoning = inspection["reasoning"][:1024]
        except Exception:
            verdict = VERDICT_INCONCLUSIVE
            reasoning = "Validators could not complete inspection. Marked inconclusive."
        # Validators may only emit the three standard rulings. Anything
        # else (including `unadjudicated`) collapses to `inconclusive`.
        if verdict not in VALIDATOR_VERDICTS:
            verdict = VERDICT_INCONCLUSIVE
        pot = int(d["submitter_stake"]) + int(d["challenger_stake"] or 0)
        fee = pot * int(self.meta()["fee_bps"]) // 10000
        self.conn.execute(
            """update disputes set status = 'RESOLVED', verdict = ?, reasoning_summary = ?,
               resolved_at = ?, fee_taken_wei = ? where id = ?""",
            (verdict, reasoning, ts, str(fee), dispute_id),
        )
        bal = int(self.meta()["fee_balance_wei"]) + fee
        self.conn.execute("update registry_meta set fee_balance_wei = ? where id = 1", (str(bal),))
        self.conn.commit()
        return self.get_dispute(dispute_id)

    def set_pause(self, caller: str, paused: bool) -> dict:
        self._owner(require_addr(caller))
        self.conn.execute("update registry_meta set paused = ? where id = 1", (1 if paused else 0,))
        self.conn.commit()
        return self.stats()

    def set_fee_bps(self, caller: str, fee_bps: int) -> dict:
        self._owner(require_addr(caller))
        if fee_bps < 0 or fee_bps > MAX_FEE_BPS:
            raise ProtocolError("fee_bps out of range")
        self.conn.execute("update registry_meta set fee_bps = ? where id = 1", (fee_bps,))
        self.conn.commit()
        return self.stats()

    def withdraw_fees(self, caller: str, to: str) -> dict:
        self._owner(require_addr(caller))
        to = require_addr(to, "invalid address")
        m = self.meta()
        if int(m["fee_balance_wei"]) == 0:
            raise ProtocolError("no fees to withdraw")
        self.conn.execute("update registry_meta set fee_balance_wei = '0' where id = 1")
        self.conn.commit()
        return {"withdrawn": str(m["fee_balance_wei"]), "to": to}

    def transfer_ownership(self, caller: str, new_owner: str) -> dict:
        self._owner(require_addr(caller))
        new_owner = require_addr(new_owner, "invalid address")
        if new_owner == "0x0000000000000000000000000000000000000000":
            raise ProtocolError("invalid address")
        self.conn.execute("update registry_meta set owner = ? where id = 1", (new_owner,))
        self.conn.commit()
        return self.stats()

    def accelerate(self, caller: str, dispute_id: int) -> dict:
        self._owner(require_addr(caller))
        d = self.get_dispute(dispute_id)
        if d["status"] != "OPEN":
            raise ProtocolError("dispute not open")
        self.conn.execute(
            "update disputes set challenge_deadline = ? where id = ?",
            (now() - 1, dispute_id),
        )
        self.conn.commit()
        return self.get_dispute(dispute_id)

    def _maybe_seed(self) -> None:
        m = self.meta()
        if int(m["seeded"]) == 1:
            return
        count = self.conn.execute("select count(*) as c from disputes").fetchone()["c"]
        if count:
            self.conn.execute("update registry_meta set seeded = 1 where id = 1")
            self.conn.commit()
            return
        t = now()
        a, b, c = (
            "0x1111111111111111111111111111111111111111",
            "0x2222222222222222222222222222222222222222",
            "0x3333333333333333333333333333333333333333",
        )
        stake = "250000000000000000"
        seeds = [
            (
                1, a, "image",
                "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camille_Pissarro_-_Hoar_Frost.jpg/1280px-Camille_Pissarro_-_Hoar_Frost.jpg",
                "human_made", stake, "RESOLVED", b, stake, t - 80000, "human_made",
                "Brushwork, craquelure, and documented provenance of Pissarro’s Hoar Frost are inconsistent with a generative-model origin. Consensus upholds the human-made claim.",
                t - 200000, t - 70000, "12500000000000000",
            ),
            (
                2, c, "text",
                "In the third week of March the river still carried ice in thin plates, and the mill wheel knocked against them with a sound like spoons in a drawer. I wrote this from the kitchen window while the kettle came to a boil.",
                "human_made", "100000000000000000", "EXPIRED_UNCHALLENGED", None, None, t - 30, "human_made",
                "No challenger appeared before the deadline. The original claim stands by default.",
                t - 400, t - 20, "0",
            ),
            (
                3, b, "image",
                "https://images.unsplash.com/photo-1506905925346-21bda4d32df4",
                "ai_generated", "400000000000000000", "OPEN", None, None, t + 5400, None, None,
                t - 600, None, "0",
            ),
            (
                4, a, "text",
                "As an AI language model, I must emphasize that the following brand manifesto was crafted to maximize stakeholder synergy across our north-star KPIs while remaining authentic to our community.",
                "human_made", "200000000000000000", "CHALLENGED", c, "200000000000000000", t + 2400, None, None,
                t - 1800, None, "0",
            ),
            (
                5, c, "image",
                "https://example.invalid/missing-source.png",
                "ai_generated", "150000000000000000", "RESOLVED", a, "150000000000000000", t - 10000, "inconclusive",
                "The referenced image could not be fetched or rendered by validators. Settlement refunded both stakes minus the protocol fee.",
                t - 50000, t - 9000, "7500000000000000",
            ),
        ]
        self.conn.executemany(
            """insert into disputes
               (id, submitter, content_type, content_ref, claim, submitter_stake_wei, status,
                challenger, challenger_stake_wei, challenge_deadline, verdict, reasoning_summary,
                created_at, resolved_at, fee_taken_wei)
               values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            seeds,
        )
        self.conn.execute(
            """update registry_meta set next_id = 6, seeded = 1, owner = ?, fee_balance_wei = '20000000000000000'
               where id = 1""",
            (DEFAULT_OWNER,),
        )
        self.conn.commit()
