# Contract security audit — 1.3.0

Audited `contract/ForgeLayer.py` against GenLayer docs (`Depends` header `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`, `gl.eq_principle.prompt_comparative` for LLM output, `datetime.now(timezone.utc)` as the documented transaction clock).

## Findings (fixed in 1.3.0)

| Issue | Severity | Fix |
| --- | --- | --- |
| Hex IPv4 (`0x7f000001`) bypassed the host policy | High (SSRF) | Any `0x` in the host is rejected; hex literals parsed then blocked if private |
| Leading-zero / octal dotted forms (`0177.0.0.1`) | High (SSRF) | Octets with a leading zero fail parse and the host is blocked |
| Unbracketed IPv6 authority parsed as `[` | Medium | `_authority_host` extracts bracketed IPv6; all IPv6 literals fail-closed |
| DNS-rebinding helpers (`nip.io`, `sslip.io`, …) | Medium | Suffix denylist + embedded private IPv4 in hostnames |
| Punycode / IDN (`xn--`) homographs | Medium | Any `xn--` label is blocked; non-LDH hostnames rejected |
| `json.loads` of validator output could revert and leave a docket CHALLENGED | Medium | Parse failure settles `inconclusive` |
| `total_settled` counted fees, not settled pots | Low | Sum of submitter+challenger stakes on closed dockets |
| No ownership transfer | Low (ops) | `transfer_ownership` (rejects zero address) |

## Still true

- Payable submit/challenge, equal stake, no self-challenge, exclusive deadline
- CEI: status/verdict/fee written before `_pay`
- Pause gates writes; owner methods do not
- Prompt fencing `<<<UNTRUSTED …>>>`; verdict clamped to three values
- Inspect-time host re-check; unreachable → inconclusive
- No `random` / `os` / `time` imports (linter Layer 1)

## Studio

Deploy is wallet-signed at [studio.genlayer.com/contracts](https://studio.genlayer.com/contracts). See `scripts/STUDIO.md` for the Read-method checklist. This environment cannot hold the operator key.

## Evidence

`python3 -m unittest tests.test_protocol tests.test_contract_source` — 41 cases, all passing after the zero-address transfer fix.
