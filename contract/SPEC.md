# Forge Layer Intelligent Contract — specification

Studio-deployable source: [`ForgeLayer.py`](./ForgeLayer.py)

Depends: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`

## Storage

Registry-level: `owner`, `paused`, `fee_bps` (default 250), `fee_balance`, `next_id` (starts at 1), `min_stake` (0.1 GEN), `challenge_window_seconds` (86400 on-chain).

Per dispute, parallel `TreeMap[u256, …]` fields: `submitter`, `content_type`, `content_ref`, `claim`, `submitter_stake`, `status`, `challenger`, `challenger_stake`, `challenge_deadline`, `verdict`, `reasoning_summary`, `created_at`, `resolved_at`, `fee_taken`.

Absence of a challenger is represented by the zero address.

## Status machine

`OPEN` → `CHALLENGED` → `RESOLVED`

`OPEN` → `EXPIRED_UNCHALLENGED` when `resolve_dispute` is called after the challenge deadline with no challenger.

## Methods

| Method | Kind | Behavior |
| --- | --- | --- |
| `submit_dispute(content_type, content_ref, claim)` | payable write | Validates type/ref/claim, requires `value >= min_stake`, opens a docket. |
| `challenge_dispute(dispute_id)` | payable write | Only `OPEN` before deadline. Rejects self-challenge, double-challenge, mismatched stake. |
| `resolve_dispute(dispute_id)` | write | See resolution algorithm. Idempotent: already-resolved reverts. |
| `get_dispute(id)` | view | Packed dict. |
| `list_disputes(offset, limit, status_filter)` | view | Newest first, `limit` capped at 50. Empty filter = all. |
| `get_registry_stats()` | view | Counts, live staked, settled pots, pause/fee/owner. |
| `get_protocol_info()` | view | Name, version, owner, pause, fee, min stake, window, limits. |
| `set_fee_bps(new_fee)` | owner write | `new_fee <= 1000`. |
| `set_pause(paused)` | owner write | |
| `withdraw_fees(to)` | owner write | Sends `fee_balance` to `to`. Reverts if vault is empty or `to` is zero. |
| `transfer_ownership(new_owner)` | owner write | Reverts on the zero address. |

All user-facing reverts use `gl.vm.UserError` with a specific string (see errors below).

Image `content_ref` must be `https` (not `http`) without credentials, without private/loopback hosts. The host policy rejects:

- loopback (`127.0.0.0/8`, `::1`, `localhost`, dotted-decimal encodings such as `127.1` and `2130706433`)
- hex IPv4 (`0x7f000001`), leading-zero / octal dotted forms (`0177.0.0.1`)
- RFC1918, link-local (`169.254.0.0/16`), CGNAT (`100.64.0.0/10`), benchmark (`198.18.0.0/15`), multicast/reserved (`224.0.0.0/4` and above)
- IPv6 literals (fail-closed), IPv4-mapped IPv6
- metadata hostnames (`metadata.google.internal`, `instance-data`, Kubernetes defaults)
- `.local` / `.internal` / `.onion`, trailing-dot tricks, userinfo in the authority
- DNS-rebinding helpers (`nip.io`, `sslip.io`, `xip.io`, `lvh.me`, …) and private IPv4 embedded as a hostname prefix
- Punycode / IDN labels (`xn--…`) and any non-LDH hostname

NUL/CR bytes are rejected for every ref. If a **text** excerpt is itself a URL, the same policy applies. Inspection never fetches a URL that would fail this check — it returns structured `inconclusive` instead of following a redirect into a private network. Cited content is fenced as untrusted data in the inspect prompt. Malformed validator JSON settles inconclusive rather than reverting.

## Resolution algorithm

1. If `OPEN` and `now >= challenge_deadline`: set `EXPIRED_UNCHALLENGED`, verdict = original claim, refund submitter **in full**, fee = 0. This is a deliberate choice: there was no opposing stake and no validator work. At the deadline, challenges are rejected and resolution becomes eligible.
2. If `CHALLENGED`: run `_inspect` inside `gl.eq_principle.prompt_comparative`.
   - Images: `gl.nondet.web.render(url, mode="screenshot")` then `gl.nondet.exec_prompt(..., images=[rendered])`. If the image parameter is unavailable, the prompt runs without it and must return inconclusive when inspection is impossible.
   - Text: optional `gl.nondet.web.get` when the ref is a URL, else the excerpt itself. Content is wrapped in `<<<UNTRUSTED …>>>` so it cannot rewrite the task.
   - The leader and validators must agree on the `verdict` field exactly. Reasoning may differ in wording.
   - Any fetch/parse failure **returns structured inconclusive JSON** — the docket is never left stuck.
3. Settlement of a contested docket:
   - `fee = pot * fee_bps / 10000`
   - `verdict == submitter.claim` → submitter receives `pot - fee`
   - `verdict` is the opposite claim → challenger receives `pot - fee`
   - `inconclusive` → remainder split equally; 1-wei dust stays in the fee vault

## Errors

`contract is paused`, `only owner`, `stake below minimum`, `zero stake`, `invalid content_type`, `invalid claim`, `content_ref empty`, `content_ref too long`, `content_ref malformed`, `dispute not found`, `dispute not open`, `challenge window expired`, `cannot challenge own dispute`, `already challenged`, `stake must equal submitter stake`, `already resolved`, `not eligible for resolution`, `invalid address`, `fee_bps out of range`, `no fees to withdraw`.

## Pause

`submit_dispute`, `challenge_dispute`, and `resolve_dispute` revert while paused. Owner methods do not.
