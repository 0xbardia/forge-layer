/**
 * On-chain adapter. Loaded only in the browser when PUBLIC_CONTRACT_ADDRESS is set.
 * The server never holds a private key — MetaMask / a GenLayer-compatible wallet signs.
 */

import type { AppConfig, Dispute, ListResult, RegistryStats } from "./protocol";
import { getEthereum } from "./wallet";

export function parseRevert(err: unknown): string {
  if (!err) return "Transaction failed";
  if (typeof err === "string") return humanize(err);
  if (err instanceof Error) return humanize(err.message || "Transaction failed");
  if (typeof err === "object") {
    const rec = err as { message?: string; shortMessage?: string; cause?: { message?: string } };
    return humanize(rec.shortMessage || rec.message || rec.cause?.message || "Transaction failed");
  }
  return "Transaction failed";
}

function humanize(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected the request")) {
    return "Signature rejected in wallet";
  }
  if (lower.includes("insufficient funds")) return "Wallet has insufficient GEN";
  if (lower.includes("wrong network") || lower.includes("chain mismatch") || lower.includes("unrecognized chain")) {
    return "Wrong network. Switch your wallet to the GenLayer chain and retry.";
  }
  const m =
    msg.match(/UserError[:\s]+(.+)/) ||
    msg.match(/execution reverted[:\s]+"?(.+?)"?$/i) ||
    msg.match(/reverted with reason string '(.+)'/i);
  if (m?.[1]) return m[1].replace(/['"]/g, "").trim();
  return msg;
}

type ChainDef = {
  id?: number;
  name?: string;
  rpcUrls?: { default?: { http?: string[] } };
  nativeCurrency?: { name?: string; symbol?: string; decimals?: number };
};

type GenClient = {
  writeContract: (args: {
    address: string;
    functionName: string;
    args?: unknown[];
    value?: bigint | number;
    account?: string;
  }) => Promise<string>;
  readContract: (args: {
    address: string;
    functionName: string;
    args?: unknown[];
  }) => Promise<unknown>;
  waitForTransactionReceipt: (args: { hash: string; status?: string }) => Promise<unknown>;
};

async function loadChain(config: AppConfig): Promise<ChainDef> {
  const chains = await import("genlayer-js/chains");
  if (config.chain === "testnetBradbury") return chains.testnetBradbury as ChainDef;
  return (chains.studionet ?? chains.localnet) as ChainDef;
}

export async function createGenClient(
  config: AppConfig,
  account?: string,
): Promise<GenClient> {
  // For read calls (no account param) we can skip the strict
  // account validation; only the write path needs a valid signer.
  if (account !== undefined) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(account)) {
      throw new Error(
        `createGenClient: missing or invalid account "${account}". ` +
          `Connect a wallet or adopt the Studio owner.`,
      );
    }
  }
  const { createClient } = await import("genlayer-js");
  const chain = await loadChain(config);
  const eth = getEthereum();
  // viem 2.56+ requires a valid checksummed 0x address in `account`
  // when set. For read calls we pass undefined and genlayer-js
  // constructs a public client that doesn't need a signer.
  let accountChecksum: `0x${string}` | undefined;
  if (account) {
    accountChecksum = (await toEip55(account)) as `0x${string}`;
  }
  return createClient({
    chain,
    account: accountChecksum,
    provider: eth ?? undefined,
  }) as unknown as GenClient;
}

/**
 * EIP-55 checksum via viem's getAddress. If viem's CJS bundle
 * isn't reachable (e.g. some Next.js static-export configs), we
 * surface a clear error — fabricating a fake EIP-55 form via
 * a different hash would still be rejected by viem's strict
 * getAddress inside the call chain, so the only honest option
 * is to fail fast and let the caller fix the build.
 */
async function toEip55(addr: string): Promise<string> {
  const viem = await import("viem");
  if (typeof viem.getAddress !== "function") {
    throw new Error(
      "createGenClient: viem.getAddress is unavailable; cannot derive " +
        "EIP-55 checksum for the wallet address. Update viem and rebuild.",
    );
  }
  return viem.getAddress(addr as `0x${string}`);
}

export async function getWalletChainId(): Promise<number | null> {
  const eth = getEthereum();
  if (!eth) return null;
  try {
    const hex = (await eth.request({ method: "eth_chainId" })) as string;
    return parseInt(hex, 16);
  } catch {
    return null;
  }
}

export async function expectedChainId(config: AppConfig): Promise<number | null> {
  const chain = await loadChain(config);
  return typeof chain.id === "number" ? chain.id : null;
}

export async function isWrongNetwork(config: AppConfig | null): Promise<boolean> {
  if (!config?.contract_configured) return false;
  const [have, want] = await Promise.all([getWalletChainId(), expectedChainId(config)]);
  if (have == null || want == null) return false;
  return have !== want;
}

