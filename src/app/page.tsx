"use client";

import Link from "next/link";
import { DisputeCard } from "@/components/DisputeCard";
import { BtnLink, Panel, Skeleton, StatusPill, VerdictMark } from "@/components/ui";
import { loadDisputes, loadStats } from "@/lib/actions";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/hooks";
import { docketId, weiToGen } from "@/lib/protocol";
import { FAQ, ROADMAP } from "@/lib/roadmap";

export default function HomePage() {
  const { config } = useSession();
  const stats = useAsync(() => loadStats(config), [config?.contract_configured]);
  const recent = useAsync(() => loadDisputes(config, { limit: 3 }), [config?.contract_configured]);
  const featured = useAsync(
    () => loadDisputes(config, { status: "RESOLVED", limit: 1 }),
    [config?.contract_configured],
  );
  const specimen = featured.data?.items[0];

  return (
    <>
      <section className="hero">
        <div>
          <p className="kicker">Authenticity, on the record</p>
          <h1 className="display">A public ledger for AI-versus-human disputes.</h1>
          <p className="lede hero-copy">
            File a claim about an image or a passage of text. Back it with GEN. Anyone else may
            contest. Independent validators inspect the source and write a durable verdict on
            GenLayer.
          </p>
          <div className="hero-actions">
            <BtnLink href="/submit/">File a dispute</BtnLink>
            <BtnLink href="/registry/" variant="secondary">
              Browse the registry
            </BtnLink>
          </div>
          <p className="hint" style={{ marginTop: "1.5rem", maxWidth: "28rem" }}>
            The Intelligent Contract is the source of truth. Wallets sign writes. The server never
            does. Until a Studio address is configured, this preview runs a faithful local rehearsal.
          </p>
        </div>
        <div className="hero-plates" aria-hidden="true">
          <div className="plate-frame" />
          <div className="p1" />
          <div className="p2" />
          <div className="p3" />
          <div className="spark" />
          <p className="plate-caption">FL · GENLAYER</p>
        </div>
      </section>

      <section aria-label="Live docket">
        <Panel className="panel-lg">
          <p className="kicker">Live docket</p>
          <h2 className="display" style={{ fontSize: "1.75rem", marginTop: "0.35rem" }}>
            What the registry holds right now.
          </h2>
          {stats.loading ? (
            <div className="stat-grid">
              <Skeleton className="skeleton" />
              <Skeleton className="skeleton" />
              <Skeleton className="skeleton" />
              <Skeleton className="skeleton" />
            </div>
          ) : stats.data ? (
            <dl className="stat-grid">
              <div className="stat">
                <dt>Open</dt>
                <dd>{stats.data.open}</dd>
              </div>
              <div className="stat">
                <dt>Challenged</dt>
                <dd>{stats.data.challenged}</dd>
              </div>
              <div className="stat">
                <dt>Resolved</dt>
                <dd>{stats.data.resolved}</dd>
              </div>
              <div className="stat">
                <dt>Staked</dt>
                <dd>{weiToGen(stats.data.total_staked)} GEN</dd>
              </div>
            </dl>
          ) : (
            <p className="danger-text" style={{ marginTop: "1rem" }}>
              {stats.error ?? "Unable to load stats"}
            </p>
          )}
        </Panel>
      </section>

      <section className="machine" aria-label="Status machine">
        <p className="kicker">Status machine</p>
        <div className="machine-grid">
          <article className="machine-step">
            <p className="step-n">01</p>
            <h3>Open</h3>
            <p>Stake locked. Challenge window running.</p>
          </article>
          <article className="machine-step">
            <p className="step-n">02</p>
            <h3>Challenged</h3>
            <p>Equal opposing stake. Ready for inspection.</p>
          </article>
          <article className="machine-step">
            <p className="step-n">03</p>
            <h3>Resolved</h3>
            <p>Validators agree. Pot settles minus fee.</p>
          </article>
          <article className="machine-step">
            <p className="step-n">04</p>
            <h3>Unchallenged</h3>
            <p>Window closed. Claim stands, stake returns.</p>
          </article>
        </div>
      </section>

      <section className="steps">
        <article className="step">
          <p className="step-n">01</p>
          <h3>Stake a claim</h3>
          <p>
            Point at an image URL or a bounded excerpt. Declare it AI-generated or human-made. Bond
            GEN to the position.
          </p>
        </article>
        <article className="step">
          <p className="step-n">02</p>
          <h3>Invite contest</h3>
          <p>
            A matching stake from another wallet opens the case. Self-challenges and late filings
            are rejected on-chain.
          </p>
        </article>
        <article className="step">
          <p className="step-n">03</p>
          <h3>Let validators look</h3>
          <p>
            Non-deterministic inspection, structured JSON judgment, Equivalence Principle consensus.
            The verdict is citable.
          </p>
        </article>
      </section>

      <section>
        <p className="kicker">A closed record</p>
        <h2 className="display" style={{ fontSize: "clamp(1.75rem, 4vw, 2.25rem)", marginTop: "0.75rem" }}>
          What a citation looks like.
        </h2>
        <p className="muted" style={{ marginTop: "0.75rem", maxWidth: "40rem" }}>
          The docket page is the product. Not a feed, not a thread — a serial, two stakes, a
          verdict, and the reasoning the validators agreed was equivalent.
        </p>
        {featured.loading ? (
          <Panel className="skeleton" style={{ marginTop: "2rem", minHeight: "16rem" }} />
        ) : specimen ? (
          <Panel className="panel-lg" style={{ marginTop: "2rem" }}>
            <div className="section-head" style={{ marginBottom: 0 }}>
              <div>
                <p className="kicker">{docketId(specimen.id)}</p>
                <h3 style={{ marginTop: "0.5rem", fontFamily: "var(--font-display)", fontSize: "1.75rem" }}>
                  {specimen.content_type === "image" ? "Image" : "Text"} ·{" "}
                  {specimen.claim === "human_made" ? "claimed human" : "claimed AI"}
                </h3>
              </div>
              <StatusPill status={specimen.status} />
            </div>
            <blockquote className="specimen-quote">
              {specimen.reasoning_summary ?? specimen.content_ref}
            </blockquote>
            <dl className="stat-grid" style={{ marginTop: "2rem" }}>
              <div className="stat">
                <dt>Verdict</dt>
                <dd>
                  <VerdictMark verdict={specimen.verdict} />
                </dd>
              </div>
              <div className="stat">
                <dt>Submitter stake</dt>
                <dd>{weiToGen(specimen.submitter_stake)} GEN</dd>
              </div>
              <div className="stat">
                <dt>Fee taken</dt>
                <dd>{weiToGen(specimen.fee_taken)} GEN</dd>
              </div>
            </dl>
            <Link href={`/disputes/${specimen.id}/`} className="text-link" style={{ marginTop: "1.5rem", display: "inline-block" }}>
              Open the docket
            </Link>
          </Panel>
        ) : (
          <Panel className="empty" style={{ marginTop: "2rem" }}>
            <p>No resolved docket yet. File one, contest it, and close it.</p>
          </Panel>
        )}
      </section>

      <section>
        <p className="kicker">What holds</p>
        <h2 className="display" style={{ fontSize: "clamp(1.75rem, 4vw, 2.25rem)", marginTop: "0.75rem" }}>
          Built so a reviewer cannot shrug it off.
        </h2>
        <div className="hold-grid">
          <article className="hold">
            <h3>The contract is the source of truth</h3>
            <p>Reads and writes go to the Intelligent Contract once PUBLIC_CONTRACT_ADDRESS is set. The server never signs.</p>
          </article>
          <article className="hold">
            <h3>Wallet-signed writes</h3>
            <p>submit, challenge, and resolve are signed client-side via genlayer-js. No private key lives in the repo.</p>
          </article>
          <article className="hold">
            <h3>Equivalence Principle</h3>
            <p>Validators inspect independently. Verdicts must match exactly. Reasoning may differ in wording.</p>
          </article>
          <article className="hold">
            <h3>Fail-safe inspection</h3>
            <p>Unreachable or private-host sources resolve as inconclusive. A broken URL cannot brick a docket.</p>
          </article>
          <article className="hold">
            <h3>Specific reverts</h3>
            <p>Self-challenge, double-challenge, late challenge, mismatched stake, pause, and replay each have a named error.</p>
          </article>
          <article className="hold">
            <h3>Open and citable</h3>
            <p>MIT licensed. Every closed docket is a public serial with claim, stakes, verdict, and reasoning.</p>
          </article>
        </div>
      </section>

      <section className="steps">
        <article className="step">
          <p className="step-n">A</p>
          <h3>Rights desks</h3>
          <p>
            When two parties disagree about whether a still was drawn by a person or a model, the
            record is the argument — not a thread.
          </p>
        </article>
        <article className="step">
          <p className="step-n">B</p>
          <h3>Newsrooms</h3>
          <p>A passage can be staked, contested, and closed. The reasoning summary travels with the citation.</p>
        </article>
        <article className="step">
          <p className="step-n">C</p>
          <h3>Collectors</h3>
          <p>Provenance for images that will otherwise be argued in DMs. The contract does not care who is louder.</p>
        </article>
      </section>

      <section>
        <div className="section-head">
          <h2>Recent dockets</h2>
          <Link href="/registry/">Full registry</Link>
        </div>
        {recent.loading ? (
          <div className="card-grid">
            <Panel className="skeleton" />
            <Panel className="skeleton" />
            <Panel className="skeleton" />
          </div>
        ) : recent.error ? (
          <Panel className="error-box">
            <h2>Registry unreachable</h2>
            <p>{recent.error}</p>
          </Panel>
        ) : recent.data?.items.length ? (
          <div className="card-grid">
            {recent.data.items.map((d) => (
              <DisputeCard key={d.id} dispute={d} />
            ))}
          </div>
        ) : (
          <Panel className="empty">
            <h2>The registry is empty</h2>
            <p>File the first dispute.</p>
          </Panel>
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>Roadmap</h2>
          <Link href="/roadmap/">Full plan</Link>
        </div>
        <ol className="roadmap-rail">
          {ROADMAP.map((phase) => (
            <li key={phase.id}>
              <div className="section-head" style={{ marginBottom: 0 }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem" }}>{phase.name}</h3>
                <p className="kicker">
                  Phase {phase.id} · {phase.window}
                </p>
              </div>
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                {phase.summary}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="faq">
        <h2 className="display" style={{ fontSize: "1.875rem" }}>
          Questions, answered once.
        </h2>
        <dl className="faq-list">
          {FAQ.map((item) => (
            <div key={item.q} className="faq-item">
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="cta-band">
        <Panel className="panel-lg">
          <h2 className="display">File the claim. Let the record decide.</h2>
          <p className="lede" style={{ marginTop: "1rem", maxWidth: "32rem" }}>
            No feed. No likes. A docket number, two stakes, and a verdict that outlives the argument.
          </p>
          <div className="hero-actions">
            <BtnLink href="/submit/">File a dispute</BtnLink>
            <BtnLink href="/protocol/" variant="secondary">
              Read the protocol
            </BtnLink>
            <BtnLink href="/security/" variant="ghost">
              Security notes
            </BtnLink>
          </div>
        </Panel>
      </section>
    </>
  );
}
