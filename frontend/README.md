# Forge Layer frontend

Vercel-deployable Next.js 15 app (static export). Visual direction: [`DESIGN.md`](./DESIGN.md).

This package never hardcodes a contract address. It reads `/config` at runtime.

```bash
npm install
npm run dev          # local Next.js
npm run typecheck
npm run build        # writes ./out for the Python QA server / Vercel
```

Writes (`submit_dispute`, `challenge_dispute`, `resolve_dispute`) are signed in the browser via `genlayer-js` once `PUBLIC_CONTRACT_ADDRESS` is a 40-hex address. Until then the UI is a labelled rehearsal of the same state machine.

See the [root README](../README.md) for Studio deploy, environment variables, and the protocol.
