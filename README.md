# Forge Layer

A public **AI-versus-human authenticity dispute registry** on [GenLayer](https://genlayer.com).

Anyone can file a claim about an image URL or a text excerpt (`ai_generated` or `human_made`), bond GEN to it, and invite contest. Independent validators inspect the source through GenLayer’s non-deterministic LLM execution and write a durable verdict on-chain.

MIT licensed. See [`SECURITY.md`](./SECURITY.md), [`CONTRIBUTING.md`](./CONTRIBUTING.md), and [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## Why this layout

| Path | Role |
| --- | --- |
| [`contract/`](./contract/) | Studio-deployable Intelligent Contract (`ForgeLayer.py`) and the written spec. |
| [`frontend/`](./frontend/) | Vercel-deployable Next.js app. Reads `/config` at runtime; never hardcodes the contract address. |
| [`server/main.py`](./server/main.py) | `PUBLIC_CONTRACT_ADDRESS`, `/config`, `/health`, and a rehearsal registry used until Studio deploy. |
| [`tests/`](./tests/) | The ten QA categories, with reports under `tests/reports/`. |
| [`scripts/`](./scripts/) | QA bring-up under PM2 (`start-qa.sh`). |

The contract is the source of truth. The server does not sign user transactions. The frontend signs writes client-side via `genlayer-js` once an address is configured.

## Requirements

- Python 3.10+ (standard library only — see `requirements.txt`)
- Node.js 20+ (frontend + optional PM2)

```bash
cp .env.example .env   # optional
```

## Local rehearsal

Until you paste a Studio-deployed address into `PUBLIC_CONTRACT_ADDRESS`, the app runs a **faithful rehearsal** of the same state machine (same errors, same settlement rules, LLM inspection via xAI when `XAI_API_KEY` is present). The UI labels this clearly.

```bash
python3 server/main.py
cd frontend && npm install && npm run dev
```

```bash
python3 -m unittest discover -s tests -v
cd frontend && npm run typecheck && npm run build
```

## Deploy the contract (manual)

GenLayer Studio requires the operator wallet. This repo never contains a private key.

1. Open [GenLayer Studio](https://studio.genlayer.com/contracts).
2. Paste [`contract/ForgeLayer.py`](./contract/ForgeLayer.py). Keep the first-line `Depends` header.
3. Deploy with your operator wallet.
4. In Studio, run every **Read** method:
   - `get_protocol_info()` — expect `name: Forge Layer`, `version: 1.3.0`, `paused: false`, `next_id: 1`
   - `get_registry_stats()` — expect `total: 0`, `open: 0`, `fee_bps: 250`
   - `list_disputes(0, 12, "")` — expect `items: []`, `total: 0`
   - `get_dispute(1)` — expect `dispute not found` on a fresh deploy
5. Set `PUBLIC_CONTRACT_ADDRESS=0x…` on the server / Vercel project and redeploy the frontend.

Full checklist: [`scripts/STUDIO.md`](./scripts/STUDIO.md).

## Deploy the frontend (Vercel)

```bash
cd frontend
npx vercel deploy
```

Environment:

| Name | Where | Purpose |
| --- | --- | --- |
| `PUBLIC_CONTRACT_ADDRESS` | server / Vercel | Studio-deployed `0x` address. Empty = rehearsal. |
| `XAI_API_KEY` | server only | Optional. Used by the rehearsal inspector. Never `VITE_` / `NEXT_PUBLIC_`. |

Point the app at the backend `/config` URL (same origin if the Python server serves `frontend/out`).

`frontend/vercel.json` sets `framework: nextjs`, security headers, and SPA rewrites for `/disputes/:id`.

## QA stack

```bash
bash scripts/start-qa.sh
# prints IP:PORT once /health is green
```

## Protocol in one paragraph

`submit_dispute` (payable) opens a docket. `challenge_dispute` (payable, equal stake, not self, before deadline) contests it. `resolve_dispute` either closes an expired unchallenged docket (claim stands, stake returned) or runs validator inspection + Equivalence Principle consensus and settles the pot minus `fee_bps`. Unreachable content resolves as `inconclusive` rather than trapping the docket.

Image and URL refs must be `https`. Private, loopback, metadata, and encoded hosts are rejected at submit and again at inspect.

## License

[MIT](./LICENSE) © 2026 Forge Layer contributors.
