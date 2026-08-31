"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchConfig } from "./api";
import { ensureNetwork, isWrongNetwork } from "./chain";
import type { AppConfig } from "./protocol";
import {
  addIdentity,
  adoptOwnerIdentity,
  connectInjected,
  disconnectWallet,
  ensureIdentity,
  getActiveAddress,
  hasEthereum,
  loadIdentities,
  setActiveAddress,
  type Identity,
} from "./wallet";

export type TxPhase = "idle" | "signing" | "pending" | "accepted" | "finalized" | "failed";

interface SessionValue {
  ready: boolean;
  config: AppConfig | null;
  address: string | null;
  identities: Identity[];
  injected: boolean;
  wrongNetwork: boolean;
  error: string | null;
  connectRehearsal: () => void;
  connectWallet: () => Promise<void>;
  switchTo: (address: string) => void;
  mintIdentity: (label: string) => void;
  assumeOwner: () => void;
  disconnect: () => void;
  requireCaller: () => string;
  switchNetwork: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [injected, setInjected] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshNetwork = useCallback(async (cfg: AppConfig | null) => {
    try {
      setWrongNetwork(await isWrongNetwork(cfg));
    } catch {
      setWrongNetwork(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await fetchConfig();
        if (cancelled) return;
        setConfig(next);
        setInjected(hasEthereum());
        setIdentities(loadIdentities());
        setAddress(getActiveAddress());
        setError(null);
        await refreshNetwork(next);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load config");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshNetwork]);

  useEffect(() => {
    const eth = typeof window !== "undefined" ? (window as Window & { ethereum?: { on?: Function; removeListener?: Function } }).ethereum : undefined;
    if (!eth?.on) return;
    const onChain = () => void refreshNetwork(config);
    const onAccounts = (accounts: string[]) => {
      if (accounts?.[0]) {
        setActiveAddress(accounts[0]);
        setAddress(accounts[0]);
      }
    };
    eth.on("chainChanged", onChain);
    eth.on("accountsChanged", onAccounts);
    return () => {
      eth.removeListener?.("chainChanged", onChain);
      eth.removeListener?.("accountsChanged", onAccounts);
    };
  }, [config, refreshNetwork]);

  const connectRehearsal = useCallback(() => {
    const id = ensureIdentity();
    setAddress(id.address);
    setIdentities(loadIdentities());
  }, []);

  const connectWallet = useCallback(async () => {
    const addr = await connectInjected();
    setAddress(addr);
    setIdentities(loadIdentities());
    setInjected(true);
    await refreshNetwork(config);
  }, [config, refreshNetwork]);

  const switchTo = useCallback((next: string) => {
    setActiveAddress(next);
    setAddress(next);
    setIdentities(loadIdentities());
  }, []);

  const mintIdentity = useCallback((label: string) => {
    const id = addIdentity(label);
    setAddress(id.address);
    setIdentities(loadIdentities());
  }, []);

  const assumeOwner = useCallback(async () => {
    const id = await adoptOwnerIdentity();
    setAddress(id.address);
    setIdentities(loadIdentities());
  }, []);

  const disconnect = useCallback(() => {
    disconnectWallet();
    setAddress(null);
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!config) return;
    await ensureNetwork(config);
    await refreshNetwork(config);
  }, [config, refreshNetwork]);

  const requireCaller = useCallback(() => {
    if (address) return address;
    if (config && !config.contract_configured) {
      const id = ensureIdentity();
      setAddress(id.address);
      setIdentities(loadIdentities());
      return id.address;
    }
    // Studio contract is configured: the user must explicitly connect a
    // wallet or adopt the Studio owner. Throw with a clear message so
    // the UI shows actionable text instead of viem's generic
    // "Address undefined" assertion from deep inside writeContract.
    throw new Error("Connect a wallet first (or use “Adopt owner”).");
  }, [address, config]);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      config,
      address,
      identities,
      injected,
      wrongNetwork,
      error,
      connectRehearsal,
      connectWallet,
      switchTo,
      mintIdentity,
      assumeOwner,
      disconnect,
      requireCaller,
      switchNetwork,
    }),
    [
      ready,
      config,
      address,
      identities,
      injected,
      wrongNetwork,
      error,
      connectRehearsal,
      connectWallet,
      switchTo,
      mintIdentity,
      assumeOwner,
      disconnect,
      requireCaller,
      switchNetwork,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
