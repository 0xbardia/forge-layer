"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";

const STAGES = [
  "Fetching the cited source",
  "Each validator inspecting independently",
  "Equivalence principle comparing judgments",
  "Writing verdict and settling stakes",
];

export function ConsensusPanel({ active }: { active: boolean }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!active) {
      setStage(0);
      return;
    }
    const t = window.setInterval(() => {
      setStage((s) => (s < STAGES.length - 1 ? s + 1 : s));
    }, 1400);
    return () => window.clearInterval(t);
  }, [active]);

  if (!active) return null;

  return (
    <div className="stage-box" role="status" aria-live="polite">
      <h3>Validators are reasoning about this</h3>
      <p>
        Resolution is slower than a normal transaction. Independent nodes fetch the content, produce
        a structured judgment, and reach consensus through GenLayer’s Equivalence Principle.
      </p>
      <ol className="stage-list">
        {STAGES.map((label, i) => (
          <li key={label} className="stage-item">
            <span
              className={cx("dot", i < stage ? "dot-done" : i === stage ? "dot-on" : "")}
              aria-hidden
            />
            <span className={i <= stage ? undefined : "stage-idle"}>{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
