"use client";

import { Button } from "@/components/ui";
import { cx } from "@/lib/cx";
import type { TxPhase } from "@/lib/session";

export function TxStatus({
  phase,
  error,
  onRetry,
  onClose,
  label,
}: {
  phase: TxPhase;
  error?: string | null;
  onRetry?: () => void;
  onClose?: () => void;
  label?: string;
}) {
  if (phase === "idle") return null;

  const steps: Array<{ key: TxPhase; title: string }> = [
    { key: "signing", title: "Awaiting signature" },
    { key: "pending", title: "Broadcasting" },
    { key: "accepted", title: "Accepted" },
    { key: "finalized", title: "Finalized" },
  ];
  const order: TxPhase[] = ["signing", "pending", "accepted", "finalized"];
  const idx = order.indexOf(phase === "failed" ? "pending" : phase);

  return (
    <div className="stage-box" role="status" aria-live="polite">
      <p className="kicker">{label ?? "Transaction"}</p>
      <ol className="stage-list">
        {steps.map((s, i) => {
          const done = idx > i || (phase === "finalized" && s.key === "finalized");
          const current = s.key === phase;
          return (
            <li key={s.key} className="stage-item">
              <span className={cx("dot", done ? "dot-done" : current ? "dot-on" : "")} aria-hidden />
              <span className={current || done ? undefined : "stage-idle"}>{s.title}</span>
            </li>
          );
        })}
      </ol>
      {phase === "failed" ? (
        <div>
          <p className="danger-text" style={{ marginTop: "0.75rem" }}>
            {error ?? "The transaction failed."}
          </p>
          <div className="tx-actions">
            {onRetry ? (
              <Button onClick={onRetry} className="btn-sm">
                Retry
              </Button>
            ) : null}
            {onClose ? (
              <Button variant="ghost" onClick={onClose}>
                Dismiss
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {phase === "finalized" && onClose ? (
        <Button variant="ghost" className="btn-sm" style={{ marginTop: "0.75rem" }} onClick={onClose}>
          Close
        </Button>
      ) : null}
    </div>
  );
}
