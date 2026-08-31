import { BtnLink, Panel } from "@/components/ui";

export default function ProtocolPage() {
  return (
    <>
      <p className="kicker">Mechanism</p>
      <h1
        className="display"
        style={{ marginTop: "0.5rem", maxWidth: "48rem", fontSize: "clamp(2.25rem, 5vw, 3.25rem)" }}
      >
        How Forge Layer decides.
      </h1>
      <p className="lede" style={{ marginTop: "1rem" }}>
        The Intelligent Contract is the source of truth. This interface is a client: it reads public
        state and asks your wallet to sign writes. Nothing here substitutes for on-chain consensus.
      </p>

      <div className="protocol-grid">
        <Panel>
          <h2>1. File</h2>
          <p>
            <span className="hl">submit_dispute</span> is payable. It checks content type, a bounded
            content reference, a binary claim, and a minimum stake. Status starts at OPEN. A
            challenge deadline is stamped from the transaction time.
          </p>
        </Panel>
        <Panel>
          <h2>2. Contest</h2>
          <p>
            <span className="hl">challenge_dispute</span> rejects self-challenges, late challenges,
            double challenges, and mismatched stakes. A valid contest moves the docket to CHALLENGED.
          </p>
        </Panel>
        <Panel>
          <h2>3. Inspect</h2>
          <p>
            For images, validators attempt <span className="hl">gl.nondet.web.render</span>. For
            text, they reason over the excerpt and may fetch a URL. Each produces structured JSON: a
            verdict and a short reasoning summary.
          </p>
        </Panel>
        <Panel>
          <h2>4. Agree</h2>
          <p>
            Consensus uses <span className="hl">gl.eq_principle.prompt_comparative</span>. The
            verdict field must match exactly; reasoning may differ in wording. Unreachable sources
            resolve as inconclusive rather than trapping the docket.
          </p>
        </Panel>
        <Panel>
          <h2>5. Settle</h2>
          <p>
            Winner receives the pot minus protocol fee. Inconclusive refunds both sides minus fee.
            Unchallenged expiry upholds the original claim and returns the submitter stake in full.
            Replay of resolve is rejected.
          </p>
        </Panel>
        <Panel>
          <h2>6. Cite</h2>
          <p>
            Every closed docket is a public record: claim, stakes, verdict, and reasoning. Useful
            when two parties disagree about whether a work is machine-made.
          </p>
        </Panel>
      </div>

      <div className="protocol-cta">
        <BtnLink href="/submit/">File a dispute</BtnLink>
        <BtnLink href="/admin/" variant="secondary">
          Admin controls
        </BtnLink>
      </div>
    </>
  );
}
