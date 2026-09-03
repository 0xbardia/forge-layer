"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import { claimLabel, statusLabel, type DisputeStatus, type Verdict } from "@/lib/protocol";

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button className={cx("btn", `btn-${variant}`, className)} {...props}>
      {children}
    </button>
  );
}

export function BtnLink({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cx("btn", `btn-${variant}`, className)}>
      {children}
    </Link>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <p className="field-label">{label}</p>
      {children}
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx("input", props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx("textarea", props.className)} />;
}

export function StatusPill({ status }: { status: DisputeStatus }) {
  const tone: Record<DisputeStatus, string> = {
    OPEN: "pill-open",
    CHALLENGED: "pill-challenged",
    RESOLVED: "pill-resolved",
    EXPIRED_UNCHALLENGED: "pill-expired",
  };
  return <span className={cx("pill", tone[status])}>{statusLabel(status)}</span>;
}

export function VerdictMark({ verdict }: { verdict: Verdict | string | null }) {
  if (!verdict) return <span className="verdict verdict-pending">Pending</span>;
  // Unadjudicated (or unadjudicated-expired) verdicts must be a neutral,
  // unverified badge — they record that no validator reviewed the
  // claim and explicitly do not attribute it to the submitter's initial
  // position. We never map these to verdict-ai / verdict-human tones.
  if (verdict === "unadjudicated") {
    return <span className="verdict verdict-unadjudicated">Unadjudicated</span>;
  }
  const tone =
    verdict === "ai_generated"
      ? "verdict-ai"
      : verdict === "human_made"
        ? "verdict-human"
        : "verdict-inconclusive";
  return <span className={cx("verdict", tone)}>{claimLabel(verdict)}</span>;
}

/**
 * Detail-page verdict display. Mirrors `VerdictMark` but expands the
 * expired-unchallenged case into an explicit "Unadjudicated (Expired)"
 * label so the closed-out docket carries a clear "the window elapsed
 * without a challenger" signal. Used by the docket detail page.
 */
export function VerdictBadge({
  verdict,
  status,
}: {
  verdict: Verdict | string | null;
  status: DisputeStatus | string;
}) {
  if (status === "EXPIRED_UNCHALLENGED" || verdict === "unadjudicated") {
    return (
      <span className="verdict verdict-unadjudicated">
        Unadjudicated
        {status === "EXPIRED_UNCHALLENGED" ? " (Expired)" : ""}
      </span>
    );
  }
  return <VerdictMark verdict={verdict} />;
}

export function Panel({
  className,
  children,
  style,
}: {
  className?: string;
  children?: React.ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className={cx("panel", className)} style={style}>
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden style={{ minHeight: "1rem" }} />;
}
