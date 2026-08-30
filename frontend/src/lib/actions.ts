/**
 * Unified write/read surface. Rehearsal HTTP while PUBLIC_CONTRACT_ADDRESS is
 * empty; genlayer-js (client-signed) once the Studio address is configured.
 */

import {
  fetchDispute,
  fetchDisputes,
  fetchStats,
  postChallenge,
  postFee,
  postPause,
  postResolve,
  postSubmit,
  postTransfer,
  postWithdraw,
} from "./api";
import {
  readOnchainDispute,
  readOnchainList,
  readOnchainStats,
  writeOnchain,
} from "./chain";
import type { AppConfig, Dispute, ListResult, RegistryStats, WithdrawResult } from "./protocol";

export type TxHooks = {
  onPending?: () => void;
  onAccepted?: () => void;
};

export async function loadStats(config: AppConfig | null): Promise<RegistryStats> {
  if (config?.contract_configured) return readOnchainStats(config);
  return fetchStats();
}

export async function loadDisputes(
  config: AppConfig | null,
  opts: {
    offset?: number;
    limit?: number;
    status?: string;
    content_type?: string;
    verdict?: string;
    q?: string;
  },
): Promise<ListResult> {
  if (config?.contract_configured) {
    return readOnchainList(config, opts);
  }
  return fetchDisputes(opts);
}

export async function loadDispute(config: AppConfig | null, id: number): Promise<Dispute> {
  if (config?.contract_configured) return readOnchainDispute(config, id);
  return fetchDispute(id);
}

export async function submitDispute(
  config: AppConfig | null,
  body: {
    caller: string;
    content_type: string;
    content_ref: string;
    claim: string;
    stake_wei: string;
  },
  hooks?: TxHooks,
): Promise<Dispute> {
  if (config?.contract_configured) {
    await writeOnchain(config, {
      account: body.caller,
      functionName: "submit_dispute",
      args: [body.content_type, body.content_ref, body.claim],
      value: BigInt(body.stake_wei),
      onPending: hooks?.onPending,
      onAccepted: hooks?.onAccepted,
    });
    const stats = await readOnchainStats(config);
    return readOnchainDispute(config, Math.max(1, stats.next_id - 1));
  }
  hooks?.onPending?.();
  const d = await postSubmit(body);
  hooks?.onAccepted?.();
  return d;
}

export async function challengeDispute(
  config: AppConfig | null,
  body: { caller: string; id: number; stake_wei: string },
  hooks?: TxHooks,
): Promise<Dispute> {
  if (config?.contract_configured) {
    await writeOnchain(config, {
      account: body.caller,
      functionName: "challenge_dispute",
      args: [body.id],
      value: BigInt(body.stake_wei),
      onPending: hooks?.onPending,
      onAccepted: hooks?.onAccepted,
    });
    return readOnchainDispute(config, body.id);
  }
  hooks?.onPending?.();
  const d = await postChallenge(body.id, { caller: body.caller, stake_wei: body.stake_wei });
  hooks?.onAccepted?.();
  return d;
}

export async function resolveDispute(
  config: AppConfig | null,
  body: { caller: string; id: number },
  hooks?: TxHooks,
): Promise<Dispute> {
  if (config?.contract_configured) {
    await writeOnchain(config, {
      account: body.caller,
      functionName: "resolve_dispute",
      args: [body.id],
      onPending: hooks?.onPending,
      onAccepted: hooks?.onAccepted,
    });
    return readOnchainDispute(config, body.id);
  }
  hooks?.onPending?.();
  const d = await postResolve(body.id, { caller: body.caller });
  hooks?.onAccepted?.();
  return d;
}

export async function adminPause(
  config: AppConfig | null,
  body: { caller: string; paused: boolean },
): Promise<RegistryStats> {
  if (config?.contract_configured) {
    await writeOnchain(config, {
      account: body.caller,
      functionName: "set_pause",
      args: [body.paused],
    });
    return readOnchainStats(config);
  }
  return postPause(body);
}

export async function adminFee(
  config: AppConfig | null,
  body: { caller: string; fee_bps: number },
): Promise<RegistryStats> {
  if (config?.contract_configured) {
    await writeOnchain(config, {
      account: body.caller,
      functionName: "set_fee_bps",
      args: [body.fee_bps],
    });
    return readOnchainStats(config);
  }
  return postFee(body);
}

export async function adminWithdraw(
  config: AppConfig | null,
  body: { caller: string; to: string },
): Promise<WithdrawResult> {
  if (config?.contract_configured) {
    const before = await readOnchainStats(config);
    const withdrawn = before.fee_balance;
    await writeOnchain(config, {
      account: body.caller,
      functionName: "withdraw_fees",
      args: [body.to],
    });
    return { withdrawn, to: body.to };
  }
  return postWithdraw(body);
}

export async function adminTransfer(
  config: AppConfig | null,
  body: { caller: string; new_owner: string },
): Promise<RegistryStats> {
  if (config?.contract_configured) {
    await writeOnchain(config, {
      account: body.caller,
      functionName: "transfer_ownership",
      args: [body.new_owner],
    });
    return readOnchainStats(config);
  }
  return postTransfer(body);
}