export async function ensureNetwork(config: AppConfig): Promise<void> {
  const eth = getEthereum();
  if (!eth) throw new Error("No injected wallet found. Install MetaMask to sign on-chain.");
  const chain = await loadChain(config);
  if (typeof chain.id !== "number") return;
  const current = await getWalletChainId();
  if (current === chain.id) return;
  const hex = `0x${chain.id.toString(16)}`;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (err: unknown) {
    const rec = err as { code?: number; message?: string };
    const rejected = String(rec?.message || "").toLowerCase().includes("reject");
    if (rejected) throw new Error("Signature rejected in wallet");
    if (rec?.code === 4902) {
      const rpc = chain.rpcUrls?.default?.http?.[0];
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hex,
            chainName: chain.name ?? "GenLayer",
            nativeCurrency: chain.nativeCurrency ?? { name: "GEN", symbol: "GEN", decimals: 18 },
            rpcUrls: rpc ? [rpc] : [],
          },
        ],
      });
      return;
    }
    throw new Error("Wrong network. Switch your wallet to the GenLayer chain and retry.");
  }
}

export async function writeOnchain(
  config: AppConfig,
  opts: {
    account: string;
    functionName: string;
    args?: unknown[];
    value?: bigint;
    onPending?: () => void;
    onAccepted?: () => void;
  },
): Promise<string> {
  console.log("[writeOnchain] entry", {
    contract_configured: config.contract_configured,
    public_contract_address: config.public_contract_address,
    account: opts.account,
    functionName: opts.functionName,
    args: opts.args,
    value: opts.value?.toString(),
  });
  if (!config.contract_configured) {
    throw new Error("Contract not configured (PUBLIC_CONTRACT_ADDRESS is empty)");
  }
  if (!config.public_contract_address) {
    throw new Error("Contract address missing from /config");
  }
  if (!opts.account || !/^0x[0-9a-fA-F]{40}$/.test(opts.account)) {
    throw new Error(
      `Active wallet address is invalid: ${JSON.stringify(opts.account)}. ` +
        `Click "Adopt owner" or "Connect wallet" to set a real one.`,
    );
  }
  await ensureNetwork(config);

  // ─── Bypass genlayer-js's writeContract wrapper ────────────────────────
  // The wrapper auto-generates a calldata envelope around the
  // `consensusMainContract.addTransaction(...)` call. viem 2.56+'s strict
  // EIP-55 assertion inside its encodeAbiParameters path then throws
  // "Address undefined" whenever any address-typed argument isn't
  // properly checksummed. We can neither bypass viem nor coerce
  // the wrapper to behave, so we replicate the wrapper's encode logic
  // with viem directly and send the raw eth_sendTransaction — that way
  // the address arguments are checksummed at the right moment and
  // the resulting data is byte-identical to what the wrapper would
  // have produced.
  const { createWalletClient, encodeFunctionData, getAddress, custom } =
    await import("viem");

  // 1. Resolve a properly-checksummed sender + recipient.
  const sender = getAddress(opts.account as `0x${string}`);
  const recipient = getAddress(
    config.public_contract_address as `0x${string}`,
  );

  // 2. Encode the user contract's submit_dispute(...) call itself.
  //    We build a { method, args, kwargs } object then hand it to
  //    genlayer-js's encoder (the same one the wrapper uses) so the
  //    RLP envelope matches exactly what Studio expects.
  //
  //    The runtime module exposes `calldata` under `.abi.calldata`,
  //    not `.calldata` (the .d.ts file aliases this only when
  //    imported through a sub-path that the package.json doesn't
  //    export, so we reach in via a cast).
  const genlayer = (await import("genlayer-js")) as unknown as {
    abi: {
      calldata: {
        makeCalldataObject(
          method: string,
          args: unknown[],
          kwargs: unknown,
        ): Record<string, unknown>;
        encode(obj: Record<string, unknown>): Uint8Array;
      };
    };
  };
  const abi = genlayer.abi.calldata;
  const callObject = abi.makeCalldataObject(
    opts.functionName,
    opts.args ?? [],
    undefined,
  );
  // abi.encode writes a length-prefixed payload into a Uint8Array.
  const calldataBytes = abi.encode(callObject);
  // The wrapper then toRlp([encoded, leaderOnly]) and feeds that as
  // the _txData argument of addTransaction(...). Reproduce the same
  // RLP envelope here using viem's toRlp.
  const { toRlp, toHex: viemToHex } = await import("viem");
  const serialized = toRlp([viemToHex(calldataBytes), viemToHex(new Uint8Array())]);

  // 3. Encode the consensus addTransaction(args) call.
  const consensusAbi: readonly unknown[] = [
    {
      type: "function",
      name: "addTransaction",
      stateMutability: "nonpayable",
      inputs: [
        { name: "_sender", type: "address" },
        { name: "_recipient", type: "address" },
        { name: "_numOfInitialValidators", type: "uint256" },
        { name: "_maxRotations", type: "uint256" },
        { name: "_txData", type: "bytes" },
      ],
      outputs: [],
    },
  ] as const;
  const validUntil = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const data = encodeFunctionData({
    abi: consensusAbi,
    functionName: "addTransaction",
    args: [sender, recipient, 5n, validUntil, serialized],
  });

  // 4. Send via viem's wallet client so MetaMask signs and broadcasts.
  const eth = getEthereum();
  if (!eth) {
    throw new Error("No injected wallet found. Install MetaMask to sign on-chain.");
  }
  const chain = (await loadChain(config)) as unknown as Parameters<
    typeof createWalletClient
  >[0]["chain"];
  // Consensus contract address is a chain constant — studionet:
  // 0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575. testnetBradbury:
  // 0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575 (same). localnet
  // uses 0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575. We hard-code
  // it here to keep `loadChain` lightweight and avoid a deep import
  // graph for what is in practice a constant.
  const consensusAddr = getAddress(
    "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575" as `0x${string}`,
  );
  const wallet = createWalletClient({
    account: sender,
    chain,
    transport: custom(eth),
  });
  const hash = await wallet.sendTransaction({
    chain,
    account: sender,
    to: consensusAddr,
    data,
    value: opts.value ?? 0n,
  });
  opts.onPending?.();
  console.log("[writeOnchain] sent transaction", { hash });
  // genlayer-js polled waitForTransactionReceipt. We don't replicate
  // the accepted/finalized dance here — the caller's onAccepted hook
  // fires after the transaction is broadcast, which is enough for
  // the UI to redirect. (Replicating the receipt poll would require
  // a publicClient transport, which we keep separate to avoid
  // creating a second websocket to the Studio RPC.)
  opts.onAccepted?.();
  return hash;
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  throw new Error("Unexpected contract response");
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v);
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeDispute(raw: unknown): Dispute {
  const d = asRecord(raw);
  const challenger = d.challenger ? str(d.challenger) : "";
  return {
    id: num(d.id),
    submitter: str(d.submitter),
    content_type: (str(d.content_type) as Dispute["content_type"]) || "text",
    content_ref: str(d.content_ref),
    claim: (str(d.claim) as Dispute["claim"]) || "ai_generated",
    submitter_stake: str(d.submitter_stake, "0"),
    status: (str(d.status) as Dispute["status"]) || "OPEN",
    challenger: challenger && !/^0x0+$/i.test(challenger) ? challenger : null,
    challenger_stake: d.challenger_stake != null ? str(d.challenger_stake) : null,
    challenge_deadline: num(d.challenge_deadline),
    verdict: d.verdict ? (str(d.verdict) as Dispute["verdict"]) : null,
    reasoning_summary: d.reasoning_summary ? str(d.reasoning_summary) : null,
    created_at: num(d.created_at),
    resolved_at: d.resolved_at != null ? num(d.resolved_at) : null,
    fee_taken: str(d.fee_taken, "0"),
  };
}

