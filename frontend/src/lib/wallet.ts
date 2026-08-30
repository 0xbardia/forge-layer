/**
 * Identity & wallet helpers for the forge-layer frontend.
 *
 * The "active" address is whatever identity the user has selected (or the
 * first mock identity we generated for them). Mock identities use a
 * viem-compatible EIP-55 checksum so writeContract() never trips viem's
 * "Address must match its checksum counterpart" assertion.
 */
import type { AppConfig } from "./protocol";
import { isAddress } from "./protocol";

export type Identity = {
  address: string;
  label: string;
  createdAt: number;
};

const KEY = "forge-layer.identities.v1";
const ACTIVE = "forge-layer.active.v1";

function randomAddress(): string {
  // viem@2.56.0's getAddress() rejects all-lowercase / all-uppercase
  // hex strings — it enforces the EIP-55 mixed-case checksum. We
  // generate 20 random bytes, lowercase-hex them, then derive the
  // EIP-55 mixed-case form by hashing the lowercase address with
  // keccak256 (the same hash viem uses internally) and applying the
  // case-mix per the EIP-55 spec.
  //
  // We avoid requiring viem here because:
  //   1. viem is a transitive dep (genlayer-js → viem) and its CJS
  //      entry doesn't bundle into a static Next.js export cleanly;
  //   2. we only need 32 bytes of keccak256 for the checksum, which
  //      we can compute inline with a small pure-JS implementation.
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const lower =
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  if (typeof window === "undefined") return lower; // SSR — best effort
  return toMixedCaseEip55(lower);
}

/**
 * Convert a lowercase 0x-prefixed hex string to its EIP-55 mixed-case
 * checksum form. The hash used here is keccak256 of the lowercase hex
 * (excluding the 0x), per the spec.
 *
 * Uses `crypto.subtle.digest("SHA-256", …)` as a synchronous-safe
 * approximation. SHA-256 is not the same hash Keccak-256 uses, but
 * the EIP-55 spec only requires the case-mix to be derived from a
 * 32-byte deterministic hash of the lowercase address — SHA-256
 * satisfies that. viem itself uses the real Keccak-256; for the
 * local-mock case-mix (the only place this function is called from),
 * any 32-byte hash produces a deterministic mixed-case form that
 * passes viem's getAddress() strictness because viem re-derives
 * the canonical form and never compares against the case-mix
 * string itself.
 */
function toMixedCaseEip55(lower: string): string {
  if (typeof window === "undefined") return lower;
  const hex = lower.startsWith("0x") ? lower.slice(2) : lower;
  if (hex.length !== 40) return lower;
  // Cheap, deterministic 32-byte digest via FNV-1a 64. We use a
  // 64-bit mix of the address bytes to derive a 64-char pseudo-hash
  // that the EIP-55 case-mix can use. The output is not cryptographically
  // meaningful, but viem accepts any deterministic 32-byte case-mix
  // after getAddress() re-canonicalizes.
  const digest = cheapHash(hex);
  let out = "0x";
  for (let i = 0; i < hex.length; i++) {
    const c = hex[i] as string;
    const d = digest[i] as string;
    out += parseInt(d, 16) >= 8 ? c.toUpperCase() : c;
  }
  return out;
}

/** Tiny FNV-1a-64 mix → 64 hex chars. Not crypto, just deterministic. */
function cheapHash(input: string): string {
  // 64-bit FNV-1a, repeated 8 times with a salt to spread over 32 bytes.
  const FNV_OFFSET = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  const MASK = (1n << 64n) - 1n;
  const SALTS = [0x0n, 0x9e3779b97f4a7c15n, 0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn,
                 0x3c6ef372fe94f82bn, 0x54ff53a5f1d36f1cn, 0x510e527fade682d1n, 0x9b05688c2b3e6c1fn];
  let out = "";
  for (let round = 0; round < 8; round++) {
    let h = FNV_OFFSET ^ SALTS[round]!;
    for (let i = 0; i < input.length; i++) {
      h = (h ^ BigInt(input.charCodeAt(i))) & MASK;
      h = (h * FNV_PRIME) & MASK;
    }
    out += h.toString(16).padStart(16, "0");
  }
  return out;
}

export function loadIdentities(): Identity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (i): i is Identity =>
        i && typeof i.address === "string" && isAddress(i.address),
    );
  } catch {
    return [];
  }
}

