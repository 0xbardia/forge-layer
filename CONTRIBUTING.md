# Contributing to Forge Layer

The contract is the source of truth. The frontend is a client. The Python server is a rehearsal + `/config` host, not a shadow ledger for production.

## Layout

- `contract/` — Studio-deployable Intelligent Contract and its spec.
- `frontend/` — Vercel-deployable Next.js app (static export for QA).
- `server/main.py` — `PUBLIC_CONTRACT_ADDRESS`, `/config`, `/health`, rehearsal API.
- `tests/` — the ten QA categories from the mission prompt.

## Prerequisites

- Python 3.10+ (stdlib only — no pip packages)
- Node 20+ (frontend + PM2)

```bash
cp .env.example .env   # optional; leave PUBLIC_CONTRACT_ADDRESS empty for rehearsal
```

## Local rehearsal

```bash
python3 server/main.py
# in another shell
cd frontend && npm install && npm run dev
```

Set `PUBLIC_CONTRACT_ADDRESS` to a Studio-deployed address to switch the frontend onto genlayer-js writes. Until it is set, the UI must show a clear “contract not configured” state and may use the rehearsal registry.

## Tests

```bash
python3 -m unittest discover -s tests -v
cd frontend && npm run typecheck && npm run build
bash scripts/start-qa.sh    # production export + PM2 on a random port
```

CI (`.github/workflows/ci.yml`) runs the Python suite, a private-key scan, frontend typecheck, and `next build`.

## Rules of the road

- No private keys in the repo or on the server.
- Client-side signatures only for on-chain writes.
- Reverts have specific strings (see `contract/SPEC.md`).
- Do not add server logic that belongs on-chain.
- Keep `server/protocol.py` a behavioral twin of `contract/ForgeLayer.py` when you change the state machine.
- Open an issue before changing fee semantics or the unchallenged-expiry refund rule.
- Match the visual direction in `frontend/DESIGN.md` (iron/bone, no purple, no emoji in the product UI).
