# Changelog

## 1.3.0 — 2026-08-29

- Contract: host policy now rejects hex IPv4, leading-zero / octal dotted forms, IPv6 literals (fail-closed), punycode labels, and DNS-rebinding helpers. Validator JSON parse failures settle inconclusive instead of reverting. `transfer_ownership`. `total_settled` is settled pot volume, not fees.
- Frontend: editorial landing with the layered-plate mark, public `/security` notes, ownership transfer in admin.
- Tests: contract source static review; extra SSRF vectors.
- Open-source packaging: GitHub Actions CI, `.env.example`, hardened `.gitignore`, `pyproject.toml`, SPDX on the contract, standard-library `requirements.txt`.

## 1.2.0 — 2026-08-29

- Contract: HTTPS-only image/URL refs; expanded host policy (loopback encodings, CGNAT, IPv6 ULA/link-local, metadata hosts); inspect-time host re-check so a docket cannot SSRF at resolution.
- Frontend: transaction lifecycle now holds on “awaiting signature” until the wallet returns a hash; admin withdraw reports the amount taken before the vault is emptied; editorial landing with a closed-docket specimen, trust properties, and a roadmap rail.
- Backend: rehearsal inspector refuses non-https URLs and does not follow redirects.
- Tests: host-policy and HTTPS rejection cases added to the protocol suite.

## 1.1.0 — 2026-08-29

- Contract: private-host / credentialed URL rejection, prompt fencing for untrusted content, inspect fallback when screenshot attachment is unavailable, challenge window is exclusive at the deadline, empty fee vault reverts, `get_protocol_info` view.
- Frontend: editorial landing, public roadmap, skip-link, wrong-network banner, genlayer-js writes when `PUBLIC_CONTRACT_ADDRESS` is set, safer image embedding.
- Backend: POST rate limit, security headers, generic 500s, JSON body cap.
- Open-source: MIT license, security policy, code of conduct, issue templates.

## 1.0.0

- Initial Forge Layer: Intelligent Contract, rehearsal server, Next.js frontend, ten QA categories.
