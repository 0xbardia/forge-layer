# Contract + stack hardening (v1.2.0)

Status: **PASS**

## Contract

- HTTPS-only for image refs and any content that looks like a URL.
- Host policy covers loopback encodings (`127.1`, `2130706433`), RFC1918, CGNAT, link-local, multicast, IPv6 ULA/link-local, metadata hostnames, `.onion` / `.internal`.
- Inspect-time re-check: `_url_fetchable` before `web.render` / `web.get`. Fail-safe `inconclusive`.
- Prompt fencing unchanged. Equivalence Principle still `prompt_comparative` on verdict equality.

## Frontend

- Transaction lifecycle holds on “Awaiting signature” until the wallet returns a hash.
- Admin withdraw reports the vault balance captured **before** the write.
- Landing: specimen docket, trust properties, roadmap rail.
- Field groups no longer wrap button clusters in a `<label>` (accessible names were colliding).

## Backend

- Rehearsal inspector: HTTPS + host policy, redirects disabled.
- Circular import avoided (lazy import of `url_fetchable` inside `_fetch`).

## Tests added

- `test_http_image_rejected`
- `test_private_and_encoded_hosts_rejected`
- `test_https_public_image_accepted`
- `test_text_http_url_rejected`
