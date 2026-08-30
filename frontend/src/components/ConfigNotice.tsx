"use client";

import { useSession } from "@/lib/session";

export function ConfigNotice({ compact = false }: { compact?: boolean }) {
  const { config } = useSession();
  if (!config || config.contract_configured) return null;
  if (compact) {
    return (
      <p className="hint">
        Contract address is empty. Writes run against the local rehearsal registry, not GenLayer
        Studio.
      </p>
    );
  }
  return (
    <p className="panel" style={{ marginTop: "1.5rem", fontSize: "0.875rem", color: "var(--muted)" }}>
      Contract not configured. This filing will be recorded in the local rehearsal registry. After
      you deploy via GenLayer Studio, set <code className="mono">PUBLIC_CONTRACT_ADDRESS</code> and
      filings will go on-chain.
    </p>
  );
}