export async function readOnchainDispute(config: AppConfig, id: number): Promise<Dispute> {
  const client = await createGenClient(config);
  const raw = await client.readContract({
    address: config.public_contract_address,
    functionName: "get_dispute",
    args: [id],
  });
  return normalizeDispute(raw);
}

export async function readOnchainList(
  config: AppConfig,
  opts: { offset?: number; limit?: number; status?: string } = {},
): Promise<ListResult> {
  const client = await createGenClient(config);
  const raw = await client.readContract({
    address: config.public_contract_address,
    functionName: "list_disputes",
    args: [opts.offset ?? 0, opts.limit ?? 12, opts.status ?? ""],
  });
  const rec = asRecord(raw);
  const items = Array.isArray(rec.items) ? rec.items.map(normalizeDispute) : [];
  return {
    items,
    total: num(rec.total, items.length),
    offset: num(rec.offset, opts.offset ?? 0),
    limit: num(rec.limit, opts.limit ?? 12),
  };
}

export async function readOnchainStats(config: AppConfig): Promise<RegistryStats> {
  const client = await createGenClient(config);
  const raw = await client.readContract({
    address: config.public_contract_address,
    functionName: "get_registry_stats",
    args: [],
  });
  const s = asRecord(raw);
  return {
    total: num(s.total),
    open: num(s.open),
    challenged: num(s.challenged),
    resolved: num(s.resolved),
    expired_unchallenged: num(s.expired_unchallenged),
    total_staked: str(s.total_staked, "0"),
    total_settled: str(s.total_settled, "0"),
    fee_balance: str(s.fee_balance, "0"),
    fee_bps: num(s.fee_bps),
    paused: Boolean(s.paused),
    min_stake: str(s.min_stake, "0"),
    challenge_window_seconds: num(s.challenge_window_seconds),
    owner: str(s.owner),
    next_id: num(s.next_id),
  };
}
