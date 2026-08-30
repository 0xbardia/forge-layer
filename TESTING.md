# Testing

Reports land in [`tests/reports/`](./tests/reports/). Every category in the mission prompt is executed, not merely described.

```bash
python3 tests/run_suite.py
```

| # | Category | How it is run |
| --- | --- | --- |
| 1 | Functional | `tests/test_protocol.py` — submit, challenge, both resolve paths, pagination, admin, pause |
| 2 | Database | `tests/test_database.py` — empty migrate, populated v1 migrate, CRUD |
| 3 | Integration | `tests/test_http.py` — `/config` → writes → reads |
| 4 | E2E | HTTP journey submit→challenge→resolve; UI journey via Chromium |
| 5 | Security | self-challenge, double-challenge, non-owner admin, injection in `content_ref`, replay resolve, javascript / localhost / encoded-loopback / RFC1918 / metadata / plaintext-`http` image URLs, empty fee vault |
| 6 | Wallet / Web3 | rehearsal identities; revert parsing for rejection / underpriced; wrong-network banner |
| 7 | UI/UX | desktop + mobile smoke, form validation, empty/loading/error |
| 8 | Build/deploy | `next build` export; PM2 `scripts/start-qa.sh`; health after start and after `pm2 restart` |
| 9 | Chromium | `node tests/chromium_smoke.mjs <QA_URL>` (Playwright). Zero unexpected console errors, docket centerpiece, mobile overflow. |
| 10 | Regression | `run_suite.py` re-executes after fixes |
| 11 | Hardening | v1.2.0 host policy + inspect-time SSRF guard. See `11_hardening.md`. |
| 12 | Playwright interactive | `node tests/playwright_qa.mjs <URL>` — HTTP image rejection, submit → challenge → resolve, registry search, roadmap. |
| 13 | Contract source audit | `tests/test_contract_source.py` + `13_contract_audit.md`. Hex/octal/punycode/rebinding host policy, fail-safe JSON, `transfer_ownership`. |

Contract-level tests cannot hit a live GenVM from this environment; the rehearsal engine is kept in lockstep with `contract/SPEC.md` so a Studio deploy can be verified by the same cases.
