import { BtnLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="not-found">
      <p className="kicker">Unfiled</p>
      <h1 className="display">This page is not in the docket.</h1>
      <p className="lede" style={{ marginTop: "1rem" }}>
        The path does not match a Forge Layer surface. Return to the registry or file a new
        dispute.
      </p>
      <div className="hero-actions">
        <BtnLink href="/">Index</BtnLink>
        <BtnLink href="/registry/" variant="secondary">
          Registry
        </BtnLink>
      </div>
    </div>
  );
}