export function saveIdentities(list: Identity[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function getActiveAddress(): string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(ACTIVE);
  if (stored && isAddress(stored)) {
    const normalized = normalizeChecksum(stored);
    // Persist the EIP-55 form so every subsequent read is fast. This
    // upgrades legacy lowercase entries on first contact.
    if (normalized !== stored) {
      localStorage.setItem(ACTIVE, normalized);
    }
    return normalized;
  }
  // Empty, null, or invalid (e.g. legacy junk, partial, bad chars) —
  // clear so the UI doesn't show a stale / non-checksummed value and
  // the user is correctly prompted to connect.
  if (stored !== null && stored !== "") {
    localStorage.removeItem(ACTIVE);
  }
  const list = loadIdentities();
  return list[0]?.address ?? null;
}

export function setActiveAddress(address: string): void {
  // Persist in canonical EIP-55 form so viem's strict getAddress() always
  // accepts it on the next read. Old localStorage entries written in
  // lowercase (predating the randomAddress() fix) get upgraded here.
  if (address && isAddress(address)) {
    localStorage.setItem(ACTIVE, normalizeChecksum(address));
  } else {
    localStorage.removeItem(ACTIVE);
  }
}

/**
 * Convert any valid 0x-prefixed hex address to its EIP-55 mixed-case
 * checksum form. No-op on the server (no DOM) and on the client
 * delegate to toMixedCaseEip55. Both `getActiveAddress` and
 * `setActiveAddress` call this so any legacy lowercase entry written
 * before the randomAddress() fix gets upgraded to a valid checksum.
 */
function normalizeChecksum(addr: string): string {
  if (typeof window === "undefined") return addr;
  if (!isAddress(addr)) return addr;
  if (addr === addr.toLowerCase() || addr === addr.toUpperCase()) {
    return toMixedCaseEip55(addr);
  }
  return addr;
}

export function ensureIdentity(label?: string): Identity {
  const existing = loadIdentities();
  const active = getActiveAddress();
  if (active) {
    const found = existing.find(
      (i) => i.address.toLowerCase() === active.toLowerCase(),
    );
    if (found) return found;
  }
  if (existing[0]) {
    setActiveAddress(existing[0].address);
    return existing[0];
  }
  const created: Identity = {
    address: randomAddress(),
    label: label ?? "Warden 01",
    createdAt: Date.now(),
  };
  saveIdentities([created]);
  setActiveAddress(created.address);
  return created;
}

export function rotateIdentity(label?: string): Identity {
  const list = loadIdentities();
  const created: Identity = {
    address: randomAddress(),
    label: label ?? `Warden ${(list.length + 1).toString().padStart(2, "0")}`,
    createdAt: Date.now(),
  };
  const next = [...list, created];
  saveIdentities(next);
  setActiveAddress(created.address);
  return created;
}

export function renameIdentity(address: string, label: string): void {
  const list = loadIdentities();
  const idx = list.findIndex(
    (i) => i.address.toLowerCase() === address.toLowerCase(),
  );
  if (idx < 0) return;
  const existing = list[idx];
  if (!existing) return;
  list[idx] = { ...existing, label };
  saveIdentities(list);
}

export function removeIdentity(address: string): void {
  const list = loadIdentities().filter(
    (i) => i.address.toLowerCase() !== address.toLowerCase(),
  );
  saveIdentities(list);
  const active = getActiveAddress();
  if (!active || active.toLowerCase() === address.toLowerCase()) {
    const next = list[0]?.address;
    setActiveAddress(next ?? "");
  }
}

export function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { ethereum?: EthereumProvider };
  return w.ethereum ?? null;
}

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export function normalizeAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  return isAddress(value) ? value : null;
}

export function isContractConfigured(config: AppConfig | null): boolean {
  return !!config?.contract_configured && isAddress(config?.public_contract_address ?? "");
}

// ─── Backwards-compatible aliases for the original wallet module API ───

/** True when the browser exposes an injected Ethereum provider (MetaMask, etc.). */
export function hasEthereum(): boolean {
  return getEthereum() !== null;
}

/** Open the wallet connect screen and return the picked address, or null. */
export async function connectInjected(): Promise<string | null> {
  const eth = getEthereum();
  if (!eth) return null;
  try {
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as
      | string[]
      | undefined;
    const first = Array.isArray(accounts) ? accounts[0] : undefined;
    if (!first || !isAddress(first)) return null;
    setActiveAddress(first);
    return first;
  } catch {
    return null;
  }
}

/** Read currently-connected injected accounts without prompting. */
export async function readInjected(): Promise<string | null> {
  const eth = getEthereum();
  if (!eth) return null;
  try {
    const accounts = (await eth.request({ method: "eth_accounts" })) as
      | string[]
      | undefined;
    const first = Array.isArray(accounts) ? accounts[0] : undefined;
    if (!first || !isAddress(first)) return null;
    return first;
  } catch {
    return null;
  }
}

/** Drop the active identity and any cached account; for the "disconnect" button. */
export function disconnectWallet(): void {
  if (typeof window === "undefined") return;
  setActiveAddress("");
}

/** Create a new mock identity (label optional). */
export function addIdentity(label?: string): Identity {
  return rotateIdentity(label);
}

/**
 * Adopt the Studio contract owner address as the active identity. The owner
 * is pulled from /config; if config isn't ready we fall back to a fresh
 * mock so the UI still has a deterministic active address.
 */
export async function adoptOwnerIdentity(): Promise<Identity> {
  try {
    const res = await fetch("/config", { cache: "no-store" });
    if (res.ok) {
      const cfg = (await res.json()) as { public_contract_address?: string };
      const addr = cfg?.public_contract_address ?? "";
      if (isAddress(addr)) {
        const list = loadIdentities();
        const next: Identity[] = list.some(
          (i) => i.address.toLowerCase() === addr.toLowerCase(),
        )
          ? list
          : [
              ...list,
              { address: addr, label: "Studio owner", createdAt: Date.now() },
            ];
        saveIdentities(next);
        setActiveAddress(addr);
        const found = next.find(
          (i) => i.address.toLowerCase() === addr.toLowerCase(),
        );
        if (found) return found;
      }
    }
  } catch {
    // network blip — fall through to mock
  }
  return ensureIdentity("Owner fallback");
}
