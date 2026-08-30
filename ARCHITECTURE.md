# Architecture

```
wallet (MetaMask / rehearsal identity)
        │  genlayer-js writes when address configured
        ▼
   frontend (Next.js / TanStack client)
        │  GET /config  (never hardcodes the address)
        ▼
   server/main.py
        │  rehearsal SQLite  ←→  (optional) read-through cache
        ▼
   ForgeLayer Intelligent Contract   (GenLayer Studio)
        │  gl.nondet.web.render / exec_prompt
        ▼
   validator quorum  →  Equivalence Principle  →  on-chain verdict
```

## On-chain vs off-chain

| Concern | Where it lives |
| --- | --- |
| Dispute state, stakes, verdicts, fees, pause | Contract |
| Content inspection, LLM judgment | Contract nondet path (`eq_principle.prompt_comparative`) |
| `/config`, `/health`, rehearsal, metadata cache | `server/main.py` |
| Wallet connect, tx lifecycle UI | Frontend |
| Signing | Client only |

The rehearsal engine in `server/protocol.py` is a **behavioral twin** of `contract/ForgeLayer.py` so the product is usable before Studio deploy. It is not a production settlement layer. When `PUBLIC_CONTRACT_ADDRESS` is set, the frontend must treat the contract as canonical; the SQLite cache, if used, is read-through and may never disagree with `get_dispute`.

## Design choice: unchallenged expiry

`resolve_dispute` on an `OPEN` docket whose window has elapsed marks `EXPIRED_UNCHALLENGED`, sets `verdict` to the original claim, and **refunds the submitter in full**. There was no opposing stake and no validator work, so no protocol fee is taken.

## Design choice: contested inconclusive

Both sides are refunded `pot - fee`, split equally. Fetch failures (broken image, dead URL, unparseable model output) take this path so a docket cannot brick.

## Challenge window

- On-chain default: 24 hours.
- Rehearsal default: 120 seconds, plus an owner-only `accelerate` helper so the expired path is testable without waiting.

## Backend scope (deliberately small)

`PUBLIC_CONTRACT_ADDRESS` (env, default `""`), `/config`, `/health`, SQLite rehearsal/cache, optional static export hosting. No user-key custody. No “server decides the verdict” in production.
