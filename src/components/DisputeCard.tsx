"use client";

import { Panel, StatusPill, VerdictMark } from "@/components/ui";
import { formatRelative } from "@/lib/format";
import { claimLabel, docketId, shortAddress, weiToGen, type Dispute } from "@/lib/protocol";

function TypeMark({ kind }: { kind: "image" | "text" }) {
  return kind === "image" ? (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="5.5" cy="6.5" r="1" />
      <path d="M2 11.5 6 8l3 2.5 2-1.5 3 2.5" />
    </svg>
  ) : (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 4h10M3 8h7M3 12h8" />
    </svg>
  );
}

/**
 * Expiry-aware verdict label. The registry list never credits the
 * submitter's initial claim for an unchallenged expiry: it must read
 * "Unadjudicated" rather than be styled as a victory.
 */
function CardVerdict({ dispute }: { dispute: Dispute }) {
  if (dispute.status === "EXPIRED_UNCHALLENGED" || dispute.verdict === "unadjudicated") {
    return <VerdictMark verdict="unadjudicated" />;
  }
  return <VerdictMark verdict={dispute.verdict} />;
}

export function DisputeCard({ dispute }: { dispute: Dispute }) {
  const excerpt =
    dispute.content_type === "text"
      ? dispute.content_ref.slice(0, 160)
      : dispute.content_ref.replace(/^https?:\/\//, "").slice(0, 72);
  return (
    <a href={`/disputes/${dispute.id}/`} className="docket-card panel">
      <div className="docket-card-top">
        <div className="docket-meta">
          <TypeMark kind={dispute.content_type} />
          <span className="docket-id">{docketId(dispute.id)}</span>
        </div>
        <StatusPill status={dispute.status} />
      </div>
      <p className="docket-excerpt">{excerpt}</p>
      <dl className="docket-dl">
        <div>
          <dt>Claim</dt>
          <dd>{claimLabel(dispute.claim)}</dd>
        </div>
        <div>
          <dt>Verdict</dt>
          <dd>
            <CardVerdict dispute={dispute} />
          </dd>
        </div>
        <div>
          <dt>Stake</dt>
          <dd className="mono">{weiToGen(dispute.submitter_stake)} GEN</dd>
        </div>
        <div>
          <dt>Filed</dt>
          <dd>{formatRelative(dispute.created_at)}</dd>
        </div>
      </dl>
      <p className="docket-addr">{shortAddress(dispute.submitter)}</p>
    </a>
  );
}

export function DisputeCardSkeleton() {
  return <Panel className="skeleton" />;
}
