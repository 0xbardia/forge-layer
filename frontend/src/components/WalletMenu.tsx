"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { shortAddress } from "@/lib/protocol";
import { useSession } from "@/lib/session";

export function WalletMenu() {
  const {
    address,
    identities,
    config,
    connectRehearsal,
    connectWallet,
    switchTo,
    mintIdentity,
    assumeOwner,
    disconnect,
    injected,
  } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rehearsal = !config?.contract_configured;

  async function onConnect() {
    setBusy(true);
    try {
      if (rehearsal) {
        connectRehearsal();
      } else if (injected) {
        await connectWallet();
      } else {
        throw new Error("No injected wallet");
      }
    } catch {
      if (rehearsal) connectRehearsal();
    } finally {
      setBusy(false);
    }
  }

  if (!address) {
    return (
      <Button onClick={() => void onConnect()} disabled={busy} className="btn-sm">
        {busy ? "Connecting…" : rehearsal ? "Enter the forge" : "Connect wallet"}
      </Button>
    );
  }

  return (
    <div className="wallet-wrap">
      <button type="button" className="wallet-trigger" onClick={() => setOpen((v) => !v)}>
        <span className="live-dot" aria-hidden />
        {shortAddress(address)}
      </button>
      {open ? (
        <div className="wallet-menu">
          <p className="wallet-menu-kicker">
            {rehearsal ? "Rehearsal identities" : "Connected account"}
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {identities.map((id) => (
              <li key={id.address}>
                <button
                  type="button"
                  className={`wallet-id${id.address === address ? " is-on" : ""}`}
                  onClick={() => {
                    switchTo(id.address);
                    setOpen(false);
                  }}
                >
                  <span>{id.label}</span>
                  <span>{shortAddress(id.address)}</span>
                </button>
              </li>
            ))}
          </ul>
          {rehearsal ? (
            <>
              <button
                type="button"
                className="wallet-action"
                onClick={() => {
                  mintIdentity(`Warden 0${identities.length + 1}`);
                  setOpen(false);
                }}
              >
                Mint another warden
              </button>
              <button
                type="button"
                className="wallet-action"
                onClick={() => {
                  assumeOwner();
                  setOpen(false);
                }}
              >
                Use protocol owner
              </button>
            </>
          ) : null}
          {injected && !rehearsal ? (
            <button
              type="button"
              className="wallet-action"
              onClick={() => {
                void connectWallet();
                setOpen(false);
              }}
            >
              Use injected wallet
            </button>
          ) : null}
          <button
            type="button"
            className="wallet-action"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}
