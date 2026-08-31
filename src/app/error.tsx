"use client";

import { Button, Panel } from "@/components/ui";

export default function ErrorView({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Panel className="error-box">
      <h2>Something broke the docket</h2>
      <p>{error.message || "An unexpected error occurred."}</p>
      <Button style={{ marginTop: "1rem" }} onClick={() => reset()}>
        Try again
      </Button>
    </Panel>
  );
}
