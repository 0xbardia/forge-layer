import type {
  AppConfig,
  Dispute,
  ListResult,
  RegistryStats,
  WithdrawResult,
} from "./protocol";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(text || `Request failed (${res.status})`);
  }
  if (!res.ok) {
    const err = data as { error?: string } | null;
    throw new Error(err?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function fetchConfig(): Promise<AppConfig> {
  return request<AppConfig>("/config");
}

export function fetchHealth(): Promise<{ ok: boolean; service: string }> {
  return request("/health");
}

export function fetchStats(): Promise<RegistryStats> {
  return request<RegistryStats>("/api/stats");
}

export function fetchDisputes(opts: {
  offset?: number;
  limit?: number;
  status?: string;
  content_type?: string;
  verdict?: string;
  q?: string;
}): Promise<ListResult> {
  const params = new URLSearchParams();
  if (opts.offset != null) params.set("offset", String(opts.offset));
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.status) params.set("status", opts.status);
  if (opts.content_type) params.set("content_type", opts.content_type);
  if (opts.verdict) params.set("verdict", opts.verdict);
  if (opts.q) params.set("q", opts.q);
  const qs = params.toString();
  return request<ListResult>(`/api/disputes${qs ? `?${qs}` : ""}`);
}

export function fetchDispute(id: number): Promise<Dispute> {
  return request<Dispute>(`/api/disputes/${id}`);
}

export function postSubmit(body: {
  caller: string;
  content_type: string;
  content_ref: string;
  claim: string;
  stake_wei: string;
}): Promise<Dispute> {
  return request<Dispute>("/api/disputes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function postChallenge(
  id: number,
  body: { caller: string; stake_wei: string },
): Promise<Dispute> {
  return request<Dispute>(`/api/disputes/${id}/challenge`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function postResolve(id: number, body: { caller: string }): Promise<Dispute> {
  return request<Dispute>(`/api/disputes/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function postPause(body: { caller: string; paused: boolean }): Promise<RegistryStats> {
  return request<RegistryStats>("/api/admin/pause", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function postFee(body: { caller: string; fee_bps: number }): Promise<RegistryStats> {
  return request<RegistryStats>("/api/admin/fee", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function postWithdraw(body: { caller: string; to: string }): Promise<WithdrawResult> {
  return request<WithdrawResult>("/api/admin/withdraw", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function postTransfer(body: { caller: string; new_owner: string }): Promise<RegistryStats> {
  return request<RegistryStats>("/api/admin/transfer", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
