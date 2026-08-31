"use client";

import { BtnLink, Panel } from "@/components/ui";

export default function SecurityPage() {
  return (
    <>
      <p className="kicker">Threat model</p>
      <h1 className="display">What the contract actually rejects.</h1>
      <p className="lede" style={{ marginTop: "1rem", maxWidth: "40rem" }}>
        Forge Layer holds stakes. The Intelligent Contract is the production source of truth. This
        page is the audit we ran against it — not a template.
      </p>
      <div className="grid-2" style={{ marginTop: "3rem" }}>
        <Panel>
          <h2>Trust boundaries</h2>
          <p className="muted">
            Contract validators re-execute writes. Wallets sign submit, challenge, resolve, and owner
            methods. The server never signs. The frontend does not render cited HTML.
          </p>
        </Panel>
        <Panel>
          <h2>Host policy</h2>
          <p className="muted">
            Image and URL refs must be https. Hex IPs, leading-zero / octal forms, IPv6 literals,
            metadata hosts, and rebinding helpers (nip.io, sslip.io) are rejected at submit and again
            at inspect.
          </p>
        </Panel>
        <Panel>
          <h2>Consensus</h2>
          <p className="muted">
            Cited text is fenced as UNTRUSTED data. Verdicts are clamped JSON. Unreachable or
            unparseable output settles inconclusive — the docket never sticks in CHALLENGED.
          </p>
        </Panel>
        <Panel>
          <h2>Funds</h2>
          <p className="muted">
            State is written before payouts. Challenge stake must equal the submitter. Unchallenged
            expiry refunds in full. Owner can pause, set the fee, withdraw, or transfer ownership.
          </p>
        </Panel>
      </div>
      <Panel style={{ marginTop: "1.5rem" }}>
        <h2>Studio deploy</h2>
        <p className="muted">
          Paste contract/ForgeLayer.py into studio.genlayer.com/contracts with the operator wallet.
          Run every Read method, then set PUBLIC_CONTRACT_ADDRESS.
        </p>
      </Panel>
      <div className="hero-actions" style={{ marginTop: "2rem" }}>
        <BtnLink href="/protocol/">Read the protocol</BtnLink>
        <BtnLink href="/admin/" variant="secondary">
          Admin
        </BtnLink>
      </div>
    </>
  );
}
