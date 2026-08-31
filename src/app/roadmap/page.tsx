"use client";

import { BtnLink, Panel } from "@/components/ui";
import { ROADMAP } from "@/lib/roadmap";

const STATUS: Record<string, string> = {
  shipping: "Shipping",
  next: "Next",
  later: "Later",
  horizon: "Horizon",
};

export default function RoadmapPage() {
  return (
    <>
      <p className="kicker">Development plan</p>
      <h1 className="display">What we ship, in order.</h1>
      <p className="lede" style={{ marginTop: "1rem", maxWidth: "40rem" }}>
        Forge Layer is a protocol first. This roadmap is the sequence we will not skip: make the
        contract the source of truth, make the record citable, then widen what can be inspected.
        Dates move. Order does not.
      </p>
      <ol className="roadmap-list">
        {ROADMAP.map((phase) => (
          <li key={phase.id} className="roadmap-row">
            <p className="kicker">Phase {phase.id}</p>
            <Panel className="panel-lg">
              <div className="section-head" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
                <h2>{phase.name}</h2>
                <span className="kicker">
                  {STATUS[phase.status]} · {phase.window}
                </span>
              </div>
              <p className="muted">{phase.summary}</p>
              <ul>
                {phase.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Panel>
          </li>
        ))}
      </ol>
      <div className="hero-actions">
        <BtnLink href="/submit/">File a dispute</BtnLink>
        <BtnLink href="/protocol/" variant="secondary">
          Read the protocol
        </BtnLink>
      </div>
    </>
  );
}
