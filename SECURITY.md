# Security

Forge Layer is a stake-and-consensus registry. The Intelligent Contract is the production source of truth. This document is the threat model we actually implemented — not a template.

## Reporting a vulnerability

Use **GitHub Security Advisories** on this repository. Do not open a public issue for a live fund-loss bug, leaked key, or SSRF in the inspect path.

Include:

- Affected surface (`contract/ForgeLayer.py`, `server/`, `frontend/`)
- A reproduction against the current `main` (docket id, revert string, or PoC)
- Impact (funds, SSRF, prompt injection that changes a verdict)

We will credit reports that include a reproduction against `contract/ForgeLayer.py`.

Never paste private keys, seed phrases, or production `XAI_API_KEY` values.

## Trust boundaries

| Surface | Trust |
| --- | --- |
| `contract/ForgeLayer.py` | Canonical. Validators re-execute writes. Nondet inspection is confined to `gl.eq_principle.prompt_comparative`. |
| User wallet | Signs `submit_dispute`, `challenge_dispute`, `resolve_dispute`, and owner methods. |
| `server/main.py` | `/config`, `/health`, rehearsal registry. **Never holds a private key. Never signs.** |
| Frontend | A client. Reads public state. Asks the wallet to sign. |

Until `PUBLIC_CONTRACT_ADDRESS` is a 40-hex address, the UI is a rehearsal of the same state machine and must say so.

## What the contract rejects

- Writes while paused (`submit`, `challenge`, `resolve`)
- Non-owner admin (`set_fee_bps`, `set_pause`, `withdraw_fees`, `transfer_ownership`)
- Zero stake, stake below `min_stake`, mismatched challenge stake
- Self-challenge, double-challenge, challenge at/after deadline
- Empty, oversized, NUL/CR, credentialed, plaintext-`http`, or private-host `content_ref`
- Hex IPv4 (`0x7f000001`), leading-zero / octal dotted forms, IPv6 literals, punycode (`xn--`), nip.io-style rebinding helpers
- Replay of `resolve_dispute`
- Withdraw of an empty fee vault
- Fee above 1000 bps
- Transfer of ownership to the zero address or by a non-owner

Unreachable content, and URLs that fail the host policy at inspect time, resolve as `inconclusive` rather than trapping a docket. Rehearsal fetches use `https` only and do not follow redirects.

## Prompt injection

Cited text and image URLs are untrusted. The inspect prompt fences them in `<<<UNTRUSTED … UNTRUSTED>>>` and instructs validators to treat the block as data, never as instructions. Verdicts are parsed as JSON and clamped to `{ai_generated, human_made, inconclusive}`.

## What the frontend must not do

- Render `content_ref` as HTML
- Load images that are not `http:`/`https:` or that resolve to loopback/private hosts
- Hardcode a contract address
- Sign with a server key
