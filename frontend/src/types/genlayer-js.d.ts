declare module "genlayer-js" {
  export function createClient(opts: Record<string, unknown>): {
    writeContract: (args: Record<string, unknown>) => Promise<string>;
    readContract: (args: Record<string, unknown>) => Promise<unknown>;
    waitForTransactionReceipt: (args: Record<string, unknown>) => Promise<unknown>;
  };
  export function createAccount(): unknown;
}

declare module "genlayer-js/chains" {
  export const studionet: { id?: number; name?: string };
  export const testnetBradbury: { id?: number; name?: string };
  export const localnet: { id?: number; name?: string };
  export const simulator: { id?: number; name?: string };
}

declare module "genlayer-js/types" {
  export const TransactionStatus: { ACCEPTED: string; FINALIZED: string };
}
