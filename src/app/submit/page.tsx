"use client";

import { useMemo, useState } from "react";
import { ConfigNotice } from "@/components/ConfigNotice";
import { TxStatus } from "@/components/TxStatus";
import { Button, Field, Input, Panel, Textarea } from "@/components/ui";
import { loadStats, submitDispute } from "@/lib/actions";
import { parseRevert } from "@/lib/chain";
import { useAsync } from "@/lib/hooks";
import {
  MAX_CONTENT_REF,
  claimLabel,
  genToWei,
  validateContentRef,
  weiToGen,
  type Claim,
  type ContentType,
} from "@/lib/protocol";
import { useSession, type TxPhase } from "@/lib/session";

export default function SubmitPage() {
  const { requireCaller, config } = useSession();
  const statsQ = useAsync(() => loadStats(config), [config?.contract_configured, config?.public_contract_address]);
  const [contentType, setContentType] = useState<ContentType>("image");
  const [contentRef, setContentRef] = useState("");
  const [claim, setClaim] = useState<Claim>("ai_generated");
  const [stake, setStake] = useState("0.25");
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const minGen = useMemo(() => {
    const wei = statsQ.data?.min_stake ?? config?.min_stake_wei ?? "100000000000000000";
    return weiToGen(wei);
  }, [statsQ.data, config]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setError(null);
    let wei: bigint;
    try {
      validateContentRef(contentType, contentRef);
      wei = genToWei(stake);
      if (wei <= 0n) throw new Error("Stake must be greater than zero");
      const min = BigInt(statsQ.data?.min_stake ?? config?.min_stake_wei ?? "100000000000000000");
      if (wei < min) throw new Error(`Stake below minimum (${minGen} GEN)`);
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Invalid form");
      return;
    }

    setPending(true);
    setPhase("signing");
    try {
      const caller = requireCaller();
      const d = await submitDispute(
        config,
        {
          caller,
          content_type: contentType,
          content_ref: contentRef.trim(),
          claim,
          stake_wei: wei.toString(),
        },
        {
          onPending: () => setPhase("pending"),
          onAccepted: () => setPhase("accepted"),
        },
      );
      setPhase("finalized");
      window.location.href = `/disputes/${d.id}/`;
    } catch (err) {
      setPhase("failed");
      setError(parseRevert(err));
    } finally {
      setPending(false);
    }
  }

  const paused = statsQ.data?.paused;

  return (
    <>
      <p className="kicker">Open a case</p>
      <h1 className="display" style={{ marginTop: "0.5rem", fontSize: "clamp(2.25rem, 5vw, 3.25rem)" }}>
        File a dispute
      </h1>
      <p className="lede" style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
        Bond GEN to a claim about a piece of work. If nobody contests before the window closes, the
        claim stands. If someone matches your stake, validators inspect the source.
      </p>

      <ConfigNotice />

      <form className="split" onSubmit={(e) => void onSubmit(e)}>
        <Panel className="panel-lg stack">
          <Field label="Content type">
            <div className="seg">
              <button
                type="button"
                className={`seg-btn${contentType === "image" ? " is-on" : ""}`}
                onClick={() => setContentType("image")}
              >
                Image URL
              </button>
              <button
                type="button"
                className={`seg-btn${contentType === "text" ? " is-on" : ""}`}
                onClick={() => setContentType("text")}
              >
                Text excerpt
              </button>
            </div>
          </Field>
          <Field
            label={contentType === "image" ? "Image URL" : "Excerpt"}
            hint={
              contentType === "image"
                ? "https only. Validators will attempt to render the resource."
                : `Bounded excerpt, max ${MAX_CONTENT_REF} characters.`
            }
          >
            {contentType === "image" ? (
              <Input
                value={contentRef}
                onChange={(e) => setContentRef(e.target.value)}
                placeholder="https://…"
                required
              />
            ) : (
              <Textarea
                value={contentRef}
                onChange={(e) => setContentRef(e.target.value)}
                maxLength={MAX_CONTENT_REF}
                placeholder="Paste the passage in dispute."
                required
              />
            )}
          </Field>
          <Field label="Claim">
            <div className="seg">
              <button
                type="button"
                className={`seg-btn${claim === "ai_generated" ? " is-on" : ""}`}
                onClick={() => setClaim("ai_generated")}
              >
                {claimLabel("ai_generated")}
              </button>
              <button
                type="button"
                className={`seg-btn${claim === "human_made" ? " is-on" : ""}`}
                onClick={() => setClaim("human_made")}
              >
                {claimLabel("human_made")}
              </button>
            </div>
          </Field>
          <Field
            label="Stake (GEN)"
            hint={`Minimum ${minGen} GEN. Challengers must match this amount exactly.`}
          >
            <Input
              inputMode="decimal"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              required
            />
          </Field>
          {fieldError ? <p className="danger-text">{fieldError}</p> : null}
          {paused ? <p className="danger-text">The registry is paused. New filings are rejected.</p> : null}
          <Button type="submit" className="btn-block" disabled={pending || paused}>
            {pending ? "Filing…" : "Stake and file"}
          </Button>
          <TxStatus
            phase={phase}
            error={error}
            onRetry={() => {
              const fake = { preventDefault() {} } as React.FormEvent;
              void onSubmit(fake);
            }}
            onClose={() => setPhase("idle")}
            label="Filing"
          />
        </Panel>
        <div className="aside-stack">
          <Panel>
            <p className="display" style={{ fontSize: "1.5rem" }}>
              How the window works
            </p>
            <ul>
              <li>Your stake is locked until the docket resolves.</li>
              <li>A different wallet may contest with an equal stake before the deadline.</li>
              <li>
                Unchallenged dockets can be closed by anyone after expiry; the claim stands and the
                stake returns.
              </li>
              <li>
                Contested dockets require a validator inspection. Winner takes the pot minus
                protocol fee. Inconclusive refunds both sides minus fee.
              </li>
            </ul>
          </Panel>
          <Panel>
            <p className="kicker">Current fee</p>
            <p className="fee-figure">{((statsQ.data?.fee_bps ?? 250) / 100).toFixed(2)}%</p>
            <p className="hint" style={{ marginTop: "0.5rem" }}>
              Taken only on contested resolution.
            </p>
          </Panel>
        </div>
      </form>
    </>
  );
}
