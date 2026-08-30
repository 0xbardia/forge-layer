# Studio deploy checklist

GenLayer Studio requires the operator wallet. This repo never contains a private key and cannot deploy for you.

1. Open [studio.genlayer.com/contracts](https://studio.genlayer.com/contracts).
2. Paste `contract/ForgeLayer.py` (keep the first-line `Depends` header).
3. Deploy with the operator wallet. The deployer becomes `owner`.
4. Run every **Read** method:

| Method | Args | Fresh-deploy expectation |
| --- | --- | --- |
| `get_protocol_info` | — | `name = Forge Layer`, `version = 1.3.0`, `paused = false`, `fee_bps = 250`, `next_id = 1` |
| `get_registry_stats` | — | `total = 0`, `open = 0`, `challenged = 0`, `resolved = 0`, `min_stake = 100000000000000000` |
| `list_disputes` | `0`, `12`, `""` | `items = []`, `total = 0`, `limit = 12` |
| `get_dispute` | `1` | reverts `dispute not found` |

5. Optional write smoke (small GEN): `submit_dispute("text", "a short human sentence", "human_made")` with value ≥ 0.1 GEN, then `get_dispute(1)` should return `OPEN`.
6. Set `PUBLIC_CONTRACT_ADDRESS` on the server / Vercel project to the deployed `0x` address and redeploy the frontend.

If a Read method fails, do not set the address. Re-paste the contract and deploy again.
