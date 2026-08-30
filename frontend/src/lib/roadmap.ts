export type PhaseStatus = "shipping" | "next" | "later" | "horizon";

export interface RoadmapPhase {
  id: string;
  name: string;
  window: string;
  status: PhaseStatus;
  summary: string;
  items: string[];
}

export const ROADMAP: RoadmapPhase[] = [
  {
    id: "0",
    name: "The forge",
    window: "Now",
    status: "shipping",
    summary:
      "A complete, Studio-deployable registry: Intelligent Contract, rehearsal engine, public docket, and wallet-signed writes.",
    items: [
      "submit / challenge / resolve with GEN stakes and specific reverts",
      "Validator inspection via gl.nondet + Equivalence Principle consensus",
      "Public registry, citable docket pages, admin pause/fee/withdraw",
      "Vercel-ready frontend; graceful degradation until PUBLIC_CONTRACT_ADDRESS is set",
    ],
  },
  {
    id: "1",
    name: "On the record",
    window: "Q4 2026",
    status: "next",
    summary:
      "Take the rehearsal off the critical path. Make every closed docket something a newsroom or rights desk can actually cite.",
    items: [
      "Studio deploy on studionet, then Bradbury testnet, then mainnet",
      "Read-through indexer so pagination stays fast past a few thousand dockets",
      "Shareable citation cards and an embeddable docket widget",
      "Content-ref allowlist / size probe before an image URL is accepted on-chain",
    ],
  },
  {
    id: "2",
    name: "Chamber",
    window: "H1 2027",
    status: "later",
    summary:
      "Richer evidence, a bounded appeals path, and a reputation that follows wallets without turning into a social graph.",
    items: [
      "Audio and short-video content types (same stake machine, new inspect path)",
      "One-shot appeal window after an inconclusive or disputed verdict",
      "Optional watcher bonds so spam filings become expensive",
      "Warden reputation: win/loss/inconclusive history, never a credit score",
    ],
  },
  {
    id: "3",
    name: "Attestation",
    window: "H2 2027",
    status: "horizon",
    summary:
      "Forge Layer as a primitive other contracts and courts can call — not a destination website.",
    items: [
      "Cross-registry attestations other Intelligent Contracts can read",
      "Legal export packs: signed PDF + on-chain receipt for a closed docket",
      "Watch GenVM SDK headers and re-verify exec_prompt image attachment",
      "Permissionless mirrors: anyone can host a read-only registry against the same contract",
    ],
  },
];

export const FAQ = [
  {
    q: "Is this on-chain, or a demo?",
    a: "The Intelligent Contract is the source of truth. Until you paste a Studio-deployed address into PUBLIC_CONTRACT_ADDRESS, the app runs a faithful rehearsal of the same state machine so the product is usable. The UI labels that state clearly. Writes are never signed by the server.",
  },
  {
    q: "What happens if nobody challenges?",
    a: "After the window closes, anyone can resolve. The original claim stands and the submitter’s stake is returned in full. No protocol fee — there was no opposing stake and no validator work.",
  },
  {
    q: "What if validators cannot fetch the source?",
    a: "The docket resolves as inconclusive. Both stakes are refunded minus the protocol fee. A broken URL cannot brick the pipeline or punish the other side.",
  },
  {
    q: "Who can trigger resolution?",
    a: "Anyone, once the docket is challenged or the challenge window has expired. Resolution is a public good, not a privileged role.",
  },
  {
    q: "Can I challenge my own filing?",
    a: "No. Self-challenge, double-challenge, late challenge, mismatched stake, and paused-state writes all revert with a specific error.",
  },
] as const;
