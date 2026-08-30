"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ConfigNotice } from "@/components/ConfigNotice";
import { ConsensusPanel } from "@/components/ConsensusPanel";
import { TxStatus } from "@/components/TxStatus";
import { Button, Panel, Skeleton, StatusPill, VerdictMark } from "@/components/ui";
import { challengeDispute, loadDispute, loadStats, resolveDispute } from "@/lib/actions";
import { parseRevert } from "@/lib/chain";
import { formatRelative, formatWhen } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import {
  claimLabel,
  docketId,
  oppositeClaim,
  shortAddress,
  weiToGen,
  type Dispute,
} from "@/lib/protocol";
import { useSession, type TxPhase } from "@/lib/session";

function parseDocketId(raw: string): number | null {
  if (!raw || raw === "_") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

function idFromPath(): number | null {
  if (typeof window === "undefined") return null;
  const parts = window.location.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("disputes");
  const raw = idx >= 0 ? parts[idx + 1] : undefined;
  return raw ? parseDocketId(raw) : null;
}

export function DisputeDetail({ routeId }: { routeId: string }) {
  const seeded = parseDocketId(routeId);
  const [numericId, setNumericId] = useState<number | null>(seeded);
  const { address, requireCaller, config } = useSession();
  const stats = useStats();
  const now = useNow(1000);
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fromPath = idFromPath();
    if (fromPath && fromPath !== numericId) setNumericId(fromPath);
    if (!fromPath && seeded == null && numericId == null) setNumericId(NaN);
  }, [numericId, seeded]);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    setLoadError(null);
    try {
      const d = await loadDispute(config, id);
      setDispute(d);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Docket not found");
      setDispute(null);
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    if (numericId && Number.isFinite(numericId)) void load(numericId);
    else if (numericId !== null && !Number.isFinite(numericId)) {
      setLoading(false);
      setLoadError("Malformed docket id.");
    }
  }, [numericId, load]);

  async function runTx(kind: "challenge" | "resolve", d: Dispute) {
    setError(null);
    setPhase("signing");
    try {
      const caller = requireCaller();
      if (kind === "resolve") setResolving(true);
      const hooks = {
        onPending: () => setPhase("pending"),
        onAccepted: () => setPhase("accepted"),
      };
      if (kind === "challenge") {
        await challengeDispute(config, { caller, id: d.id, stake_wei: d.submitter_stake }, hooks);
      } else {
        await resolveDispute(config, { caller, id: d.id }, hooks);
      }
      await load(d.id);
      setPhase("finalized");
    } catch (err) {
      setPhase("failed");
      setError(parseRevert(err));
    } finally {
      setResolving(false);
    }
  }

  if (loading || numericId === null) {
    return (
      <>
        <Skeleton />
        <Panel className="skeleton" style={{ marginTop: "1.5rem", minHeight: "18rem" }} />
      </>
    );
  }

  if (loadError || !dispute) {
    return (
      <Panel className="error-box">
        <h2>Docket not found</h2>
        <p>{loadError ?? "No such dispute."}</p>
        <Link href="/registry/" className="hint" style={{ display: "inline-block", marginTop: "1rem" }}>
          Back to registry
        </Link>
      </Panel>
    );
  }

  const d = dispute;
  const canChallenge =
    d.status === "OPEN" &&
    now <= d.challenge_deadline &&
    address?.toLowerCase() !== d.submitter.toLowerCase();
  const canResolveChallenged = d.status === "CHALLENGED";
  const canResolveExpired = d.status === "OPEN" && now > d.challenge_deadline;
  const isSubmitter = address?.toLowerCase() === d.submitter.toLowerCase();

  const citation = [
    `Forge Layer Docket ${docketId(d.id)}`,
    `Claim: ${claimLabel(d.claim)}`,
    `Verdict: ${d.verdict ? claimLabel(d.verdict) : "pending"}`,
    `Status: ${d.status}`,
    d.resolved_at ? `Settled: ${formatWhen(d.resolved_at)}` : `Filed: ${formatWhen(d.created_at)}`,
  ].join("\n");

  return (
    <>
      <div className="docket-head">
        <div>
          <p className="docket-id">{docketId(d.id)}</p>
          <h1 className="display" style={{ marginTop: "0.5rem", fontSize: "clamp(2.25rem, 5vw, 3.25rem)" }}>
            Docket
          </h1>
        </div>
        <StatusPill status={d.status} />
      </div>

      <div className="docket-layout">
        <Panel className="panel-lg">
          <p className="kicker">Cited work</p>
          {d.content_type === "image" ? (
            <div className="cited-well">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={d.content_ref}
                alt="Cited image"
                crossOrigin="anonymous"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <p className="cited-url">{d.content_ref}</p>
            </div>
          ) : (
            <blockquote className="cited-quote">{d.content_ref}</blockquote>
          )}

          {d.reasoning_summary ? (
            <div className="reason-block">
              <p className="kicker">Consensus reasoning</p>
              <p>{d.reasoning_summary}</p>
            </div>
          ) : (
            <p className="hint" style={{ marginTop: "2rem" }}>
              No verdict yet.{" "}
              {d.status === "OPEN"
                ? "The challenge window is still open, or has not been resolved."
                : "Trigger resolution to ask validators to inspect this source."}
            </p>
          )}
        </Panel>

        <div className="aside-stack">
          <Panel>
            <p className="kicker">Cite this record</p>
            <pre className="cite-pre">{citation}</pre>
            <Button
              variant="ghost"
              className="btn-sm"
              style={{ marginTop: "0.5rem" }}
              onClick={() => {
                void navigator.clipboard.writeText(citation).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                });
              }}
            >
              {copied ? "Copied" : "Copy citation"}
            </Button>
          </Panel>

          <Panel>
            <div className="stake-bar">
              <div className="stake-side">
                <p>Submitter</p>
                <p>{weiToGen(d.submitter_stake)} GEN</p>
              </div>
              <div className="stake-side">
                <p>Challenger</p>
                <p>{d.challenger_stake ? `${weiToGen(d.challenger_stake)} GEN` : "—"}</p>
              </div>
            </div>
            <dl className="kv" style={{ marginTop: "1rem" }}>
              <div className="kv-row">
                <dt>Claim</dt>
                <dd>{claimLabel(d.claim)}</dd>
              </div>
              <div className="kv-row">
                <dt>Opposite</dt>
                <dd>{claimLabel(oppositeClaim(d.claim))}</dd>
              </div>
              <div className="kv-row">
                <dt>Verdict</dt>
                <dd>
                  <VerdictMark verdict={d.verdict} />
                </dd>
              </div>
              <div className="kv-row">
                <dt>Submitter</dt>
                <dd className="mono">{shortAddress(d.submitter)}</dd>
              </div>
              <div className="kv-row">
                <dt>Challenger</dt>
                <dd className="mono">{d.challenger ? shortAddress(d.challenger) : "—"}</dd>
              </div>
              <div className="kv-row">
                <dt>Window</dt>
                <dd>{formatWhen(d.challenge_deadline)}</dd>
              </div>
              <div className="kv-row">
                <dt>Window relative</dt>
                <dd>{formatRelative(d.challenge_deadline, now)}</dd>
              </div>
              <div className="kv-row">
                <dt>Filed</dt>
                <dd>{formatWhen(d.created_at)}</dd>
              </div>
              <div className="kv-row">
                <dt>Resolved</dt>
                <dd>{d.resolved_at ? formatWhen(d.resolved_at) : "—"}</dd>
              </div>
              <div className="kv-row">
                <dt>Protocol fee taken</dt>
                <dd>{weiToGen(d.fee_taken)} GEN</dd>
              </div>
            </dl>
          </Panel>

          <Panel className="actions-col">
            <ConfigNotice compact />
            {canChallenge ? (
              <Button
                className="btn-block"
                disabled={phase === "pending" || phase === "signing"}
                onClick={() => void runTx("challenge", d)}
              >
                Challenge with {weiToGen(d.submitter_stake)} GEN
              </Button>
            ) : null}
            {d.status === "OPEN" && isSubmitter ? (
              <p className="hint">You filed this docket. Another wallet must contest it.</p>
            ) : null}
            {d.status === "OPEN" && !address ? (
              <p className="hint">
                {config?.contract_configured
                  ? "Connect a wallet to challenge or resolve."
                  : "Enter the forge to challenge or resolve. Mint a second warden to contest your own filing."}
              </p>
            ) : null}
            {canResolveChallenged ? (
              <Button
                className="btn-block"
                disabled={phase === "pending" || phase === "signing"}
                onClick={() => void runTx("resolve", d)}
              >
                Ask validators to resolve
              </Button>
            ) : null}
            {canResolveExpired ? (
              <Button
                className="btn-block"
                disabled={phase === "pending" || phase === "signing"}
                onClick={() => void runTx("resolve", d)}
              >
                Close as unchallenged
              </Button>
            ) : null}
            {d.status === "RESOLVED" || d.status === "EXPIRED_UNCHALLENGED" ? (
              <p className="hint">This docket is closed. The record below is the citable result.</p>
            ) : null}
            {stats?.paused ? <p className="danger-text">The registry is paused. Writes will revert.</p> : null}
            <ConsensusPanel active={resolving} />
            <TxStatus
              phase={phase}
              error={error}
              onRetry={() => {
                if (canChallenge) void runTx("challenge", d);
                else void runTx("resolve", d);
              }}
              onClose={() => setPhase("idle")}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

function useStats() {
  const { config } = useSession();
  const [stats, setStats] = useState<{ paused: boolean; owner: string } | null>(null);
  useEffect(() => {
    void loadStats(config)
      .then((s) => setStats({ paused: s.paused, owner: s.owner }))
      .catch(() => undefined);
  }, [config]);
  return stats;
}
