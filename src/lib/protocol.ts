export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;
export const DEFAULT_OWNER =
  "0x0000000000000000000000000000000000000001" as const;

export const WEI_PER_GEN = 10n ** 18n;
export const MIN_STAKE_WEI = 10n ** 17n; // 0.1 GEN
export const MAX_CONTENT_REF = 4096;
export const DEFAULT_FEE_BPS = 250;
export const MAX_FEE_BPS = 1000;
export const DEFAULT_CHALLENGE_WINDOW_SEC = 120;
export const ONCHAIN_CHALLENGE_WINDOW_SEC = 86_400;
export const MAX_REASONING = 1024;
export const MAX_LIST_LIMIT = 50;

export const CONTENT_TYPES = ["image", "text"] as const;
export const CLAIMS = ["ai_generated", "human_made"] as const;
// Recorded verdicts: the three validator rulings plus `unadjudicated`,
// which is the explicit outcome for a dispute whose challenge window
// elapsed without a challenger (no validator review occurred).
export const VERDICTS = [
  "ai_generated",
  "human_made",
  "inconclusive",
  "unadjudicated",
] as const;
// Validator rulings: only the three outcomes a validator may emit when
// a dispute has been contested and inspected. `unadjudicated` is
// reserved for unchallenged expiries and must never be produced by a
// validator prompt path.
export const VALIDATOR_VERDICTS = [
  "ai_generated",
  "human_made",
  "inconclusive",
] as const;
export const STATUSES = [
  "OPEN",
  "CHALLENGED",
  "RESOLVED",
  "EXPIRED_UNCHALLENGED",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];
export type Claim = (typeof CLAIMS)[number];
export type Verdict = (typeof VERDICTS)[number];
export type ValidatorVerdict = (typeof VALIDATOR_VERDICTS)[number];
export type DisputeStatus = (typeof STATUSES)[number];

export interface Dispute {
  id: number;
  submitter: string;
  content_type: ContentType;
  content_ref: string;
  claim: Claim;
  submitter_stake: string;
  status: DisputeStatus;
  challenger: string | null;
  challenger_stake: string | null;
  challenge_deadline: number;
  verdict: Verdict | null;
  reasoning_summary: string | null;
  created_at: number;
  resolved_at: number | null;
  fee_taken: string;
}

export interface RegistryStats {
  total: number;
  open: number;
  challenged: number;
  resolved: number;
  expired_unchallenged: number;
  total_staked: string;
  total_settled: string;
  fee_balance: string;
  fee_bps: number;
  paused: boolean;
  min_stake: string;
  challenge_window_seconds: number;
  owner: string;
  next_id: number;
}

export interface AppConfig {
  public_contract_address: string;
  chain: "studionet" | "testnetBradbury" | "rehearsal";
  rehearsal: boolean;
  min_stake_wei: string;
  max_content_ref: number;
  challenge_window_seconds: number;
  fee_bps: number;
  contract_configured: boolean;
}

export interface ListResult {
  items: Dispute[];
  total: number;
  offset: number;
  limit: number;
}

export interface WithdrawResult {
  withdrawn: string;
  to: string;
}

export const ERRORS = {
  paused: "contract is paused",
  owner: "only owner",
  stake_min: "stake below minimum",
  stake_zero: "zero stake",
  content_type: "invalid content_type",
  claim: "invalid claim",
  ref_empty: "content_ref empty",
  ref_long: "content_ref too long",
  ref_malformed: "content_ref malformed",
  not_found: "dispute not found",
  not_open: "dispute not open",
  window_expired: "challenge window expired",
  self_challenge: "cannot challenge own dispute",
  already_challenged: "already challenged",
  stake_mismatch: "stake must equal submitter stake",
  already_resolved: "already resolved",
  not_eligible: "not eligible for resolution",
  missing_caller: "caller address required",
  invalid_address: "invalid address",
  no_fees: "no fees to withdraw",
} as const;

export class ProtocolError extends Error {
  code: string;
  constructor(code: keyof typeof ERRORS, message?: string) {
    super(message ?? ERRORS[code]);
    this.name = "ProtocolError";
    this.code = code;
  }
}

export function isContentType(v: string): v is ContentType {
  return (CONTENT_TYPES as readonly string[]).includes(v);
}

export function isClaim(v: string): v is Claim {
  return (CLAIMS as readonly string[]).includes(v);
}

export function isStatus(v: string): v is DisputeStatus {
  return (STATUSES as readonly string[]).includes(v);
}

export function isVerdict(v: string): v is Verdict {
  return (VERDICTS as readonly string[]).includes(v);
}

export function isValidatorVerdict(v: string): v is ValidatorVerdict {
  return (VALIDATOR_VERDICTS as readonly string[]).includes(v);
}

export function docketId(id: number): string {
  return `FL-${String(id).padStart(5, "0")}`;
}

export function weiToGen(wei: string | bigint, digits = 4): string {
  const v = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = abs / WEI_PER_GEN;
  const frac = abs % WEI_PER_GEN;
  const fracStr = frac.toString().padStart(18, "0").slice(0, digits);
  const trimmed = fracStr.replace(/0+$/, "");
  const body = trimmed.length ? `${whole.toString()}.${trimmed}` : whole.toString();
  return neg ? `-${body}` : body;
}

export function genToWei(gen: string): bigint {
  const t = gen.trim();
  if (!t || !/^\d+(\.\d+)?$/.test(t)) {
    throw new ProtocolError("stake_min", "invalid stake amount");
  }
  const [w, f = ""] = t.split(".");
  const frac = (f + "000000000000000000").slice(0, 18);
  return BigInt(w ?? "0") * WEI_PER_GEN + BigInt(frac);
}

