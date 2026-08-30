import { Panel } from "@/components/ui";

export default function Loading() {
  return (
    <div>
      <div className="skeleton" style={{ height: "0.75rem", width: "8rem" }} />
      <div className="skeleton" style={{ height: "3rem", width: "18rem", marginTop: "1rem" }} />
      <div className="card-grid" style={{ marginTop: "2rem" }}>
        <Panel className="skeleton" />
        <Panel className="skeleton" />
        <Panel className="skeleton" />
      </div>
    </div>
  );
}
