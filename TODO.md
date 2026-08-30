# TODO / open issues

- [ ] Deploy `contract/ForgeLayer.py` via [GenLayer Studio](https://studio.genlayer.com/contracts) with the operator wallet and set `PUBLIC_CONTRACT_ADDRESS`.
- [x] Wire genlayer-js reads/writes in the frontend once the address is live (adapter in `frontend/src/lib/chain.ts` and the App Builder client in `src/lib/actions.ts`; server never signs). Until the address is set, the UI uses the rehearsal registry and shows a clear banner.
- [x] Harden `content_ref` (HTTPS-only URLs, private hosts including encoded IPv4/IPv6/hex/octal, punycode, rebinding helpers, credentials, prompt fencing, inspect-time host re-check, no redirect-follow).
- [x] Public landing, roadmap, security policy, MIT license.
- [ ] Decide production challenge window (on-chain default is 24h; rehearsal uses 120s so the unchallenged path is testable).
- [ ] Indexer: replace SQLite cache with a read-through indexer if the registry grows past a few thousand dockets.
- [ ] Optional: content-ref allowlist / size probe before accepting an image URL on-chain (currently length + URL shape + host policy).
- [ ] Watch for GenVM SDK header bumps (`py-genlayer:…`) and re-verify `exec_prompt(..., images=[])`.