export function shortAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function oppositeClaim(claim: Claim): Claim {
  return claim === "ai_generated" ? "human_made" : "ai_generated";
}

export function claimLabel(claim: Claim | Verdict | string): string {
  if (claim === "ai_generated") return "AI generated";
  if (claim === "human_made") return "Human made";
  if (claim === "inconclusive") return "Inconclusive";
  if (claim === "unadjudicated") return "Unadjudicated";
  return claim;
}

export function statusLabel(status: DisputeStatus): string {
  switch (status) {
    case "OPEN":
      return "Open";
    case "CHALLENGED":
      return "Challenged";
    case "RESOLVED":
      return "Resolved";
    case "EXPIRED_UNCHALLENGED":
      return "Unchallenged";
  }
}

export function parseIpv4Octets(host: string): number[] | null {
  const h = host.trim();
  if (!h) return null;
  const lower = h.toLowerCase();
  if (lower.startsWith("0x")) {
    const n = Number.parseInt(lower, 16);
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) return null;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  }
  if (/^\d+$/.test(h)) {
    if (h.length > 1 && h.startsWith("0")) return null;
    const n = Number(h);
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) return null;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  }
  const parts = h.split(".");
  if (parts.length < 1 || parts.length > 4) return null;
  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    if (p.length > 1 && p.startsWith("0")) return null;
    nums.push(Number(p));
  }
  if (parts.length === 4) {
    if (nums.some((n) => n < 0 || n > 255)) return null;
    return nums;
  }
  if (parts.length === 1) {
    const n = nums[0] ?? -1;
    if (n < 0 || n > 0xffffffff) return null;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  }
  if (parts.length === 2) {
    const a = nums[0] ?? -1;
    const rest = nums[1] ?? -1;
    if (a < 0 || a > 255 || rest < 0 || rest > 0xffffff) return null;
    return [a, (rest >>> 16) & 255, (rest >>> 8) & 255, rest & 255];
  }
  const a = nums[0] ?? -1;
  const b = nums[1] ?? -1;
  const rest = nums[2] ?? -1;
  if (a < 0 || a > 255 || b < 0 || b > 255 || rest < 0 || rest > 0xffff) return null;
  return [a, b, (rest >>> 8) & 255, rest & 255];
}

function ipv4Blocked(octets: number[]): boolean {
  const a = octets[0] ?? 0;
  const b = octets[1] ?? 0;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && b >= 18 && b <= 19) return true;
  if (a >= 224) return true;
  return false;
}

function looksIpLiteral(h: string): boolean {
  if (h.startsWith("0x")) return true;
  if (h.includes(":")) return true;
  if (/^\d+$/.test(h)) return true;
  return /^\d+(\.\d+)+$/.test(h);
}

function ldhHostname(h: string): boolean {
  if (!h || h.length > 253) return false;
  if (h.startsWith("-") || h.endsWith("-") || h.includes("..")) return false;
  if (!/^[a-z0-9.-]+$/.test(h)) return false;
  return h.split(".").every((label) => label.length > 0 && label.length <= 63 && !label.startsWith("-") && !label.endsWith("-"));
}

function embeddedPrivate(h: string): boolean {
  const parts = h.split(".");
  if (parts.length < 4) return false;
  for (let i = 0; i <= parts.length - 4; i++) {
    const chunk = parts.slice(i, i + 4).join(".");
    const octets = parseIpv4Octets(chunk);
    if (octets && ipv4Blocked(octets)) return true;
  }
  return false;
}

function authorityHost(authority: string): string {
  const a = authority.trim();
  if (!a) return "";
  if (a.startsWith("[")) {
    const end = a.indexOf("]");
    if (end < 2) return "";
    return a.slice(1, end);
  }
  if ((a.match(/:/g) ?? []).length > 1) return "";
  return a.split(":")[0] ?? "";
}

const METADATA_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "metadata.google.com",
  "instance-data",
  "instance-data.ec2.internal",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_SUFFIXES = [
  ".local",
  ".internal",
  ".localhost",
  ".localdomain",
  ".onion",
  ".nip.io",
  ".sslip.io",
  ".xip.io",
  ".localtest.me",
  ".lvh.me",
  ".vcap.me",
];

export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  if (!h) return true;
  if (h.includes("0x")) return true;
  if (METADATA_HOSTS.has(h)) return true;
  if (BLOCKED_SUFFIXES.some((sfx) => h.endsWith(sfx))) return true;
  if (embeddedPrivate(h)) return true;
  if (h.split(".").some((label) => label.startsWith("xn--"))) return true;
  const octets = parseIpv4Octets(h);
  if (octets) return ipv4Blocked(octets);
  if (looksIpLiteral(h)) return true;
  if (h.includes(":")) return true;
  if (!ldhHostname(h)) return true;
  return false;
}

export function safeHttpUrl(value: string): string | null {
  try {
    const u = new URL(value.trim());
    if (u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    const host = authorityHost(u.host);
    if (isPrivateHost(host || u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function validateContentRef(contentType: ContentType, ref: string): void {
  const trimmed = ref.trim();
  if (!trimmed) throw new ProtocolError("ref_empty");
  if (trimmed.length > MAX_CONTENT_REF) throw new ProtocolError("ref_long");
  if (trimmed.includes("\0") || trimmed.includes("\r")) throw new ProtocolError("ref_malformed");
  const looksUrl = /^https?:\/\//i.test(trimmed);
  if (contentType === "image" || looksUrl) {
    if (trimmed.includes(" ") || trimmed.includes("\n") || trimmed.includes("\\")) {
      throw new ProtocolError("ref_malformed");
    }
    if (!safeHttpUrl(trimmed)) throw new ProtocolError("ref_malformed");
  }
}

